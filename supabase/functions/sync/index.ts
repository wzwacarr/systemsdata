// Read-only sync from W.A. Carr source systems into hub.records.
// Called hourly by pg_cron with ?source=current_rms|brighthr|wordpress|woocommerce.
// Source keys are Edge Function secrets, set in the Supabase dashboard.
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });

type Row = { entity: string; id: string; data: unknown };

// HR rule: never store pay, addresses, contact details, or free-text notes.
const BLOCKED_KEY = /note|reason|comment|description|medical|address|salary|pay|wage|email|phone|mobile|birth|nationali|bank|ni_?number/i;

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !BLOCKED_KEY.test(k))
        .map(([k, v]) => [k, scrub(v)]),
    );
  }
  return value;
}

function need(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing secret ${name}`);
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retries 429 (rate limited) with backoff, and slows down when a source says its budget is nearly spent.
// Each request gives up after 20 seconds, so one silent source cannot hang the whole run.
async function getJson(url: string, init: RequestInit): Promise<any> {
  const call = () => fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  let res = await call();
  for (let attempt = 0; res.status === 429 && attempt < 4; attempt++) {
    await res.body?.cancel();
    await sleep(2000 * 2 ** attempt);
    res = await call();
  }
  if (Number(res.headers.get("X-Rate-Limit-Remaining") ?? 99) <= 1) await sleep(1000);
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${new URL(url).pathname} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// ---------- Current RMS ----------
const RMS_ENTITIES = ["opportunities", "invoices", "members", "products", "projects", "stock_levels"];

async function syncCurrentRms(): Promise<Row[]> {
  const headers = { "X-SUBDOMAIN": need("CURRENT_RMS_SUBDOMAIN"), "X-AUTH-TOKEN": need("CURRENT_RMS_API_KEY") };
  const rows: Row[] = [];
  for (const entity of RMS_ENTITIES) {
    for (let page = 1; page <= 200; page++) {
      const body = await getJson(`https://api.current-rms.com/api/v1/${entity}?page=${page}&per_page=100`, { headers });
      const items: any[] = body[entity] ?? [];
      for (const item of items) rows.push({ entity, id: String(item.id), data: item });
      if (items.length < 100) break;
    }
  }
  return rows;
}

// ---------- BrightHR ----------
async function brightToken(): Promise<string> {
  const key = need("BRIGHTHR_API_KEY");
  const clientId = Deno.env.get("BRIGHTHR_CLIENT_ID");
  if (!clientId) return key; // Single key: try it as the bearer token directly.
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: key });
  const tok = await getJson("https://login.brighthr.com/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return tok.access_token;
}

async function brightQuery(token: string, path: string, filters?: object): Promise<any[]> {
  const items: any[] = [];
  let continuationToken: string | null = null;
  do {
    const page = await getJson(`https://api.bright.hr${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...(filters ? { filters } : {}), continuationToken, pageSize: 100 }),
    });
    items.push(...(page.items ?? []));
    continuationToken = page.continuationToken ?? null;
  } while (continuationToken);
  return items;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

let partial = false; // Set when a source ran out of time; the run is logged as 'partial'.

async function syncBrightHr(): Promise<Row[]> {
  const token = await brightToken();
  const rows: Row[] = [];
  const employees = await brightQuery(token, "/employees/v1/query");
  const now = new Date();
  const day = 86_400_000;
  // Edge Functions stop after about 150 seconds; leave room to save what we have.
  const deadline = Date.now() + 110_000;
  for (const e of employees) {
    rows.push({ entity: "employees", id: e.id, data: scrub(e) });
    if (e._metadata?.isTerminated) continue;
    if (Date.now() > deadline) { partial = true; continue; }
    // Absences: last 7 days to next 53 days, in 30-day windows (API allows max 31 days per call).
    for (const offset of [-7, 23]) {
      const from = new Date(now.getTime() + offset * day);
      const absences = await brightQuery(token, "/absences/v1/query", {
        employeeId: e.id, from: isoDate(from), to: isoDate(new Date(from.getTime() + 30 * day)),
      });
      absences.forEach((a, i) => rows.push({ entity: "absences", id: String(a.id ?? `${e.id}:${isoDate(from)}:${i}`), data: scrub({ ...a, employeeId: e.id }) }));
    }
    // Clock-ins: last 7 days (API allows max 31-day range).
    const clockings = await brightQuery(token, "/blip/v1/clockings/query", {
      employeeId: e.id, from: new Date(now.getTime() - 7 * day).toISOString(), to: now.toISOString(),
    });
    clockings.forEach((c, i) => rows.push({ entity: "clockings", id: String(c.id ?? `${e.id}:${i}`), data: scrub({ ...c, employeeId: e.id }) }));
  }
  return rows;
}

// ---------- WordPress ----------
async function syncWordPress(): Promise<Row[]> {
  const site = need("WP_SITE_URL").replace(/\/$/, "");
  const auth = "Basic " + btoa(`${need("WP_USERNAME")}:${need("WP_APP_PASSWORD")}`);
  const rows: Row[] = [];
  for (const entity of ["pages", "posts"]) {
    for (let page = 1; page <= 50; page++) {
      const res = await fetch(`${site}/wp-json/wp/v2/${entity}?per_page=100&page=${page}&context=view&_fields=id,date,modified,slug,status,link,title`, { headers: { Authorization: auth } });
      if (res.status === 400) break; // WordPress returns 400 past the last page.
      if (!res.ok) throw new Error(`WP ${entity} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const items: any[] = await res.json();
      for (const item of items) rows.push({ entity, id: String(item.id), data: item });
      if (items.length < 100) break;
    }
  }
  return rows;
}

