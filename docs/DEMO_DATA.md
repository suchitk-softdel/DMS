# Demo Data: How the Manufacturer and Dealer Data Is Built

This document explains the 2-year demo dataset used by the Dealers App: what is in it, how each table is built from the manufacturer and dealer data, how the records link to each other, and what happens when someone enters new data in the app.

- **Where it is stored:** `dealer-app-backend/prisma/demo.db` (SQLite, committed to git)
- **Period:** 1 Nov 2024 – 15 Nov 2026 (2 years)
- **Created:** once. Nothing is generated when the app runs; every machine gets exactly the same data.

---

## 1. The big picture

All data starts from **one manufacturer** and flows down to its dealers, then to the dealers' customers and their business.

```
                     Manufacturer  (Aerovance Climate Systems)
                          │
          ┌───────────────┼──────────────────────┐
          │               │                      │
      Products (40)   Dealers (6)        Incentive Programs (4)
      (catalogue,         │              Training Courses (12)
       price, cost)       │
                          │
     ┌──────────┬─────────┼──────────────┬───────────────┐
     │          │         │              │               │
  Users (35) Customers  Inventory (240) Opportunities  Incentive
  (by role)   (390)     (stock per      (186, sales    Progress (24)
                │        product)        pipeline)
                │
        Quotes & Orders (1,392)
                │
          Order Items (2,276)  ── each line = product × quantity × price
                │
   Warranty Registrations (6,432)  ── one per installed equipment unit (serial no.)
                │
        Warranty Claims (100)  ── only on registered units
```

**Rule:** a record can only exist if its parent exists. A claim needs a registered unit, a registered unit needs an order line, an order needs a customer, a customer needs a dealer, and a dealer needs the manufacturer.

---

## 2. Master data (who and what)

### 2.1 Manufacturer: 1 record

| Field | Value |
|---|---|
| Name | Aerovance Climate Systems |
| Headquarters | Charlotte, NC |
| Product lines | Air Conditioners, Heat Pumps, Gas Furnaces, Air Handlers, Controls & Thermostats, Indoor Air Quality, Service Parts |
| Standard warranty | 10 years |

### 2.2 Products: 40 (the manufacturer's catalogue)

Each product has a **list price** (what the dealer sells at) and a **unit cost** (used for profit).

| Category | Products | List price range |
|---|---|---|
| Air conditioners | 8 | $2,850 – $7,450 |
| Heat pumps | 6 | $3,690 – $8,690 |
| Gas furnaces | 6 | $1,890 – $4,190 |
| Air handlers | 4 | $1,590 – $2,990 |
| Thermostats | 4 | $149 – $689 |
| Indoor air quality | 4 | $69 – $1,890 |
| Service parts | 8 | $24 – $1,290 |

The first four categories are **serialised equipment**: each unit sold gets a serial number and can be registered for warranty. Thermostats, IAQ products and parts are not registered.

### 2.3 Dealers: 6 (the manufacturer's network)

| ID | Dealer | City | Region | Tier | Status | Joined | Demo story |
|---|---|---|---|---|---|---|---|
| d-1001 | Summit Comfort Heating & Air | Denver, CO | Mountain West | Platinum | active | 1 Nov 2024 | Biggest dealer, growing ~10%; planned furnace shortage for the forecast demo |
| d-1002 | Coastal Climate Solutions | Tampa, FL | Southeast | Gold | active | 1 Nov 2024 | Steady growth |
| d-1003 | Prairie Air Systems | Omaha, NE | Midwest | Silver | onHold | 1 Nov 2024 | Declining sales, low Health Score |
| d-1004 | Lakeside HVAC Services | Madison, WI | Midwest | Gold | active | 1 Sep 2025 | **New dealer**: only ~14 months of data |
| d-1005 | Lone Star Air & Heat | Austin, TX | South Central | Gold | active | 1 Nov 2024 | Strong second-tier dealer |
| d-1006 | Cascade Comfort Systems | Portland, OR | Pacific Northwest | Silver | active | 1 Nov 2024 | Small, residential-focused |

