# Demo Script: Dealers App

A 10-minute walkthrough for a client demo: what to click and what to say at each step.

**Story:** Summit Comfort Heating & Air, a Platinum dealer in Denver, runs its business in the app. Its manufacturer, Aerovance Climate Systems, approves the orders Summit sends.

---

## Before the demo (5 minutes)

1. **Restore clean demo data:**
   ```
   cd dealer-app-backend
   npm run db:reset
   ```
2. **Start the app:**
   - backend: `npm run dev` in `dealer-app-backend` (port 4000)
   - frontend: `npm run dev` in `dealer-app-frontend` (port 5173)
3. Open **http://localhost:5173** in Chrome, go full screen (**F11**) and zoom to about **110%**.
4. Keep this page open on a second screen or printed.

**Logins** (password `demo123` for all; the buttons on the login page fill them in):

| Button | User | Shows |
|---|---|---|
| Principal | `principal@demo.com` | Dealer owner: every dealer screen |
| Sales Rep | `sales@demo.com` | Dealer sales: no Dealer 360 |
| Technician | `tech@demo.com` | Dealer service: no sales figures |
| Manufacturer | `manufacturer@demo.com` | Aerovance order desk: Order Approvals only |

> Figures on screen are calculated live. Some (this month, Health Score) change slightly with today's date; the 2025 figures below stay the same.

---

## 1. Login and Home (1 minute)

**Do:** click **Principal** → **Sign in**.

**Show:**
- The greeting with the dealer name, tier and region.
- **4 KPI tiles:** Revenue (YTD) with growth vs last year, Health Score, Open Orders, Pending Claims.
- The **AI Insight** banner (e.g. furnaces projected to run short), with its evidence and a one-click action.
- **Quick Actions** and **Recent Activity**.

**Say:**
> "When a dealer logs in, they see the state of their business at a glance. Every number is calculated live from their own data, two years of history. The AI insight tells them the one thing to act on today and shows why."

---

## 2. 360 Copilot (2 minutes)

**Do:** open **Copilot** and ask these, one by one:

| Ask | What it shows |
|---|---|
| `What were my total sales last year?` | A direct answer: Summit's 2025 sales, **$6,314,069** |
| `by month` | **Follow-up:** it remembers "sales in 2025" and breaks it down by month, with a chart |
| `Top 5 customers by sales this year` | A table and bar chart with share bars |
| `How many furnaces are in stock?` | Stock on hand, at-risk items, and a button to Inventory |
| `What is my health score?` | The score with its 4 components and evidence |

Also point out: the **suggested prompts** on the right, **Copy** and **Download CSV**, and the "Based on" evidence line.

**Say:**
> "The Copilot is our own in-house AI. No third-party AI service or API key, so the dealer's data never leaves our system. It understands plain English, even with spelling mistakes, and every answer shows the data it's based on. It only answers from the dealer's own data, and it respects their role: a technician can't see profit, for example."

*(Optional: misspell a question, e.g. `total sles last yr`, to show spelling correction.)*

---

## 3. Dealer 360 (1.5 minutes)

**Do:** open **Dealer 360**.

**Show:**
- **Tiles:** Revenue (12 months), Growth, Health Score, Territory Coverage.
- **Revenue Trend:** switch **6M / 12M / 24M**; hover a month to compare with the same month last year. July is the AC-season peak; November is "to date".
- **Health Score Breakdown:** 4 weighted components, each with the reason behind its score.
- **AI Recommendations:** e.g. reorder furnaces, resolve an aging claim, help team members finish training, win back customers. Each has evidence and a button.

**Say:**
> "Dealer 360 explains performance, not just shows it. The Health Score is broken into four parts so the dealer knows exactly why it's 77 and what to do about it. The weights are set by the manufacturer in the database, without any code change."

---

## 4. Orders & Quotes, then manufacturer approval (3.5 minutes)

### 4a. Dealer creates an order
**Do:** open **Orders & Quotes**.

