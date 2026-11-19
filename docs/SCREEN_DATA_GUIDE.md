# Screen Data Guide: Where Every Number Comes From

This guide explains every number, chart and message shown in the Dealers App: where it comes from, how it is calculated, and what to say about it in a demo.

- **Nothing is hard-coded and nothing is made up.** Every figure is calculated live by the backend from the database each time a page opens.
- **The data:** the fixed 2-year demo dataset (see [DEMO_DATA.md](DEMO_DATA.md)), plus anything entered in the app.
- **Example values** below are for **Summit Comfort Heating & Air** (login `principal@demo.com`) on **19 Nov 2026**. Your numbers can differ slightly: they depend on today's date and on any orders you created while testing (`npm run db:reset` restores the original data).

---

## 1. The basic rule: what counts as revenue

| Rule | Detail |
|---|---|
| **Revenue = fulfilled orders only** | An order counts as a sale only when the dealer marks it **Fulfilled** (installed). Requested, quoted, accepted, rejected and declined orders are not revenue. |
| **Order total = sum of its lines** | Each line is product × quantity × unit price. The unit price is the manufacturer's catalogue price, set when the manufacturer approves the request. |
| **Month = order date** | A fulfilled order counts in the month it was created. |
| **Sales summary table** | Fulfilled order lines are grouped into the `Sale` table (dealer × product × month: units, revenue, cost). It is rebuilt immediately after every order change (`aggregationService.js`), so charts always match the orders. |

```
Order lines (fulfilled)  ──►  Sale table (per month)  ──►  Revenue tiles, trend charts, forecast
Orders table (live)      ──►  Open orders, approvals, notifications
Claims table (live)      ──►  Pending claims, aging alerts, warranty compliance
Training progress        ──►  Training completion, incentives
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
| Big number | Sum of fulfilled orders from **1 Jan this year to today** | **$6,149,473** |
| "▲ 11.2% vs last year" | Compared with the **same dates last year** (1 Jan – 19 Nov 2025): (this year ÷ last year − 1) × 100 | $6,149,473 vs $5,531,878 → **+11.2%** |
| Small trend line | Revenue for each of the **last 12 complete months** (Nov 2025 – Oct 2026). The current month is left out so an unfinished month never looks like a drop. | 12 monthly values |

Who sees it: Dealer Principal only.

#### Health Score

| Item | Calculation | Example |
|---|---|---|
| Big number | The Dealer Health Score (0–100), explained in [section 4](#4-health-score-how-77-is-calculated) | **77** |
| "▼ 4 pts this month" | Score today minus the score calculated **as of the 1st of this month** | 77 − 81 = **−4** |

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
- **Register Warranty**, **Place Reorder** and **Submit Claim** go to screens that are still "Coming soon".

### 2.5 Recent Activity

The latest 6 events, newest first, taken from:
- **Orders:** the 3 newest orders that are not drafts (order ID and amount)
- **Claims filed:** the 3 newest claims
- **Claims resolved:** the 2 newest approved, reimbursed or rejected claims
- **Training completed:** the 2 newest course completions

Each source is included only if the role can open that module.

---

## 3. My Dealer 360 page

Backend: `GET /api/dealer360` → `src/services/dealer360Service.js`. Screen: `pages/dealer/Dealer360.jsx`. Principal only.

### 3.1 Tiles

| Tile | Calculation | Example |
|---|---|---|
| **Revenue (12 months)** | Fulfilled orders in the **last 12 months** (20 Nov 2025 – today) | **$6,931,664** |
| **Growth** | Last 12 months vs the **12 months before**: (current ÷ previous − 1) × 100. Small text: change since the 1st of the month. | $6,931,664 vs $6,095,458 → **+13.7%** |
| **Health Score** | Same as on Home, with change this month | **77**, −4 pts |
| **Territory Coverage** | Stored on the dealer record: the share of the assigned territory the dealer serves | **82%** |

**Why Revenue YTD (Home) and Revenue 12 months (Dealer 360) differ:** they cover different periods. YTD runs from 1 Jan to today; 12 months is a rolling year. Both are correct.

A **new dealer** (Lakeside, joined Sep 2025) has no full previous year, so Growth shows **"New"** instead of a misleading percentage.

### 3.2 Revenue trend chart

- Monthly fulfilled revenue for the **last 24 months**. The 6 / 12 / 24 month buttons show part of the same data, with no new request.
- The second line is the **same month last year**, for comparison.
- The **current month is marked as partial** (it is not over yet). That is why November looks low: $246,625 so far vs $653,675 for all of Nov 2025.
- Months before a dealer joined show **no data** (not zero).

### 3.3 Health Score panel

Shows the 4 components with their weight, score and evidence (see [section 4](#4-health-score-how-77-is-calculated)).

### 3.4 Recommendations

There are 3 in-house rules. Each is tied to one Health Score component and shows its evidence:

| Rule | Fires when | Component it improves |
|---|---|---|
| **Reorder products** | The forecast shows a shortfall in the next 30 days | Revenue Growth (marked urgent) |
| **Resolve aging claims** | Claims have waited more than 10 days | Warranty Compliance |
| **Help team finish training** | Assigned courses are not completed | Training Completion |

**Ranking:** by how many Health Score points the component is missing, calculated as (100 − component score) × weight. A stock-out is urgent (it loses sales within weeks), so it always counts as at least 10 points.

Today's example:

| Order | Recommendation | Points |
|---|---|---|
| 1 | Reorder FN-H96-80 and FN-S80-80 | urgent, counted as 10 |
| 2 | Resolve 3 aging claims (CLM-20063: 15 days, $2,358 …) | (100 − 64) × 0.25 = **9** |
| 3 | Help 10 team members finish training (37 of 67 courses done) | (100 − 55) × 0.20 = **9** |

At most 4 recommendations are shown.

### 3.5 Timeline

This is the same source as Home's Recent Activity, but it shows 10 events (orders, claims filed and resolved, training completed).

---

## 4. Health Score: how 77 is calculated

File: `src/services/healthScoreService.js`. **Score = weighted average of 4 components, each scored 0–100.**

| Component | Weight | Rule | Summit today | Score |
|---|---|---|---|---|
| **Revenue Growth** | 30% | Last 12 months vs the previous 12. 0% change = 50; each 1% = 2.5 points; +20% or more = 100; −20% or less = 0 | +13.7% → 50 + 13.7 × 2.5 | **84** |
| **Order Velocity** | 25% | Orders in the last 90 days vs the **same 90 days last year** (same season), same scale. Drafts, rejected and declined orders are not counted. | 46 orders, +35.3% | **100** |
| **Warranty Compliance** | 25% | Share of the last 12 months' claims that were **not rejected and not left open more than 10 days** | 14 of 22 | **64** |
| **Training Completion** | 20% | Share of assigned courses the team has completed | 37 of 67 | **55** |

```
Score = 84 × 0.30 + 100 × 0.25 + 64 × 0.25 + 55 × 0.20
      = 25.2 + 25 + 16 + 11 = 77.2 → 77
