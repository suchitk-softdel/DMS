# Screen Data Guide: Where Every Number Comes From

This guide explains every number, chart and message shown in the Dealers App: where it comes from, how it is calculated, and what to say about it in a demo.

- **Nothing is hard-coded and nothing is made up.** Every figure is calculated live by the backend from the database each time a page opens.
- **The data:** the fixed 2-year demo dataset (`dealer-app-backend/prisma/demo.db`), plus anything entered in the app.
- **Example values** below are for **Summit Comfort Heating & Air** (login `principal@demo.com`) on **19 Nov 2026**. Your numbers can differ slightly: they depend on today's date and on any orders you created while testing (`npm run db:reset` restores the original data).

---

## 1. The basic rule: what counts as revenue

The app has **two kinds of order**. They are easy to mix up:

| | **Orders** (dealer → manufacturer) | **Place Orders** (dealer → customer) |
|---|---|---|
| What it is | The dealer **buys** stock from the manufacturer | The dealer **sells** stock to its customer |
| Price | Base price (`Product.unitPrice`), quoted by the manufacturer | The dealer's own selling price, which must be above the base price |
| Effect on stock | When **Fulfilled**: on hand **+qty**, on order −qty | On save: on hand **−qty** |
| Is it revenue? | **No**, it is the dealer's purchase | **Yes**, this is the dealer's revenue |
| Table | `Order`, `OrderItem` | `DealerSale` |

| Rule | Detail |
|---|---|
| **Revenue = sales to customers** | Revenue = Σ quantity × selling price of the dealer's sales (`DealerSale`, entered on Place Orders). |
| **Cost = base price** | Cost of a sale = quantity × base price at the time of the sale. **Profit = revenue − cost.** |
| **Month = sale date** | A sale counts in the month it was made. |
| **Sales summary table** | Sales are grouped into the `Sale` table (dealer × product × month: units, revenue, cost). It is rebuilt immediately after every sale (`aggregationService.js`), so tiles and charts always match the sales. |
| **Base price vs selling price** | **Base price** = what the dealer pays the manufacturer (`Product.unitPrice`). **Selling price** = what the dealer charges its customer. |

```
Place Orders (DealerSale) ──►  Sale table (per month)  ──►  Revenue tiles, trend charts, forecast, inventory sales
Orders table (live)       ──►  Open orders, approvals, notifications; Fulfilled adds to stock
Inventory table (live)    ──►  On hand, on order, low / out of stock
Claims table (live)       ──►  Pending claims, aging alerts, warranty compliance, claim insights
Training progress         ──►  Incentives (training hours)
```

---

## 2. Home page

Backend: `GET /api/home` → `src/services/homeService.js`. Screen: `pages/dealer/Home.jsx`.

### 2.1 Header

| What you see | Where it comes from |
|---|---|
| "Good morning, Daniel" | "Good morning / afternoon / evening" from the computer's clock; the first name of the logged-in user (`User` table). |
| "Summit Comfort Heating & Air · Platinum Tier Dealer · Mountain West" | The logged-in user's dealer record (`Dealer` table: name, tier, region). Each user belongs to one dealer. |

### 2.2 KPI tiles

Each tile is shown only if the user's role can open the module it comes from. For example, a technician never receives revenue figures, because the backend doesn't send them.

#### Revenue (YTD)

| Item | Calculation | Example |
|---|---|---|
| Big number | Sum of sales to customers (quantity × selling price) from **1 Jan this year to today** | **$6,149,473** |
| "▲ 11.2% vs last year" | Compared with the **same dates last year** (1 Jan – 19 Nov 2025): (this year ÷ last year − 1) × 100 | $6,149,473 vs $5,531,878 → **+11.2%** |
| Small trend line | Revenue for each of the **last 12 complete months** (Nov 2025 – Oct 2026). The current month is left out so an unfinished month never looks like a drop. | 12 monthly values |

Who sees it: Dealer Principal only.

#### Health Score