Each dealer was given a different size, growth and mix, so the dashboards and Copilot show realistic differences between dealers.

### 2.4 Roles and users: 4 roles, 36 users

| Role | Works for | Can open |
|---|---|---|
| Dealer Principal | a dealer | Home, Copilot, Dealer 360, Orders, Inventory, Warranty |
| Sales Representative | a dealer | Home, Copilot, Orders, Inventory |
| Service Technician | a dealer | Home, Copilot, Warranty |
| Manufacturer Order Desk | the manufacturer (Aerovance) | **Order Approvals** only: approve or reject the orders dealers send |

The manufacturer has one user, `manufacturer@demo.com` (Olivia Bennett, Aerovance order desk). It belongs to the manufacturer, not to a dealer, so it cannot open any dealer page or dealer data. The 35 dealer users are:

| Dealer | Principal | Sales reps | Technicians | Total |
|---|---|---|---|---|
| Summit | 1 | 4 | 5 | 10 |
| Coastal | 1 | 2 | 3 | 6 |
| Prairie | 1 | 1 | 2 | 4 |
| Lakeside | 1 | 2 | 2 | 5 |
| Lone Star | 1 | 2 | 3 | 6 |
| Cascade | 1 | 1 | 2 | 4 |

Each user's join date equals their dealer's join date. A user only ever sees their own dealer's data.

### 2.5 Customers: 390 (belong to one dealer each)

| Dealer | Customers | Residential | Commercial |
|---|---|---|---|
| Summit | 95 | 64 | 31 |
| Coastal | 67 | 55 | 12 |
| Prairie | 51 | 45 | 6 |
| Lakeside | 55 | 45 | 10 |
| Lone Star | 75 | 55 | 20 |
| Cascade | 47 | 44 | 3 |

Customers are in the dealer's own city and nearby towns.

---

## 3. Transaction data (what happened over the 2 years)

These records are built **from** the master data above, in this order:

```
Customer ──► Quote ──► Order ──► Order items ──► Installed & registered ──► Warranty claim
            (offer)   (purchase)  (products)       (serial number)          (unit failed)
```

### 3.1 Quotes and orders: 1,392

A **quote** is a price offer to a customer; an **order** is a confirmed purchase. Both are in the same table, separated by `type`.

| Type | Status | Count | Value |
|---|---|---|---|
| Order | fulfilled | 1,018 | $32,454,910 |
| Order | approved | 9 | $272,027 |
| Order | submitted | 4 | $303,757 |
| Quote | approved | 226 | $7,816,516 |
| Quote | submitted | 131 | $3,948,842 |
| Quote | draft | 4 | $64,608 |

How they are built:
- every order and quote belongs to **one dealer** and **one of that dealer's customers**
- the date follows HVAC **seasons**: more air conditioners in spring and summer, more furnaces in autumn and winter
- each dealer's volume follows its demo story (growth, decline, or starting in Sep 2025 for Lakeside)
- order size depends on the customer type:
  - **residential:** one home system, about **$7,600** on average (e.g. a furnace with a thermostat and filter)
  - **commercial:** a project for a school, hospital, office or apartment block, about **$113,000** on average (5–50+ units per project, up to about $714K)
- status follows the real flow:
  - orders: `draft → requested (quantities, sent to the manufacturer) → quoted by the manufacturer at catalogue prices (or rejected) → accepted (or declined) by the dealer → fulfilled by the dealer`
  - quotes: `draft → submitted → approved`
- recent orders are still open (submitted or approved); older ones are fulfilled
- **only fulfilled orders count as sales**

| Dealer | Orders | Quotes | Sales, 2 years | Sales, last 12 months | Growth vs previous 12 months |
|---|---|---|---|---|---|
| Summit | 298 | 109 | $13,183,530 | $6.84M | +12% |
| Lone Star | 221 | 77 | $8,370,140 | $4.30M | +7% |
| Coastal | 185 | 64 | $6,162,918 | $3.21M | +9% |
| Prairie | 113 | 33 | $1,732,290 | $0.80M | −11% |
| Lakeside | 100 | 42 | $1,562,068 | $1.34M | new dealer (joined Sep 2025) |
| Cascade | 114 | 36 | $1,443,964 | $0.69M | −6% |