```

- **Weights are not in the code.** They are stored per manufacturer in the `HealthScoreWeight` table and can be changed without a code change (SRS FR-D360-6).
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
Dealer marks fulfilled             → Fulfilled   → becomes REVENUE: Sale table rebuilt, warranty
                                                   registrations created, Health Score / charts update
```

---

## 7. Order Approvals page (manufacturer)

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

---

## 8. Notification bell

Backend: `GET /api/notifications` → `notificationService.js`. Nothing is stored; notifications are worked out from the data each time.

| User | Notifications |
|---|---|
| **Dealer** | Quotes received or orders rejected in the **last 7 days** · claims waiting more than 10 days · products that may run short in 30 days |
| **Manufacturer** | Each order waiting for approval (amber after 2 days) · dealers' accept/decline answers in the last 7 days |

The count on the bell is the number of these items. Each one links to the matching order or screen.

---

## 9. Copilot

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

## 10. Common demo questions

| Question | Answer |
|---|---|
| "Is this data hard-coded?" | No. Every number is calculated live from the database when the page opens. Create and fulfil an order and the revenue, charts and Health Score change. |
| "Why are YTD and 12-month revenue different?" | Different periods: 1 Jan → today vs a rolling 12 months. |
| "Why does November look low on the chart?" | The month isn't over yet. It is marked as partial. |
| "Why is Open Orders 6?" | Open means not finished: Requested + Quoted + Accepted. An order leaves this count only when it is fulfilled, rejected or declined. |
| "Can the Health Score weights change?" | Yes. They are stored per manufacturer in the database, with no code change needed. |
| "Is the AI a third-party service?" | No. All insights, recommendations, forecasts and Copilot answers are in-house rules and models over the dealer's own data, and each one shows its evidence. |
| "Can a dealer see another dealer's data?" | No. Every backend query is limited to the logged-in user's dealer; the manufacturer sees only its own network's orders. |
| "Why did a number change since yesterday?" | Calculations use today's date, so rolling periods (12 months, 90 days, 10-day aging) move forward every day. |

---

## 11. Files to point to

| Screen / item | Backend file | Frontend file |
|---|---|---|
| Home | `src/services/homeService.js` | `pages/dealer/Home.jsx` |
| Dealer 360 | `src/services/dealer360Service.js` | `pages/dealer/Dealer360.jsx` |
| Health Score | `src/services/healthScoreService.js` | (shown on Home and Dealer 360) |
| Forecast | `src/services/forecastService.js` | (insight, recommendation, bell) |
| Sales summary | `src/services/aggregationService.js`, `salesService.js` | n/a |
| Orders | `src/services/orderService.js`, `orderInsightService.js` | `pages/dealer/Orders.jsx`, `components/orders/` |
| Order Approvals | `src/services/manufacturerService.js` | `pages/manufacturer/OrderApprovals.jsx` |
| Notifications | `src/services/notificationService.js` | `components/layout/TopBar.jsx` |
| Copilot | `src/copilot/`, `src/services/copilotService.js` | `pages/dealer/Copilot.jsx` |
