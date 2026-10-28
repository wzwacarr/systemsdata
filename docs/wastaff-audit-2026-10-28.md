# wastaff.com audit (outside view)

**Date:** 2026-10-28
**Scope:** passive look from outside only. No login, no probing. What is behind the login is unknown until the team gives access.

## What we know

| Item | Finding | Source |
|---|---|---|
| What it is | "WA Carr Staff Portal", custom built, PHP pages (`login.php`, `forgot_password.php`) | Login page |
| Login | Username and password, Google reCAPTCHA, "keep me signed in" ticked by default | Login page |
| Hosting | Server IP 87.106.67.67. That range is normally IONOS (1&1). [VERIFY with the team] | Public DNS |
| Domain DNS | ns1/ns2/ns3.livedns.co.uk. [VERIFY which registrar the team uses] | Public DNS |
| Separate from website | wacarrandson.co.uk sits behind Cloudflare on a different host. Portal only borrows its favicon | Public DNS, page source |
| Search engines | Blocked from indexing (`robots.txt: Disallow: /`). Correct for a staff portal | robots.txt |
| Public API | None visible | Page source |
| Database | Not visible from outside. PHP on IONOS almost always means MySQL or MariaDB. [VERIFY] | Inference |

## Inside view (from Wayne's screenshots, 28 Oct 2026)

wastaff.com is not a standalone staff portal. It is W.A. Carr's own operations platform built **on top of Current RMS**.

Evidence: a "CurrentRMS" work area, staff mapped to Current RMS users ("Current RMS: AK"), order numbers like WA011785, and a sales dashboard using confirmed bookings by event date and document date.

| Work area | What it holds (visible) | Likely data origin |
|---|---|---|
| Sales & CRM | Sales dashboard, today's orders, bookings, staff monthly and annual targets, manual adjustments | Orders from Current RMS. **Targets and adjustments are wastaff's own data** |
| Finance | Payment requests, confirmation links, accepted jobs, Blink, invoice shortfalls, automatic order invoices, outstanding invoices, refund requests | Mix of Current RMS invoices and wastaff's own requests |
| Dispatch | Routes, customer collections, customer returns, drivers app, collections app, manage vehicles | **wastaff's own data** |
| Warehouse & logistics | Allocate orders, all items this week, orders not checked in, purchase requests, closedown, check stock | Current RMS stock plus wastaff's own allocation progress |
| Tasks & daily work | Tasks, create task, daily workflow, task flow | **wastaff's own data** |
| Management, Resources | Team overview, process guides, manage tools | **wastaff's own data** |
| Time clock | Clocked in / out | wastaff's own, may overlap BrightHR Blip [VERIFY] |

73 tools in total. Wayne's login has the Management role.

### What this changes
1. **The team almost certainly already has a Current RMS API key**, because wastaff reads Current RMS. Ask them for a read-only key. That unlocks orders, invoices, products, stock, and customers straight away.
2. wastaff's **own** data (targets, adjustments, tasks, dispatch, routes, vehicles, requests, time clock) still needs route 1 (export page) or route 2 (read-only database login).
3. A sales dashboard already exists inside wastaff. The hub dashboard should not rebuild it. It adds what wastaff cannot see: BrightHR absence and hours, Outlook, WordPress, and cross-system views.

## What we do not know yet

- What modules it has (shifts, timesheets, holidays, documents, pay?).
- What personal data it holds. If it holds right-to-work documents, bank details, or addresses, those stay out of the hub.
- Whether IONOS hosting allows a database login from outside. Shared IONOS hosting usually does not. A VPS or cloud server can.
- Who owns the code and the hosting login.

## Three ways to read everything

| Route | How it works | Effort for the team | Fit |
|---|---|---|---|
| **1. Read-only export endpoint (recommended)** | Team adds one protected page, for example `export.php`, that returns each table as JSON when called with a secret token. The hub calls it hourly. | About half a day | Works on any hosting. Team stays in control of exactly what is shared |
| 2. Read-only database login | Team creates a MySQL user with SELECT only, and allows connections from Supabase. | About 30 minutes | Only if the host allows remote database access. Many IONOS shared plans do not |
| 3. Nightly export file | Team schedules a nightly export of each table to a OneDrive folder. | About 1 to 2 hours | Fallback. Data is up to a day old |

Not recommended: Claude logging in with a username and password and reading the screens. reCAPTCHA blocks it, it breaks whenever a page changes, and it means sharing a real login.

## What to ask the team

1. Who built it, and who has the hosting login?
2. What modules and tables does it have? A list of database tables is enough.
3. Which of those hold personal data (addresses, bank, ID documents, pay)?
4. Is it on IONOS shared hosting, a VPS, or something else?
5. Can they build route 1? If not, route 2 or 3?

## Where it lands

Same hub as everything else: `hub.records` with `source = 'wastaff'`, one entity per table. Personal fields are dropped before saving, same rule as BrightHR.
