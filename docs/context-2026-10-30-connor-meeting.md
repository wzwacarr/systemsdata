# Context: Wayne and Connor, weekly meeting 30 Oct 2026

Source: meeting transcript and summary (30 Oct 2026). Facts as stated by Connor unless marked.

## People
- **Connor:** built WA Staff. Background in procurement, computer science degree. Owns the WA Staff backend and database. Contact: WhatsApp for urgent, email for non-urgent, available most of the time.
- **Max:** senior, owns payroll flow and Peninsula HR relationship. [VERIFY role title]
- **PC Wizard:** external IT company. Holds Microsoft 365 admin.

## How the systems actually connect
```
Office creates job / opportunity / contact in Current RMS
   -> Current RMS API (rate limited, slows in peak season)
   -> WA Staff database (live copy, updated as Current changes)
   -> Xero (WA Staff reads Xero only; Current reads and writes Xero)
WA Staff changes feed back to Current and Xero.
```
- **WA Staff is the source of truth** for operations. It holds a live copy of Current RMS data plus its own data (tasks, dispatch, targets, etc).
- WA Staff backend: Java, PHP, SQL, built by Connor. Frontend built with ChatGPT and Claude.
- Database: SQL on an online web server managed through **Plesk** ("Plask" in transcript). Not Supabase, not Airtable. [VERIFY MySQL or MariaDB, and host: public DNS suggests IONOS]
- Current RMS cannot be accessed directly, only via its API.

## Design change for the hub
- **Do not pull Current RMS directly once WA Staff access exists.** WA Staff already holds that data, and a second pull eats the Current API rate limit that WA Staff depends on in peak season.
- Current RMS sync in `hub` stays as fallback only. Switch it off when WA Staff read access is live.

## Access status after the meeting
| System | Status | Next step | Owner |
|---|---|---|---|
| WA Staff database | Connor offered an MCP server with **read and write** | Ask for **read only**. Wayne does not intend to change data | Connor |
| Current RMS | Via WA Staff copy | No separate key needed if WA Staff access works | Connor |
| Xero | Not set up | Read-only user for labour cost visibility. Connor "will have a look" | Connor / Max |
| WordPress sites | Several sites: W.A. Carr & Son, Your Event (Your Event Hire), Lux Catering, plus one more [TO BE FILLED]. WooCommerce runs inside WordPress | Connor to set up Microsoft SSO login for all sites | Connor |
| Microsoft 365 / Outlook | Blocked: needs admin consent | Ticket to PC Wizard | Wayne |
| BrightHR | Wayne cannot see all staff in the app. API pull returned 72 employees | Check Wayne's permissions. Archive stale records | Connor / Max |
| Peninsula HR | Portal exists (disciplinaries, HR documents) | Check access with Max | Max |
| Cameras / CCTV | Being set up | Look at integration later | TBC |

## Finance and labour
- Payroll: Max downloads time from BrightHR, sends to accountants, they process via Xero.
- Most staff are now **agency**, paid as one payment. Wayne is comfortable with agency for now.
- Wayne wants labour cost visibility to shift people into the warehouse in November.
- A youngster is starting for three days at a set rate (direct, not agency). [VERIFY rate]
- Concern: hourly pay rewards time, not output.
- Max wants to look at an accounting firm. Wayne to research firms that specialise in rentals and events.

## Operations priorities
- **November:** warehouse stabilisation. Map offload, check, put-away. Tidy and set rules that stick before the December rush.
- Warehouse task view in WA Staff, like the office task view, so the warehouse team stops navigating 100 pages.
- Backlog: Wayne to collect feature requests in one structured list. Connor turns requests round in a few days.

## Dates
- **Tuesday 3 Nov 2026:** Wayne and Connor all day in person. Connor gives a full systems walkthrough.
- **31 Oct 2026:** Wayne sends the consolidated access email to Connor.
