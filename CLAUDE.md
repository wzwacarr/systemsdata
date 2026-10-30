# W.A. Carr & Son: systems data hub

One place for all company data. Claude and ChatGPT read from here, not from each system.

## Rules
- Read-only against every source system. Never write back.
- WA Staff MCP has gated write tools (follow-up task changes, staff email, outbound leads). Never use them without Wayne's explicit approval of the exact preview.
- Keys live in Supabase Edge Function secrets (project wacarr-data-hub). Never in code, never in chat.
- W.A. Carr data only. Never mix with WayMaker or any other client.
- HR data: names, absence dates, hours only. No pay, addresses, or medical notes.
- British English. No em or en dashes.

## Sources
| System | Route | Secret names |
|---|---|---|
| Current RMS | Fallback only. Read via WA Staff database once live, to protect Current's API rate limit | CURRENT_RMS_SUBDOMAIN, CURRENT_RMS_API_KEY |
| BrightHR | Customer API (login.brighthr.com, api.bright.hr), hourly | BRIGHTHR_API_KEY (may also need BRIGHTHR_CLIENT_ID) |
| WooCommerce | Read-only REST key, hourly. Orders (money, dates, status, items, no customer contact details) and products | WC_SITE_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET |
| WordPress pages | Covered by WA Staff marketing_content. Hub wordpress source unused | WP_SITE_URL, WP_USERNAME, WP_APP_PASSWORD |
| WA Staff (wastaff.com) | Source of truth. **WA Staff MCP connector, live 30 Oct.** Use it directly for opportunities, jobs, routes, tasks, payments, receivables, purchase orders, warehouse. Call data_catalog first. No HR or payroll | n/a (connector) |
| Xero | Read-only user requested 30 Oct | TBC |
| Microsoft 365 | Stays in Microsoft, read live via connectors. Counts only in hub | n/a |
| Hik-Connect | Phase 3 | TBC |

## Hub
- Supabase project `wacarr-data-hub` (ref whdgxzsuuyyvymnkdhli), org wzwacarr's Org, eu-west-1.
- Data in private schema `hub`: `hub.records` (source, entity, id, data jsonb) and `hub.sync_runs` (log).
- Edge Function `sync` (supabase/functions/sync) pulls each source. pg_cron calls it hourly via `hub.trigger_sync(source)`.
- Shared secret between cron and the function: Vault secret `sync_secret`.
- Check health: `select source, status, row_count, detail, started_at from hub.sync_runs order by id desc limit 10;`

## Plan and context
- docs/data-hub-plan.md: the hub plan.
- docs/context-2026-10-30-connor-meeting.md: how the systems connect, who owns what. Read this first.