Sales by year: **Nov–Dec 2024** $1.92M · **2025** $15.11M · **2026 (to 15 Nov)** $15.43M.

### 3.2 Order items: 2,276

Each order has one or more lines: **product × quantity × unit price**.
- products come from the manufacturer's catalogue (section 2.2)
- a typical order is equipment plus extras: e.g. a furnace with a thermostat and a filter
- **the order total always equals the sum of its lines** (checked automatically)

### 3.3 Warranty registrations: 6,432

When a fulfilled order contains equipment, the installed units are registered.

- one registration = **one installed unit with its own serial number** (e.g. `SN5001315`)
- linked to its **order line, order, customer, product and dealer**
- install date is **after** the order date
- 6,432 of the 7,502 equipment units sold (86%) are registered. Some customers never register, as in real life.
- commercial projects install their units over a few days to two weeks
- never more registrations than units on the order line

| Dealer | Summit | Coastal | Prairie | Lakeside | Lone Star | Cascade |
|---|---|---|---|---|---|---|
| Registrations | 2,766 | 1,061 | 360 | 265 | 1,594 | 386 |

### 3.4 Warranty claims: 100

A claim is filed when a **registered unit** fails. This gives the ratio from the requirement: about **1,000 orders → 100 claims**.

- every claim points to **one registration** (same serial number), and through it to the order, customer, product and dealer
- filed **after** the unit was installed
- claims start in Feb 2025: units need some time in use before they fail
- stage follows the real flow: `submitted → underReview → approved → reimbursed` (or `rejected`)

| Stage | Claims | Amount |
|---|---|---|
| Reimbursed | 59 | $55,883 |
| Approved | 7 | $6,883 |
| Under review | 14 | $11,893 |
| Submitted | 13 | $16,097 |
| Rejected | 7 | $5,740 |

| Dealer | Summit | Coastal | Prairie | Lakeside | Lone Star | Cascade |
|---|---|---|---|---|---|---|
| Claims | 28 | 17 | 15 | 10 | 19 | 11 |

**Example chain, from one claim back to the manufacturer:**

```
Claim CLM-20057 (reimbursed, $363.24, filed 28 Feb 2025)
  └─ Registration wr-SN5001315 (serial SN5001315, installed 29 Dec 2024)
       └─ Order line #2046 (product p-016)
            └─ Order ORD-101253
                 └─ Customer c-00358
                      └─ Dealer
                           └─ Manufacturer Aerovance Climate Systems
```

### 3.5 Other dealer data

| Table | Records | How it is built |
|---|---|---|
| Inventory | 240 | 6 dealers × 40 products: stock on hand, on order and reorder point as of 15 Nov 2026. Summit is deliberately short on furnaces before winter. |
| Opportunities | 186 | Sales pipeline per dealer and customer (Jul 2025 – Nov 2026): new 30, qualified 31, proposal 40, negotiation 26, won 32, lost 27 |
| Incentive programs | 4 | Manufacturer programs for 2026, with milestone targets (payout): **Volume Growth** $2M / $4M / $7M revenue ($15K / $35K / $75K) · **Heat Pump Push** (Jul–Dec) 50 / 150 / 300 units ($3K / $9K / $20K) · **Q4 Furnace Pre-Season** 25 / 50 units ($2K / $5K) · **Certified Dealer Bonus** 20 / 40 training hours ($1K / $2.5K). Example: Summit is at $6.06M toward $7M and 283 of 300 heat pumps. |
| Training courses | 12 | Manufacturer courses and upcoming live events |
| Training progress | 224 | Which users completed which courses |
| Audit log | 2,967 | One entry per create or status change of every order, quote and claim, at the matching date |

---

## 4. Aggregation: summary tables built from the transactions

Dashboards and models do not read raw orders directly. They read **summary tables** that the aggregation logic (`src/services/aggregationService.js`) builds from the transactions.