| Item | Calculation | Example |
|---|---|---|
| Big number | The Dealer Health Score (0–100), explained in [section 4](#4-health-score-how-it-is-calculated) | **89** |
| "▼ 4 pts this month" | Score today minus the score calculated **as of the 1st of this month** | Shown as ▲ or ▼ points |

Who sees it: Dealer Principal only.

#### Open Orders

| Item | Calculation | Example |
|---|---|---|
| Big number | Orders that are not finished: **Requested + Quoted + Accepted** | 1 + 5 + 0 = **6** |
| "1 awaiting approval" | Orders still **Requested** (waiting for the manufacturer) | **1** |

Who sees it: Principal and Sales Rep.

#### Pending Claims

| Item | Calculation | Example |
|---|---|---|
| Big number | Warranty claims in **Submitted** or **Under Review** | **6** |
| "3 aging > 10 days" | Of those, claims that have stayed in the same stage for **more than 10 days** | **3** |

Who sees it: Principal and Technician.

### 2.3 AI Insight banner

These are in-house rules, not an outside AI service. The rules are checked in order and **the first one that finds a problem is shown**:

| Order | Rule | Shown when | Button |
|---|---|---|---|
| 1 | **Stock-out risk** | The demand forecast says a product will sell more in the next 30 days than the dealer has on hand plus on order | Place Reorder |
| 2 | **Aging claims** | Claims have waited more than 10 days | View Claims |
| 3 | **Revenue trend** | Always available: revenue YTD up or down vs last year | Open Dealer 360 |

Today's example (rule 1):

> **FN-H96-80 and FN-S80-80 are projected to run short in the next 30 days.**
> Evidence: FN-H96-80: 4 on hand, 0 on order, about 12 expected to sell · FN-S80-80: 0 on hand, 0 on order, about 8 expected to sell · Forecast: same month last year, adjusted for −2.1% unit growth

How the forecast works is explained in [section 5](#5-demand-forecast-stock-out-alerts).

### 2.4 Quick actions

These are fixed buttons. Each one appears only if the role can open the screen it leads to:
- **+ Create Order** opens the new order request.
- **Register Warranty** opens the Warranty page with the registration form already open.
- **Submit Claim** opens the Warranty page with the claim form already open.

### 2.5 Recent Activity

The latest 6 events, newest first, taken from:
- **Orders:** the 3 newest orders that are not drafts (order ID and amount)
- **Claims filed:** the 3 newest claims
- **Claims resolved:** the 2 newest approved, reimbursed or rejected claims

Each source is included only if the role can open that module.

---

## 3. My Dealer 360 page

Backend: `GET /api/dealer360` → `src/services/dealer360Service.js`. Screen: `pages/dealer/Dealer360.jsx`. Principal only.

### 3.1 Tiles

| Tile | Calculation | Example |
|---|---|---|
| **Revenue (12 months)** | Sales to customers in the **last 12 months** (20 Nov 2025 – today) | **$6,931,664** |
| **Growth** | Last 12 months vs the **12 months before**: (current ÷ previous − 1) × 100. Small text: change since the 1st of the month. | $6,931,664 vs $6,095,458 → **+13.7%** |
| **Health Score** | Same as on Home, with change this month | **89** |
| **Territory Coverage** | Stored on the dealer record: the share of the assigned territory the dealer serves | **82%** |

**Why Revenue YTD (Home) and Revenue 12 months (Dealer 360) differ:** they cover different periods. YTD runs from 1 Jan to today; 12 months is a rolling year. Both are correct.

A **new dealer** (Lakeside, joined Sep 2025) has no full previous year, so Growth shows **"New"** instead of a misleading percentage.

### 3.2 Revenue trend chart

- Monthly revenue (sales to customers) for the **last 24 months**. The 6 / 12 / 24 month buttons show part of the same data, with no new request.
- The second line is the **same month last year**, for comparison.
- The **current month is marked as partial** (it is not over yet). That is why November looks low: $246,625 so far vs $653,675 for all of Nov 2025.
- Months before a dealer joined show **no data** (not zero).

### 3.3 Health Score panel

Shows the 3 components with their weight, score and evidence (see [section 4](#4-health-score-how-it-is-calculated)).

### 3.4 Recommendations

There are 2 in-house rules. Each is tied to one Health Score component and shows its evidence:

| Rule | Fires when | Component it improves |
|---|---|---|
| **Reorder products** | The forecast shows a shortfall in the next 30 days | Revenue Growth (marked urgent) |
| **Resolve aging claims** | Claims have waited more than 10 days | Warranty Compliance |

**Ranking:** by how many Health Score points the component is missing, calculated as (100 − component score) × weight. A stock-out is urgent (it loses sales within weeks), so it always counts as at least 10 points.

Today's example:

| Order | Recommendation | Points |
|---|---|---|
| 1 | Reorder FN-H96-80 and FN-S80-80 | urgent, counted as 10 |
| 2 | Resolve 3 aging claims (CLM-20063: 15 days, $2,358 …) | (100 − 64) × 0.25 = **9** |

At most 4 recommendations are shown. When nothing needs action, the panel shows "Nothing to act on".

### 3.5 Timeline

This is the same source as Home's Recent Activity, but it shows 10 events (orders, claims filed and resolved).

---

## 4. Health Score: how it is calculated

File: `src/services/healthScoreService.js`. **Score = weighted average of 3 components, each scored 0–100.** Training Completion is **not** part of the score: training isn't used in the app.

| Component | Weight (stored) | Share of the score | Rule |
|---|---|---|---|
| **Revenue Growth** | 0.30 | **38%** | Last 12 months vs the previous 12. 0% change = 50; each 1% = 2.5 points; +20% or more = 100; −20% or less = 0 |
| **Order Velocity** | 0.25 | **31%** | Orders in the last 90 days vs the **same 90 days last year** (same season), same scale. Drafts, rejected and declined orders are not counted. |
| **Warranty Compliance** | 0.25 | **31%** | Share of the last 12 months' claims that were **not rejected and not left open more than 10 days** |

```
Score = (Revenue × 0.30 + Velocity × 0.25 + Warranty × 0.25) ÷ 0.80
Summit (d-1001), 27 Nov 2026: (100 × 0.30 + 100 × 0.25 + 65 × 0.25) ÷ 0.80 = 89
```

- **Weights are not in the code.** They are stored per manufacturer in the `HealthScoreWeight` table and can be changed without a code change (SRS FR-D360-6). They are used relative to each other, so they don't need to add up to 1.
- **New dealers are not penalised.** A component without enough history is left out, and the other weights are scaled up.
- **"Change this month"** runs the same calculation as of the 1st of the month and subtracts the result.

---

## 5. Demand forecast (stock-out alerts)

File: `src/services/forecastService.js`. This is used by the Home insight, the Dealer 360 recommendation and the bell.

```
Expected sales (next 30 days) = units sold in the same month last year × dealer's unit growth
Unit growth = units sold in the last 12 months ÷ units in the 12 months before (limited to 0.5×–1.5×)
Shortfall   = expected − on hand − on order        (shortfall > 0 → stock-out risk)
Revenue at risk = shortfall × catalogue price      (used to rank products)
```

Example: FN-H96-80 sold about 12 units in Nov 2025. Unit growth is 0.979 (−2.1%), so about 12 are expected. The dealer has 4 on hand and 0 on order, a **shortfall of 8**.

The demo data deliberately leaves Summit short on furnaces before winter, so this alert appears in the demo.

---

## 6. Orders page (dealer)

Backend: `GET /api/orders`, `GET /api/orders/summary` → `orderService.js`, `orderInsightService.js`. Screen: `pages/dealer/Orders.jsx`.

| What you see | Where it comes from |
|---|---|
| **Status pills with counts** (All / Drafts / In progress / Completed / Closed) | Orders counted by status. In progress = Requested + Quoted + Accepted. Completed = Fulfilled. Closed = Rejected + Declined. |
| **Banner "1 request waiting for the manufacturer"** | Orders with status Requested |
| **Banner "5 quotes to accept"** | Orders the manufacturer approved (Quoted) that the dealer hasn't answered yet |
| **Quantity column** | Sum of quantities across the order's lines |
| **Amount column** | Order total. Shows **"Awaiting quote"** until the manufacturer prices it. |
| **Date** | When the order was created |
| Search, sort, paging | Done in the backend database query, so they work on all orders, not only the visible page |

**Order flow and its effect on the numbers:**

```
Dealer sends request (quantities)  → Requested   → Open Orders +1, "awaiting approval" +1
Manufacturer approves & quotes     → Quoted      → prices filled from catalogue, dealer gets a bell notice
Dealer accepts (or declines)       → Accepted    → still open
Dealer marks fulfilled (received)  → Fulfilled   → stock: on hand +qty, on order −qty (Inventory updates);
                                                   equipment units can now be registered for warranty
```

An order can only move forward along these steps (`ORDER_TRANSITIONS` in `constants/domain.js`). For example, a Fulfilled order can't go back to Accepted. **Buying from the manufacturer is not revenue.** Revenue comes from Place Orders (see section 7A).

**Insights at the top of Orders** (`orderInsightService.js`):

| Insight | Calculation |
|---|---|
| Quotes to accept | Orders in Quoted: count, total value, and the oldest one with how many days it has waited |
| Waiting for manufacturer | Orders in Requested: count and the oldest one |
| To receive | Orders in Accepted: count, value and the oldest one |
| Last 30 days | Orders placed in the last 30 days vs the 30 days before (count and value; unpriced requests aren't counted in the value) |
| Approval | Manufacturer decisions in the last 90 days: approval rate = (decided − rejected) ÷ decided; average days from sending to the decision |

---

## 7. Inventory page

Backend: `GET /api/inventory/overview` → `inventoryService.js` (`getInventoryOverview`). Screen: `pages/dealer/Inventory.jsx`, 3 tabs: Overview, Stock, Sales. Only the logged-in dealer's own stock is returned.

### 7.1 Stock fields (table `Inventory`, one row per dealer × product)

| Field | Meaning | What changes it |
|---|---|---|
| **On hand** (`onHand`) | Units in the dealer's stock now | **+qty** when an Order is marked Fulfilled; **−qty** when a sale is made on Place Orders |
| **On order** (`onOrder`) | Units bought from the manufacturer, not yet received | **−qty** when an Order is marked Fulfilled (never below 0). It is **not** increased when an order is sent or accepted: it comes from the demo data. |
| **Reorder point** (`reorderPoint`) | The minimum level the dealer wants to keep; at or below it, the product needs reordering | Set per dealer and product in the data. A product first received through an order starts at 0. |

### 7.2 How stock status is calculated

Rule (`stockStatus` in `inventoryService.js`, the same rule on Inventory and Place Orders):

```
if on hand = 0                    → OUT OF STOCK  (grey/red)
else if on hand ≤ reorder point   → LOW STOCK     (amber)
else                              → IN STOCK / OK (green)
```

| Example | On hand | Reorder point | Status |
|---|---|---|---|
| FN-S80-80 | 0 | any | **Out of stock** (nothing to sell) |
| FN-H96-80 | 4 | 12 | **Low stock** (4 ≤ 12) |
| FN-H96-80 | 12 | 12 | **Low stock** (equal counts as low) |
| AC-16-36 | 20 | 12 | **In stock** (20 > 12) |

- Only **on hand** decides the status. Units **on order** don't make a product "OK"; the "Low / out of stock" tile shows how many of them have nothing on order.
- **Out of stock means it can't be sold:** Place Orders hides the Sell button and the backend refuses the sale.

### 7.3 Prices used

| Term | Calculation |
|---|---|
| **Base price** | `Product.unitPrice`: what the dealer pays the manufacturer |
| **Selling price** | The dealer's real price: revenue ÷ units of its sales of that product in the last 12 months (this month included). Not sold in that time → base price × the dealer's average markup (total revenue ÷ total cost). No sales at all → base price. |
| **Margin %** | (selling price − base price) ÷ selling price × 100 |

### 7.4 Tab 1: Overview

**Alert bar:** shown only when a product that is selling will **run out within 30 days** and has **nothing on order**. The best seller is picked first; otherwise the one running out soonest.

```
Sold per day = units sold last complete month ÷ days in that month
Days left    = on hand ÷ sold per day   (rounded down)
```

Example: 4 on hand, 10 sold last month (31 days) → 0.32 per day → **12 days left**.

**4 tiles:**

| Tile | Calculation | On click |
|---|---|---|
| **Low / out of stock** | Number of products with status Low or Out. Small text: how many of them have nothing on order. | Stock tab, filter "Low or out" |
| **Incoming stock** | Σ on order (units). Small text: number of products on order and their value at base price. | Orders page |
| **Open orders** | Orders awaiting approval + quotes to accept + accepted orders waiting to be received | Orders page |
| **Avg. approval time** | Average days from sending an order to the manufacturer's decision, for orders decided in the last 90 days | — |

**Pricing summary:**

| Figure | Calculation |
|---|---|
| **Stock value** | Σ on hand × selling price. Small text: Σ on hand × base price (what the stock cost). |
| **Potential margin** | Stock value − stock at base price: the profit if all stock is sold at the usual price. % = margin ÷ stock value. |
| **Incoming** | Σ on order × base price |
| **Selling price range** | Lowest and highest selling price across products, plus the average |

**Product insights** (last **3 complete months**; the current month is left out because a part month would look like a drop):

| Row | Rule | Button |
|---|---|---|
| **Best seller** | Most units sold, total of the 3 months | View: opens the product |
| **Fastest growing** | Biggest % rise in units sold, first month vs last month (month 2 not used; first month must have at least 2 units) | View: opens the product |

### 7.5 Tab 2: Stock

| Control | What it does |
|---|---|
| **Chart** | On hand for each product |
| **Category pills** | Each category with its stock value; click to show that category only |
| **Level filter** | All · **Low or out** (status ≠ OK) · **Healthy** (status OK) · **Not selling** (0 sold in 3 months and on hand > 0) |
| **Sort** | Most / Least on hand, or A–Z by SKU |
| **Search** | SKU or product name |
| **Product details** | On hand, on order, price per unit, status chip and the product's sales |

### 7.6 Tab 3: Sales

| Control | What it does |
|---|---|
| **Period** | Current month (so far) · 3 · 6 · 12 months (complete months) |
| **Units / Revenue** | Monthly chart for all products, from the `Sale` table (Place Orders sales) |
| **Top sellers** | Products ranked for the chosen period; click to open in the Stock tab |

---

## 7A. Place Orders page (dealer sells to customer)

Backend: `GET /api/place-orders`, `POST /api/place-orders` → `placeOrderService.js`. Screen: `pages/dealer/PlaceOrders.jsx`.

| What you see | Calculation |
|---|---|
| **"2 of 3 products available to sell"** | Products with on hand > 0 ÷ all products |
| **Available** | On hand from `Inventory` |
| **Base price** | `Product.unitPrice` |
| **Last selling price** | The price of the dealer's latest sale of that product; it is pre-filled in the form |
| **Status** | The same rule as Inventory (section 7.2) |
| **Sell button** | Shown only when available > 0; out-of-stock rows show "Not available" |

**Rules when selling** (checked on screen, then again on the server):

| Rule | Message |
|---|---|
| Quantity is a whole number, 1 or more (max 500 per sale) | "Enter a whole number of 1 or more." |
| Quantity ≤ on hand | "Only 4 available." |
| Product not out of stock | "… is out of stock and can't be sold." |
| Selling price **>** base price (equal is refused) | "Must be higher than the base price ($1,000.00)." |

**Shown before saving:** Order total = qty × selling price. **Your profit** = qty × (selling price − base price).

**What happens on save:**
1. In **one transaction**, stock is checked and on hand is reduced. If another sale took the units in the meantime, it is refused ("The stock changed. Please try again."), so stock can never go below 0.
2. The sale is saved with the base price **at that moment**, so later price changes don't change old profit.
3. The `Sale` summary is rebuilt, so **revenue on Home, Dealer 360, Inventory and the Copilot updates immediately**.
4. An audit log entry is written (who sold what).
5. Recent sales shows the latest 10: date, product, qty, price, total, profit, sold by.

---

## 8. Warranty page

Backend: `GET /api/claims` and `GET /api/claims/summary` → `claimService.js`. Screen: `pages/dealer/Warranty.jsx`. Principal and Technician.

The dealer **registers units** and **submits claims**. The decision (approve, reject, reimburse) belongs to the manufacturer; the dealer can't move a claim. The board updates **live**: when anyone registers a unit or submits a claim, every open Warranty screen of that dealer refreshes (`GET /api/live`).

### Warranty basics

| Term | Rule |
|---|---|
| **Which products have a warranty** | Equipment only: air conditioners, heat pumps, furnaces, air handlers (`EQUIPMENT_CATEGORIES`). Parts and accessories don't. |
| **Warranty length** | Per product (`Product.warrantyYears`, 1 year by default); can be changed in the data without a code change |
| **Warranty end** | Install date + warranty years |
| **Serial number** | Next number in the SN series (SN5000001, SN5000002 …), assigned by the system |

### Register warranty

Calls:
- `GET /registrations/pending` when the form opens
- `GET /registrations/next-serial` when a unit is picked
- `POST /registrations` on save

| Step | Rule |
|---|---|
| Units listed | Equipment lines of **Fulfilled** orders where registered < quantity ("1 of 3 registered") |
| Dealer enters | **Only the unit.** Serial number and install date are filled in by the system and can't be edited. |
| Install date | Today; warranty runs from today |
| Server checks | The line belongs to this dealer · the order is Fulfilled · the product is equipment · not all units are registered yet |
| Serial number | Picked and saved in **one transaction**, so two registrations at the same time never get the same number. The number in the form is a preview; the saved one is shown in the confirmation. |
| After save | Audit log entry, live update, message "Warranty registered · serial number … · covered until …" |

### Submit claim

`POST /api/claims` with the registered unit, amount and description.

| Rule | Refused with |
|---|---|
| Unit must be registered to this dealer | "Registered unit not found for this dealership." |
| Warranty not expired (install date + years ≥ today) | "The warranty for SN… expired on …" |
| Amount ≤ the product's base price (and between $1 and $100,000) | "Claim amount can't be more than the price of …" |
| Only one open claim per unit (Submitted, Under Review or Approved) | "Unit SN… already has an open claim (CLM-…)." |
| Description required, max 500 characters | — |

Product, customer and order are taken from the registration, so a claim is always linked correctly. A new claim starts in **Submitted** with the next number (CLM-20064 …). It is audited and sent as a live update.

**Claim stages** can only move forward: Submitted → Under Review → Approved → Reimbursed, or Under Review → Rejected (`CLAIM_TRANSITIONS`).

### Tiles

| Tile | Calculation | Summit today |
|---|---|---|
| **Open Claims** | Claims in **Submitted** or **Under Review**. Small text: of those, how many have waited **more than 10 days** in the same stage. Same numbers as the Home tile. | **6**, 3 aging |
| **Avg. Resolution** | Average days from **filing** to the **decision** (approved, reimbursed or rejected), for claims decided in the **last 12 months** | **16 days** (16 claims) |
| **Approval Rate** | Approved or reimbursed ÷ all claims decided in the last 12 months | **94%** (15 of 16; 1 rejected) |

### Board

- **4 columns:** Submitted → Under Review → Approved → Reimbursed, each with its count.
- **One line per claim:** Claim ID, amount, and **days in the current stage** (rounded up, the same as in Dealer 360). Reimbursed claims show the **paid date** instead.
- **Red border:** waiting more than 10 days. These claims are shown first in their column.
- **Hover** a card to see the product code and name.
- **Rejected** claims aren't a column; they are counted in the Approval Rate tile.

---

## 9. Order Approvals page (manufacturer)

Backend: `GET /api/manufacturer/...` → `manufacturerService.js`. Screen: `pages/manufacturer/OrderApprovals.jsx`. Login: `manufacturer@demo.com`.

Only orders from **this manufacturer's own dealers** are shown.

| Tile | Calculation |
|---|---|
| **Waiting** | Requests not yet decided. Small text: their total value and the age of the oldest one (shown in red after 2 days). |
| **Quoted** | Approved and waiting for the dealer to accept |
| **Accepted** | The dealer accepted the quote; the dealer will fulfil it |
| **Rejected / declined** | Rejected by the manufacturer or declined by the dealer. Small text: how many in the last 30 days. |

- Clicking a tile shows that list below.
- The **Waiting** list is sorted oldest first, so the longest-waiting order is handled first.
- **Approve & send quote** prices every line at the current catalogue price and recalculates the total.
- **Reject** needs a reason, which the dealer sees on the order.
- Only a Requested order can be decided, so two people can't decide the same order twice.

### 9.1 Dealer claim insights (unusual warranty claims)

Backend: `GET /api/manufacturer/claim-insights` → `claimInsightService.js`. Shown on its own **Claim Insights** tab in the manufacturer menu, below Order Approvals.

Every dealer is compared with the **whole network** of this manufacturer. Rates are **per 100 installed (registered) units**, so a big dealer is not flagged just for being big.

```
Claim rate     = claims ÷ registered units × 100
Network rate   = all claims ÷ all registered units × 100
Rate vs network = dealer rate ÷ network rate
```

| Flag | Fires when | Weight |
|---|---|---|
| **High claim rate** | ≥ 3 claims **and** rate ≥ **1.5×** the network | 3 |
| **High recent activity** | ≥ 3 claims in the last 90 days **and** the 90-day rate ≥ **2×** the network's 90-day rate | 2 |
| **Repeat claims** | Any unit with **more than one** claim | 2 |
| **Claims soon after install** | ≥ 2 claims filed within **30 days** of install **and** they are ≥ **25%** of the dealer's claims | 1 |
| **High claim amounts** | ≥ 3 claims **and** average amount ≥ **1.25×** the network average | 1 |
| **Many rejected claims** | ≥ 2 rejected **and** ≥ **25%** of decided claims rejected | 1 |

**Risk score = sum of the weights of the flags that fire.**

| Score | Status |
|---|---|
| 4 or more | 🔴 **Investigate** |
| 1–3 | 🟠 **Watch** |
| 0 | 🟢 **Normal** |

- Dealers are sorted by score, then by claim rate. Each flag shows its reason with the numbers (for example "3 units with more than one claim").
- **Dealer details:** claims per 100 units vs the average, total claims vs units sold, last 90 days, and the latest 8 claims (repeat claims marked, days after install).
- **Flag for investigation / close investigation:** the manufacturer can add an optional note (max 300 characters). It is stored in the audit log (who, when, note). The latest entry decides whether an investigation is open. Only dealers of this manufacturer's own network can be flagged.
- The thresholds are in `RULES` in `claimInsightService.js`; changing them changes who gets flagged.

---

## 10. Notification bell

Backend: `GET /api/notifications` → `notificationService.js`. Nothing is stored; notifications are worked out from the data each time.

| User | Notifications |
|---|---|
| **Dealer** | Quotes received or orders rejected in the **last 7 days** · claims waiting more than 10 days · products that may run short in 30 days |
| **Manufacturer** | Each order waiting for approval (amber after 2 days) · dealers' accept/decline answers in the last 7 days |

The count on the bell is the number of these items. Each one links to the matching order or screen.

---

## 11. Copilot

Backend: `POST /api/copilot/ask` → `src/copilot/`. In-house: no ChatGPT, no outside API.

```
Question → understand it (in-house classifier + business dictionary)
         → work out the period ("last quarter", "this year")
         → run the matching database query for THIS dealer only
         → answer + "Based on" evidence line + action button
```

- Answers use the **same data and rules** as the screens. For example, "What is my revenue this year?" gives the same figure as the Revenue (YTD) tile.
- 42 automated tests compare Copilot answers with values calculated separately from the database.
- Role checks apply. For example, a technician asking about revenue is told they don't have access.
- If a question isn't understood, it says so. It never makes up a number.

---

## 12. Common demo questions

| Question | Answer |
|---|---|
| "Is this data hard-coded?" | No. Every number is calculated live from the database when the page opens. Sell a product on Place Orders and the stock, revenue and charts change. |
| "How is out of stock / low stock decided?" | Out = 0 on hand. Low = on hand at or below the product's reorder point. Otherwise in stock. Units on order don't count until they are received. |
| "Can a dealer sell below cost?" | No. The selling price must be higher than the base price, checked on screen and on the server. |
| "Can a dealer sell more than it has?" | No. The quantity is checked against on hand, and the stock update is done in one transaction, so two sales at the same time can't oversell. |
| "Why are YTD and 12-month revenue different?" | Different periods: 1 Jan → today vs a rolling 12 months. |
| "Why does November look low on the chart?" | The month isn't over yet. It is marked as partial. |
| "Why is Open Orders 6?" | Open means not finished: Requested + Quoted + Accepted. An order leaves this count only when it is fulfilled, rejected or declined. |
| "Can the Health Score weights change?" | Yes. They are stored per manufacturer in the database, with no code change needed. |
| "Is the AI a third-party service?" | No. All insights, recommendations, forecasts and Copilot answers are in-house rules and models over the dealer's own data, and each one shows its evidence. |
| "Can a dealer see another dealer's data?" | No. Every backend query is limited to the logged-in user's dealer; the manufacturer sees only its own network's orders. |
| "Why did a number change since yesterday?" | Calculations use today's date, so rolling periods (12 months, 90 days, 10-day aging) move forward every day. |

---

## 13. Files to point to

| Screen / item | Backend file | Frontend file |
|---|---|---|
| Home | `src/services/homeService.js` | `pages/dealer/Home.jsx` |
| Dealer 360 | `src/services/dealer360Service.js` | `pages/dealer/Dealer360.jsx` |
| Health Score | `src/services/healthScoreService.js` | (shown on Home and Dealer 360) |
| Forecast | `src/services/forecastService.js` | (insight, recommendation, bell) |
| Sales summary | `src/services/aggregationService.js`, `salesService.js` | n/a |
| Orders | `src/services/orderService.js`, `orderInsightService.js` | `pages/dealer/Orders.jsx`, `components/orders/` |
| Inventory | `src/services/inventoryService.js` | `pages/dealer/Inventory.jsx` |
| Place Orders | `src/services/placeOrderService.js` | `pages/dealer/PlaceOrders.jsx` |
| Warranty | `src/services/claimService.js` | `pages/dealer/Warranty.jsx`, `components/warranty/` |
| Order Approvals | `src/services/manufacturerService.js` | `pages/manufacturer/OrderApprovals.jsx` |
| Claim insights | `src/services/claimInsightService.js` | `components/orders/DealerClaimInsights.jsx` |
| Business constants (stages, equipment, aging days) | `src/constants/domain.js` | `constants/modules.js` |
| Notifications | `src/services/notificationService.js` | `components/layout/TopBar.jsx` |
| Copilot | `src/copilot/`, `src/services/copilotService.js` | `pages/dealer/Copilot.jsx` |
