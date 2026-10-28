# W.A. Carr & Son: systems data hub

One place for all company data. Claude and ChatGPT read from here, not from each system.

## Rules
- Read-only against every source system. Never write back.
- Keys live in GitHub Actions secrets for this repo. Never in code, never in chat.
- W.A. Carr data only. Never mix with WayMaker or any other client.
- HR data: names, absence dates, hours only. No pay, addresses, or medical notes.
- British English. No em or en dashes.

## Sources
| System | Route | Secret names |
|---|---|---|
| Current RMS | REST API, hourly | CURRENT_RMS_SUBDOMAIN, CURRENT_RMS_API_KEY |
| BrightHR | Customer API (login.brighthr.com, api.bright.hr), hourly | BRIGHTHR_API_KEY (may also need BRIGHTHR_CLIENT_ID) |
| WordPress (wacarrandson.co.uk) | WP REST API, daily | WP_SITE_URL, WP_USERNAME, WP_APP_PASSWORD |
| wastaff.com | Bespoke portal, no API. Awaiting developer | TBC |
| Microsoft 365 | Stays in Microsoft, read live via connectors. Counts only in hub | n/a |
| Hik-Connect | Phase 3 | TBC |

## Hub
Supabase project: TBC (W.A. Carr owned organisation).

## Plan
See docs/data-hub-plan.md.