**Show briefly:** status filters with counts, search, sortable columns, and the **Order Insight** on the right (which open quote is likely to close, with its percentage and evidence).

**Do:** click **+ New Order** →
- Customer: type `Hillcrest` → choose **Hillcrest Office Park**
- Product: choose **HP-C15-36** (Comfort 15 SEER2 Heat Pump, 3 Ton), quantity **5**
- Point at the running total → click **Send to manufacturer**

**Show:** the order opens with status **Submitted**: "Sent to manufacturer · Waiting for the manufacturer to approve this order". There's no Approve button for the dealer.

**Say:**
> "The dealer can create the order, but only the manufacturer can approve it. Prices come from the manufacturer's catalogue."

### 4b. Manufacturer approves
**Do:** log out → click **Manufacturer** → **Sign in**.

**Show:**
- The manufacturer sees **only Order Approvals**, no dealer data.
- Tiles: orders waiting (count and value), oldest waiting, approved and rejected in the last 30 days.
- The waiting list from **all dealers**, oldest first. The new Summit order is in it.

**Do:** open the new order → show the dealer, end customer and lines → click **Approve order**.

*(Optional: open another order → **Reject** → pick "Out of stock" to show that a reason is required. Cancel, or reject it to show the dealer side later.)*

**Say:**
> "Aerovance's order desk sees every order from its dealer network in one place, approves or rejects it, and gives the dealer a reason when it says no."

### 4c. Dealer fulfils, and revenue updates
**Do:** log out → **Principal** → **Orders & Quotes** → open the order (now **Approved**: "Approved by Olivia Bennett") → **Mark fulfilled** → **Confirm**.

**Do:** go to **Home**.

**Show:** **Revenue (YTD)** has gone up by the order amount, and the new order is first in Recent Activity.

**Say:**
> "Once installed, the dealer marks it fulfilled. It counts as revenue straight away, the units are registered for warranty, and every dashboard, the Health Score, forecast and incentives update automatically."

---

## 5. Role-based access (30 seconds, optional)

**Do:** log in as **Technician**.

**Show:** the menu has no Orders or Dealer 360, and the Home tiles show no revenue.

**Say:**
> "Each user sees only what their role allows. This is enforced in the backend as well, not just hidden in the menu."

---

## 6. Close (30 seconds)

**Say:**
> "Everything you've seen runs on two years of connected demo data: about 1,000 orders, 6,400 warranty registrations and 100 claims, all linked from claim back to order, customer, dealer and manufacturer. It's covered by 70 automated tests. Next we're building Warranty & Claims, Inventory, Incentives & Training and Sales Coach."

---

## Likely questions

| Question | Answer |
|---|---|
| Is the AI using ChatGPT or another service? | No. It's built in-house; no external AI service, API key or AI library. Data stays in our system. |
| Is the data real? | It's realistic demo data for one manufacturer and 6 dealers over 2 years, created once and linked like real records. The calculations on it are live. |
| What happens to new orders? | They're saved and immediately update revenue, dashboards, Health Score, forecast and incentives, using the same logic as the historical data. |
| Can the manufacturer change the Health Score weights? | Yes. They're stored per manufacturer in the database, so no code change is needed. |
| Who approves orders? | The manufacturer's order desk. Dealers create and fulfil; they can't approve their own orders. |
| What if the manufacturer rejects an order? | The dealer sees the reason and can copy the order to a new draft, fix it and send it again. |
| Why is November low on the chart? | The month isn't over; the demo data runs to 15 Nov. |
| Why are 2024 sales so low? | The data starts in November 2024, so 2024 only covers two months. Compare 2025 with 2026, or use the last 12 months. |

## If something goes wrong

| Problem | Fix |
|---|---|
| Login fails or pages show errors | Check the backend is running on port 4000; restart with `npm run dev` |
| Numbers look different from rehearsal | Run `npm run db:reset` before the demo (removes test entries) |
| "Not signed in" after restarting the backend | Log in again (restarting signs everyone out) |
| Order not in the manufacturer's list | It must be **Sent to manufacturer**, not saved as draft |
