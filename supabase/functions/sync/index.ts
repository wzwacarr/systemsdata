// Read-only sync from W.A. Carr source systems into hub.records.
// Called hourly by pg_cron with ?source=current_rms|brighthr|wordpress.
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

async function getJson(url: string, init: RequestInit): Promise<any> {
  const res = await fetch(url, init);
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

async function syncBrightHr(): Promise<Row[]> {
  const token = await brightToken();
  const rows: Row[] = [];
  const employees = await brightQuery(token, "/employees/v1/query");
  const now = new Date();
  const day = 86_400_000;
  for (const e of employees) {
    rows.push({ entity: "employees", id: e.id, data: scrub(e) });
    if (e._metadata?.isTerminated) continue;
    // Absences: last 30 days to next 60 days (API allows max 90 days back).
    const absences = await brightQuery(token, "/absences/v1/query", {
      employeeId: e.id, from: isoDate(new Date(now.getTime() - 30 * day)), to: isoDate(new Date(now.getTime() + 60 * day)),
    });
    absences.forEach((a, i) => rows.push({ entity: "absences", id: String(a.id ?? `${e.id}:${i}`), data: scrub({ ...a, employeeId: e.id }) }));
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

const SOURCES: Record<string, () => Promise<Row[]>> = {
  current_rms: syncCurrentRms,
  brighthr: syncBrightHr,
  wordpress: syncWordPress,
};

async function runSource(source: string) {
  const [{ id }] = await sql`insert into hub.sync_runs (source) values (${source}) returning id`;
  try {
    const rows = await SOURCES[source]();
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({ source, entity: r.entity, id: r.id, data: sql.json(r.data as any), synced_at: new Date() }));
      await sql`
        insert into hub.records ${sql(chunk, "source", "entity", "id", "data", "synced_at")}
        on conflict (source, entity, id) do update set data = excluded.data, synced_at = excluded.synced_at`;
    }
    const counts: Record<string, number> = {};
    rows.forEach((r) => (counts[r.entity] = (counts[r.entity] ?? 0) + 1));
    await sql`update hub.sync_runs set status = 'ok', finished_at = now(), row_count = ${rows.length}, detail = ${sql.json(counts)} where id = ${id}`;
    return { source, status: "ok", rows: rows.length, counts };
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