```
Fulfilled orders + order items ──► Sale               (dealer × product × month: units, revenue, cost)
Sale + training progress       ──► IncentiveProgress  (dealer × program: progress, payout earned)
```

| Summary table | Records | Built from |
|---|---|---|
| Sale | 1,362 | Fulfilled order lines, grouped by dealer, product and month (Nov 2024 – Nov 2026). Revenue = quantity × price; cost = quantity × unit cost. |
| IncentiveProgress | 24 | 6 dealers × 4 programs: progress toward each milestone and the payout earned |

**The same aggregation code runs for the demo data and for new entries.** When a user creates an order or changes its status, the dealer's Sale and IncentiveProgress rows are rebuilt immediately, so every dashboard shows the new figures.

---

## 5. Models that read the data

| Model | Reads | Output |
|---|---|---|
| **Health Score** (`healthScoreService.js`) | Orders, Sale, claims, training | Score 0–100. Weights: revenue growth 30%, order velocity 25%, warranty compliance 25%, training completion 20%, stored per manufacturer in the `HealthScoreWeight` table, so they can be changed without a code change. A new dealer is not penalised for missing history. |
| **Demand Forecast** (`forecastService.js`) | Sale, inventory | Expected units for the next 30 days = same month last year × the dealer's growth. Shortfalls against stock create stock-out alerts. |
| **360 Copilot** (`src/copilot/`) | All of the above, live | Answers questions about sales, profit, orders, claims, stock, incentives and so on, with the evidence behind each answer. In-house: no outside AI service. |

Expected outputs for every dealer as of 15 Nov 2026 are saved in `prisma/dataset/expected-outputs.json`. For example, Summit's Health Score is 77 and Prairie's is 41.

---

## 6. What happens when someone enters new data

```
User creates an order or claim in the app
        │
        ▼
Saved in dev.db (working copy of demo.db)
        │
        ▼
Aggregation re-runs for that dealer (Sale, IncentiveProgress)
        │
        ▼
Dashboards, Health Score, Forecast and Copilot show the new figures
```

- `demo.db` is never changed. On first start the app copies it to `dev.db`, and all new entries go there.
- New records follow the same rules as the demo data: the order links to a customer of the same dealer, the claim links to a registered unit, and status changes follow the allowed flow.
- `npm run db:reset` restores the original demo data, for example before a client demo.

---

## 7. How the data is checked

| Command | What it checks |
|---|---|
| `npm run db:verify` | **Links:** every claim matches its registration (same order, serial, customer, product, dealer; filed after install); every registration matches its order line; order totals equal their lines. **Aggregates:** Sale revenue equals fulfilled orders for each dealer; incentive payouts match the milestones. **Models:** Health Score and Forecast match `expected-outputs.json`. |
| `npm test` | 74 tests. **Manufacturer approval (9):** who can open Order Approvals, the manufacturer cannot see dealer data, dealers cannot approve their own orders, approve and reject (reason required, shown to the dealer), no double decisions. **Orders (12):** list filters, status groups, search, sorting and paging, and the request → quote → accept → fulfil flow (revenue and warranty registrations update). **Copilot (42):** answers for all 6 dealers compared with values calculated separately from the database, plus follow-ups, role access and dealer isolation. **Dealer 360 (11):** tiles, monthly trend, Health Score and its database weights, recommendations and timeline checked against the raw records |

Both pass on the current `demo.db`.

---

## 8. Quick reference: record counts

| Table | Records | Table | Records |
|---|---|---|---|
| Manufacturer | 1 | Warranty registrations | 6,432 |
| Dealers | 6 | Claims | 100 |
| Roles | 4 | Sale (summary) | 1,362 |
| Users | 36 (35 dealer + 1 manufacturer) | Inventory | 240 |
| Products | 40 | Incentive programs | 4 |
| Customers | 390 | Incentive progress (summary) | 24 |
| Orders + quotes | 1,392 | Training courses | 12 |
| Order items | 2,276 | Training progress | 224 |
| Opportunities | 186 | Audit log | 2,967 |