// ---------- WooCommerce ----------
// Read-only key (WooCommerce > Settings > Advanced > REST API, permission Read).
// Orders keep money, dates, status and items only. Customer contact details are dropped.
function wooOrder(o: any) {
  return {
    id: o.id, number: o.number, status: o.status, currency: o.currency,
    date_created: o.date_created, date_modified: o.date_modified, date_paid: o.date_paid, date_completed: o.date_completed,
    total: o.total, total_tax: o.total_tax, shipping_total: o.shipping_total, discount_total: o.discount_total,
    payment_method_title: o.payment_method_title, created_via: o.created_via,
    line_items: (o.line_items ?? []).map((li: any) => ({ product_id: li.product_id, name: li.name, sku: li.sku, quantity: li.quantity, total: li.total })),
  };
}

function wooProduct(p: any) {
  return {
    id: p.id, name: p.name, sku: p.sku, status: p.status, type: p.type,
    price: p.price, regular_price: p.regular_price, sale_price: p.sale_price,
    stock_status: p.stock_status, stock_quantity: p.stock_quantity, total_sales: p.total_sales,
    categories: (p.categories ?? []).map((c: any) => c.name), date_modified: p.date_modified,
  };
}

async function syncWooCommerce(): Promise<Row[]> {
  const site = need("WC_SITE_URL").replace(/\/$/, "");
  const headers = { Authorization: "Basic " + btoa(`${need("WC_CONSUMER_KEY")}:${need("WC_CONSUMER_SECRET")}`) };
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
  const rows: Row[] = [];
  const pull = async (entity: string, extra: string, shape: (x: any) => unknown) => {
    for (let page = 1; page <= 50; page++) {
      const items: any[] = await getJson(`${site}/wp-json/wc/v3/${entity}?per_page=100&page=${page}${extra}`, { headers });
      for (const item of items) rows.push({ entity, id: String(item.id), data: shape(item) });
      if (items.length < 100) break;
    }
  };
  await pull("orders", `&modified_after=${encodeURIComponent(since)}`, wooOrder);
  await pull("products", "", wooProduct);
  return rows;
}

const SOURCES: Record<string, () => Promise<Row[]>> = {
  current_rms: syncCurrentRms,
  brighthr: syncBrightHr,
  wordpress: syncWordPress,
  woocommerce: syncWooCommerce,
};

async function runSource(source: string) {
  const [{ id }] = await sql`insert into hub.sync_runs (source) values (${source}) returning id`;
  partial = false;
  try {
    // Overlapping windows can return the same record twice; keep the last copy.
    const rows = [...new Map((await SOURCES[source]()).map((r) => [`${r.entity}:${r.id}`, r])).values()];
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({ source, entity: r.entity, id: r.id, data: sql.json(r.data as any), synced_at: new Date() }));
      await sql`
        insert into hub.records ${sql(chunk, "source", "entity", "id", "data", "synced_at")}
        on conflict (source, entity, id) do update set data = excluded.data, synced_at = excluded.synced_at`;
    }
    const counts: Record<string, number> = {};
    rows.forEach((r) => (counts[r.entity] = (counts[r.entity] ?? 0) + 1));
    await sql`update hub.sync_runs set status = ${partial ? "partial" : "ok"}, finished_at = now(), row_count = ${rows.length}, detail = ${sql.json(counts)} where id = ${id}`;
    return { source, status: partial ? "partial" : "ok", rows: rows.length, counts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sql`update hub.sync_runs set status = 'error', finished_at = now(), detail = ${sql.json({ error: message })} where id = ${id}`;
    return { source, status: "error", error: message };
  }
}

Deno.serve(async (req) => {
  const [{ secret }] = await sql`select decrypted_secret as secret from vault.decrypted_secrets where name = 'sync_secret'`;
  if (!secret || req.headers.get("x-sync-secret") !== secret) return new Response("forbidden", { status: 403 });

  const requested = new URL(req.url).searchParams.get("source");
  const sources = requested ? [requested] : Object.keys(SOURCES);
  const unknown = sources.filter((s) => !SOURCES[s]);
  if (unknown.length) return new Response(`unknown source: ${unknown.join(", ")}`, { status: 400 });

  const results = [];
  for (const s of sources) results.push(await runSource(s));
  return Response.json(results);
});
