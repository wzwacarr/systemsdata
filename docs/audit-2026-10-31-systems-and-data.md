# W.A. Carr & Son: systems and data audit

**Date:** 31 Oct 2026
**Method:** live counts from each connected system, read-only. Counts are the last 12 months (1 Nov 2025 to 31 Oct 2026) unless stated.

## 1. Headline

- **WA Staff is the richest source by far** (about 170,000 records across 34 datasets). It already holds sales, customers, logistics, warehouse, payments and receivables.
- **Our hub (Supabase) holds only BrightHR and WooCommerce** (about 3,200 records). WA Staff is read live through its connector, not copied.
- **Finance is the biggest gap.** No Xero, so no costs, margins, P&L, supplier bills or labour cost.
- **Microsoft 365 is connected as the wrong person** (`pcwizard@wacarrandson.co.uk`, the IT company's account), with send and write permissions. This must be fixed before anyone relies on it. See section 4.

## 2. What we have now

### 2a. WA Staff (live via connector, read-only for data)

| Area | Dataset | Records | Notes |
|---|---|---|---|
| Sales | opportunities (event date in last 12 months) | 4,210 | 1,838 orders, 2,232 quotations, 124 webform, 11 draft |
| Sales | opportunities (next 12 months) | 518 | 106 orders, 383 quotations, 23 webform |
| Sales | quotes | 1,187 | 244 accepted, 343 sent, 528 superseded, 68 draft, 4 declined |
| Sales | customers (synced) | 7,736 | includes addresses and contact details: stays in WA Staff |
| Sales | calls | 1,294 | |
| Sales | emails | 23,729 | text only, no attachments |
| Sales | notes / quote comments | 42 / 59 | |
| Sales | form submissions | 222 | metadata only |
| Sales | outbound leads / history | 0 / 0 | feature exists, unused |
| Logistics | jobs | 4,094 | 1,496 deliveries, 1,477 collections, 564 customer collections, 557 customer returns |
| Logistics | routes | 1,303 | planned miles, weight, duration (not actual cost) |
| Logistics | route jobs | 5,206 | all time |
| Logistics | route cost corrections | 7 | actual miles/minutes overrides, all time |
| Logistics | vehicles | 11 | 8 active, MOT and tax expiry |
| Warehouse | preparation lines | 3,684 | allocated quantities per job |
| Warehouse | item counts | 12,704 | booked out vs checked in |
| Warehouse | allocation history | 16,509 | who allocated what, when |
| Warehouse | preparation sessions | 21,776 | who prepped which order, start/end. **Basis for labour per job** |
| Warehouse | boxes | 19,417 | loaded, delivered, collected |
| Warehouse | linen | 6 | |
| Warehouse | warehouse status | 0 | feature exists, unused |
| Finance | payment requests | 1,267 | 751 completed, **347 expired**, 147 cancelled, 13 pending |
| Finance | refunds | 3 | approved |
| Finance | receivables snapshots | 18 | daily outstanding and overdue from Xero |
| Finance | purchase orders / items | 1 / 1 | supplier hub barely used |
| Team | tasks | 6,520 | 6,373 completed, 147 incomplete |
| Team | task completions | 843 | |
| Team | staff accounts / roles | 58 (21 active) / 6 | work identity only |
| Marketing | site content | 140 | 126 W.A. Carr, 14 Your Event Hire |
| Marketing | Search Console | daily | via marketing_performance tool |

WA Staff deliberately excludes: HR, payroll, credentials, payment links, attachments, raw Current RMS payloads. It has **no live stock** and **no product catalogue or pricing**.

### 2b. Hub database (Supabase, refreshed hourly)

| Source | Entity | Records | Refresh |
|---|---|---|---|
| BrightHR | employees | 72 | hourly at :17 |
| BrightHR | absences (last 7 days to next 53) | 9 | hourly |
| BrightHR | clock-ins (last 7 days) | 83 | hourly |
| WooCommerce | orders (since Sep 2025) | 2,089 | hourly at :37 |
| WooCommerce | products | 976 | hourly |

### 2c. Microsoft 365 (connected, wrong account)

- Signed in as **pcwizard@wacarrandson.co.uk**, not Wayne.
- That account has **no working mailbox** ("mailbox inactive or on-premise"), so Outlook returns nothing.
- It **can** read company SharePoint: 284 files visible (brochures, white-label venue brochures, wedding proposals, supplier invoices).
- No Teams.
- Granted permissions include **Mail.Send, Mail.ReadWrite, Files.ReadWrite.All, ChannelMessage.Send**. Far more than reporting needs.

## 3. What is not connected

| Gap | Why it matters | What unlocks it | Owner |
|---|---|---|---|
| **Xero** | Costs, margins, P&L, supplier bills, agency invoices, payroll journals. Without it we see revenue but not profit | Read-only Xero user, then Xero API app | Connor / Max |
| **WA Staff copied into the hub** | To join sales, jobs and warehouse with BrightHR hours, WooCommerce and Xero in one query, and to keep history | Read-only database login, or a nightly export, from Connor. Copying 170,000 records 50 at a time through the connector is not practical | Connor |
| **Current RMS products, stock, pricing, invoices** | WA Staff has no product catalogue, pricing or live stock. Needed for utilisation, stock losses, pricing decisions | Read-only Current RMS API key, pulled once a day so it does not compete with WA Staff for the rate limit | Connor |
| **Microsoft 365 as Wayne** | Outlook, info@ inbox, calendars, OneDrive | Disconnect pcwizard, reconnect as wayne@ | Wayne |
| **Agency labour cost** | Most staff are agency. Hours are in BrightHR, cost is on agency invoices | Comes with Xero, or agency rate card | Max |
| **Vehicle running costs** | Fuel, hire, maintenance per route | Fuel card or vehicle cost data [VERIFY what exists] | Max |
| **Cameras (Hik-Connect)** | Warehouse activity, security events | Which system, who manages it | Tuesday |
| **Peninsula HR** | Disciplinary and HR documents | Not needed in the hub. Leave in Peninsula | n/a |

## 4. Risks found

1. **Microsoft 365 identity.** Claude is acting as the IT company's admin account, with send and write rights over company mail and files. Anything done through it would look like PC Wizard did it. **Disconnect it and reconnect as wayne@wacarrandson.co.uk.**
2. **BrightHR headcount.** BrightHR shows 72 employees. WA Staff shows 21 active staff accounts. Either BrightHR holds leavers not marked as terminated, or many staff do not use WA Staff. [VERIFY]
3. **Expired payment requests.** 347 in 12 months (27%). Either customers are not paying through the link, or requests are being re-sent. Worth checking against receivables (£126,069 overdue on 30 Oct).
4. **Unused features.** Outbound leads, warehouse status and supplier purchase orders exist in WA Staff but hold almost nothing.

## 5. Questions we can answer today

- Sales pipeline by month, conversion from quote to order, quote turnaround.
- Jobs and routes per day, deliveries vs collections, items out vs checked back in (losses).
- Warehouse prep time per order and per person (preparation sessions).
- Payment request success rate, receivables trend.
- WooCommerce sales and top products.
- Staff absence and clock-ins.

## 6. Questions we cannot answer yet

- Profit per job, per customer, per product. **Needs Xero and Current RMS pricing.**
- Labour cost per job. **Needs agency rates or Xero.**
- Stock utilisation and losses in value. **Needs Current RMS products and stock.**
- Cost per route. **Needs vehicle and fuel costs.**
