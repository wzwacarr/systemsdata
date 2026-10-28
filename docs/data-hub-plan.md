# W.A. Carr & Son: one data hub plan

**Date:** 2026-10-28
**Status:** proposal, not built
**Goal:** every system feeds one place. Claude and ChatGPT both read from that one place. Keys are entered once, not per chat.

## The recommendation

**One free Supabase database (the hub), filled automatically every hour by a free scheduled job on GitHub. Claude and ChatGPT both connect to the hub, not to each system.**

```
Current RMS ─┐
BrightHR ────┤
WordPress ───┼──> hourly sync job (GitHub Actions, free) ──> Supabase hub (free) ──> Claude
wastaff ─────┤        keys stored once, here                  one copy of the truth  ──> ChatGPT
M365 counts ─┘                                                                         ──> Dashboard
```

Why this one:
- **Keys live in one place** (GitHub's encrypted secrets). No more pasting into each chat or environment.
- **One copy of the truth.** Every answer and the dashboard read the same tables, so numbers match.
- **Both AIs can use it.** Supabase has an official connector. Claude is already connected to your Supabase account. ChatGPT can add it as a custom connector. [VERIFY ChatGPT plan: custom connectors need ChatGPT Plus/Pro developer mode, or Business/Enterprise]
- **Free.** Supabase free tier (500 MB, plenty for this). GitHub Actions free minutes cover an hourly job.
- **The dashboard comes almost for free**, because the data is already shaped in one place.

Rejected:
- **Zapier / Make:** free tiers are too small for hourly syncs across five systems, and data still ends up scattered.
- **Connecting each system to each AI separately:** that is the mess you described. Two AIs times seven systems is fourteen setups to maintain.
- **Microsoft Fabric / Power BI:** not free at the level needed, and heavy for a first version.

## System by system

| System | How it gets into the hub | What we pull | Status |
|---|---|---|---|
| Current RMS | API key, hourly sync | Opportunities, orders, invoices, products, stock, members (customers) | Ready once key is in GitHub |
| BrightHR | API key, hourly sync | Employees, absence, Blip clock-ins | Ready once key is in GitHub. [VERIFY key works alone or needs the Client ID too] |
| WordPress | Application password, daily sync | Enquiry form entries, pages, posts | Ready once key is in GitHub. [VERIFY which form plugin holds enquiries] |
| wastaff.com | Not possible yet. Custom portal, no API | Shifts, staff, hours | Need the developer. Fastest ask: a **read-only database login** (the portal runs on PHP, almost certainly MySQL). Fallback: a daily CSV export |
| Outlook (Wayne + info@) | **Stays in Microsoft.** Each AI reads it live via its Microsoft 365 connector. Hub stores counts only (for example, unanswered info@ emails) | Live search; counts in hub | Needs your Microsoft 365 sign-in in Claude, and in ChatGPT. May need the M365 admin to approve once |
| OneDrive / SharePoint / MS Suite | **Stays in Microsoft.** Same connectors as Outlook | Live search of files | Same as above |
| Hik-Connect + Home control | **Phase 3, not now.** Consumer Hik-Connect has no open API. Business API (Hik-Connect for Teams / HikCentral OpenAPI) may exist on your account [VERIFY]. Useful data is events (door opened, motion after hours), not video | Event log only, never footage | [VERIFY what "Home control" is, and what you want from the cameras] |

Why email and files stay in Microsoft: copying every email and file into a second database duplicates sensitive data, costs storage, and goes stale. Both AIs already have Microsoft 365 connectors that search live. The hub only holds the numbers the dashboard needs.

## Risks to decide on now

1. **Who owns the hub.** This is W.A. Carr's data, including staff and HR records. Create the Supabase account and GitHub repo under a **W.A. Carr email**, not your personal or WayMaker account. Keeps client data separate from your other work, and the company keeps it if you leave.
2. **HR data and GDPR.** BrightHR holds personal data. Pull only what the dashboard needs (names, absence dates, hours). Do not pull salaries, addresses, or medical notes. [VERIFY with the business owner that this use is OK]
3. **Read-only everywhere.** The Current RMS key can technically write. The sync job only reads. If a key leaks, revoke it in that system and create a new one.
4. **Free tier pause.** Supabase pauses free projects after 7 days with no activity. The hourly sync keeps it awake.

## Build order

**Phase 1: the hub (one session, about 2 hours of my time, 20 minutes of yours)**
1. You: create a free Supabase account and a free GitHub account with a W.A. Carr email. Connect that Supabase to Claude (claude.ai, Settings, Connectors, Supabase).
2. You: add the keys in one place, the GitHub repo's Settings, Secrets: `CURRENT_RMS_SUBDOMAIN`, `CURRENT_RMS_API_KEY`, `BRIGHTHR_API_KEY`, `WP_SITE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD`. I give you the exact clicks.
3. Me: build the tables and the hourly sync for Current RMS, BrightHR, and WordPress. Test each one and show you row counts.

**Phase 2: Microsoft 365 and wastaff (needs other people)**
4. You: finish the Microsoft 365 sign-in in Claude and in ChatGPT. If blocked, the M365 admin approves once.
5. You: send the wastaff developer one message (I draft it) asking for a read-only database login.
6. Me: add wastaff and the info@ counts to the hub.

**Phase 3: dashboard, then cameras**
7. Me: build the dashboard on the hub. First five numbers, to confirm: revenue booked (week and month), jobs out in the next 7 days, staff off today, hours worked vs scheduled, unanswered info@ emails.
8. Later: Hik-Connect events, once we know what API your account has.

## What I need from you to start Phase 1

One decision: **create the hub under a W.A. Carr email (recommended) or your WayMaker account?**
