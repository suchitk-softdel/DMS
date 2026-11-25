# Requirement Traceability

Status of every requirement in the SRS (`docs/SRS.md`, v1.0): what is done, what is partly done, and where it is implemented.

**Status as of:** 19 Nov 2026 · branch `feature/dealer-360-copilot`

| Mark | Meaning |
|---|---|
| ✅ Done | Built, working in the app and covered by tests or checked in the browser |
| 🟡 Partly done | Main part works; a piece is missing (explained in the notes) |
| 🔧 Backend only | Backend API or model is ready; the screen is not built yet |
| ⬜ Not started | Not built yet |
| ➖ Removed | Taken out of the app by project decision (noted per requirement) |
| ➖ Platform | Depends on the production platform, not on this app |

---

## Summary

| Module (SRS section) | Requirements | ✅ | 🟡 | 🔧 | ⬜ | ➖ Removed |
|---|---|---|---|---|---|---|
| 3.1 Home | 6 | 4 | 2 | 0 | 0 | 0 |
| 3.2 Dealer Copilot | 7 | 3 | 3 | 0 | 1 | 0 |
| 3.3 Dealer 360 | 6 | 5 | 1 | 0 | 0 | 0 |
| 3.4 Orders & Quotes | 6 | 5 | 0 | 0 | 0 | 1 |
| 3.5 Inventory Intelligence | 6 | 1 | 0 | 0 | 0 | 5 |
| 3.6 Incentives & Training | 6 | 0 | 0 | 0 | 0 | 6 |
| 3.7 Warranty & Claims | 5 | 2 | 2 | 1 | 0 | 0 |
| 3.8 Sales Coach | 5 | 0 | 0 | 0 | 0 | 5 |
| **Total functional** | **47** | **20** | **8** | **1** | **1** | **17** |

**In scope after project decisions: 30 of 47 requirements.** 17 were removed: customer quotes and Sales Coach (the app is dealer ↔ manufacturer only), Incentives & Training (taken out of the menu) and most of Inventory (reduced to a product list).

Of those 30: **20 done (67%)**, **28 done or partly done (93%)**. Still open: FR-COP-6 (voice and document search) and FR-WAR-1 (claim form with photo; backend ready).

---

## 3.1 Home / Dashboard

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-HOME-1 | Greeting with dealer name, tier, region | ✅ Done | `Home.jsx` header; dealer from `GET /api/home` |
| FR-HOME-2 | KPI tiles: Revenue YTD, Health Score, Open Orders, Pending Claims, with trends | ✅ Done | `homeService.js`; tiles shown per role |
| FR-HOME-3 | One AI Insight banner with evidence and a one-click action | ✅ Done | Rules in `homeService.js` (stock-out risk, aging claims, revenue trend) |
| FR-HOME-4 | Quick actions: Create Quote, Register Warranty, Place Reorder, Submit Claim | 🟡 Partly | All four buttons exist. **Create Order** (replaces Create Quote) opens the new order request. **Place Reorder** opens the Inventory product list; **Register Warranty** and **Submit Claim** open the Warranty board. There is no reorder, registration or claim form (project decision: Inventory and Warranty are view only). |
| FR-HOME-5 | Recent Activity timeline | ✅ Done | Latest orders, claims and training (`recentActivity` in `homeService.js`) |
| FR-HOME-6 | Refresh KPIs and insight each session and on a background interval | 🟡 Partly | Refreshed every time Home opens. No background interval yet. |

## 3.2 Dealer Copilot

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-COP-1 | Conversational AI available from every screen | 🟡 Partly | Copilot is its own screen in the menu (one click from anywhere), not a panel inside every screen. |
| FR-COP-2 | Natural-language answers grounded in the dealer's own data (SRS: RAG) | ✅ Done (in-house) | Project decision: built in-house, no third-party AI or RAG service (see README). Classifier + business dictionary + query engine over the dealer's orders, quotes, claims, registrations, stock and training (`src/copilot/`). 42 accuracy tests. |
| FR-COP-3 | Evidence shown with every recommendation | ✅ Done | Every answer has a "Based on" evidence line |
| FR-COP-4 | One-click actions from responses | 🟡 Partly | Action buttons open the related screen (e.g. Open Inventory, Create Quote). They open the screen; they don't complete the action inside the chat. |
| FR-COP-5 | Suggested prompts relevant to context | ✅ Done | 29 prompts filtered by role, plus follow-up suggestions after each answer |
| FR-COP-6 | Voice input and search across manuals, pricing sheets, documents | ⬜ Not started | Price questions are answered from the product catalogue. No voice or document search. |
| FR-COP-7 | All outputs pass an AI Guardrails service | 🟡 Partly | Built-in safeguards: role checks per answer, dealer isolation, no made-up numbers for unknown questions, question text not stored. No separate guardrails service (that's part of the platform). |

## 3.3 Dealer 360 (My Performance)

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-D360-1 | Tiles: Revenue, Growth %, Health Score, Territory Coverage | ✅ Done | `dealer360Service.js`; a new dealer shows "New" instead of a misleading growth figure |
| FR-D360-2 | Revenue trend with selectable window (6 / 12 months) | ✅ Done | 6 / 12 / 24 months, with the same month last year for comparison (`LineChart.jsx`) |
| FR-D360-3 | Explainable Health Score with weighted components | ✅ Done | 4 components with weight, score and evidence (`healthScoreService.js`) |
| FR-D360-4 | AI recommendations tied to Health Score components, with evidence | ✅ Done | 5 rules (aging claims, training, open quotes, lapsed customers, stock-out), ranked by impact |
| FR-D360-5 | Dealer timeline: orders, claims, training, escalations | 🟡 Partly | Orders, claims and training shown. Escalations don't exist in the data yet. |
| FR-D360-6 | Health Score weights configurable without a code change | ✅ Done | `HealthScoreWeight` table per manufacturer (no admin screen yet; changed in the database) |

## 3.4 Orders & Quotes

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-ORD-1 | Create, save as draft, submit and track quotes and orders | ✅ Done | Project decision: dealer ↔ manufacturer only (no end customers). The dealer sends an order request with quantities; the manufacturer approves it and sends a quote at catalogue prices (or rejects it); the dealer accepts or declines the quote, then fulfils. |
| FR-ORD-2 | Filterable, sortable list: Order ID, Customer, Amount, Status, Date | ✅ Done | Server-side sorting and paging (`listOrders`) |
| FR-ORD-3 | Filter by status and free-text search | ✅ Done | Status pills with counts (plus Rejected), search by order ID or customer |
| FR-ORD-4 | Consistent status chips | ✅ Done | Shared `StatusChip` with design colours |
| FR-ORD-5 | AI Order Insight on quotes likely to close, linked to Sales Coach | ➖ Removed | Removed by project decision: customer quotes are no longer part of the app (dealer ↔ manufacturer only). |
| FR-ORD-6 | Notify the dealer of orders awaiting approval | ✅ Done | Banners on Orders (requests waiting for the manufacturer, quotes to accept), the Home tile and the bell. No push or email notifications. |

## 3.5 Inventory Intelligence

**Project decision (19 Nov 2026):** the Inventory screen is a **product list with stock levels only** and is **not connected to orders**. Search by SKU or name; filter by category and stock level (`pages/dealer/Inventory.jsx`, `GET /api/inventory`). The demand forecast still runs in the backend for the Home insight, the Dealer 360 recommendation and the bell.

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-INV-1 | Tiles: Inventory Risk, 30-day Stock-outs, Overstock value, Forecast Accuracy | ➖ Removed | Project decision: product list only. The subtitle shows the number of products, low stock and out of stock. |
| FR-INV-2 | Demand vs. supply trend chart | ➖ Removed | Project decision: product list only |
| FR-INV-3 | Highest-risk SKU with recommended action and impact | ➖ Removed | Not on the Inventory screen. The same forecast drives the Home AI insight ("FN-H96-80 … projected to run short"). |
| FR-INV-4 | Ranked reorder recommendations table | ➖ Removed | Not on the Inventory screen. Stock-out risk is a Dealer 360 recommendation. |
| FR-INV-5 | Approve and trigger a reorder from a recommendation | ➖ Removed | Project decision: Inventory is not connected to orders. Dealers order through Orders. |
| FR-INV-6 | Consistent risk colours | ✅ Done | Stock level per product: Out of stock (red), Low stock (amber, at or below the reorder point), In stock (green) |

## 3.6 Incentives & Training

**Project decision (19 Nov 2026):** Incentives and Training were **removed from the menu**. The backend keeps the data and APIs (`GET /api/incentives`, `GET /api/training`), and training still counts in the Health Score and Copilot answers.

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-INC-1 | Forecasted incentive earnings and rank among peers | ➖ Removed | Removed from the app |
| FR-INC-2 | Progress bar per program with % to next milestone | ➖ Removed | Removed from the app (`IncentiveProgress` is still aggregated; the Copilot answers "Which incentive am I closest to?") |
| FR-INC-3 | Action to reach the next tier | ➖ Removed | Removed from the app |
| FR-INC-4 | Certifications and in-progress courses | ➖ Removed | Removed from the app (training completion is part of the Health Score) |
| FR-INC-5 | Upcoming training events and webinars | ➖ Removed | Removed from the app |
| FR-INC-6 | Invite team members to training | ➖ Removed | Removed from the app |

## 3.7 Warranty & Claims

**Project decision (19 Nov 2026):** the Warranty screen is **view only**. The dealer tracks its claims; the decision (approve, reject, reimburse) belongs to the manufacturer, so the dealer route that changed claim stages was removed. `pages/dealer/Warranty.jsx`, `GET /api/claims`, `GET /api/claims/summary`.

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-WAR-1 | Register a warranty and submit a claim with evidence | 🔧 Backend only | `POST /api/claims`; registrations are created automatically when an order is fulfilled. No claim form or photo upload on the screen yet. |
| FR-WAR-2 | Kanban board: Submitted, Under Review, Approved, Reimbursed | ✅ Done | 4 columns with counts; view only. Rejected claims are counted in the Approval Rate tile. |
| FR-WAR-3 | Card: Claim ID, SKU, Amount and Age | 🟡 Partly | One line per card: Claim ID, amount, days in the current stage (paid date once reimbursed). The **SKU and product show on hover** only (simplified on request). |
| FR-WAR-4 | Metrics: Open Claims, Avg Resolution Time, Approval Rate | ✅ Done | Open Claims (with aging count), Avg. Resolution (filing to decision, last 12 months), Approval Rate (last 12 months) |
| FR-WAR-5 | Notify when a claim ages past a threshold (10 days) | 🟡 Partly | Home tile, Home AI insight, bell, Dealer 360 recommendation, and a red border on the board. The 10 days is set in code and can't yet be changed without a code change. |

## 3.8 Sales Coach

**Project decision (19 Nov 2026):** Sales Coach was **removed from the menu**. It works on customer opportunities, and the app is dealer ↔ manufacturer only. The opportunity data and `GET /api/opportunities` are kept.

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-SC-1 | Customer brief for an opportunity | ➖ Removed | Removed from the app (no end customers) |
| FR-SC-2 | Recommended product bundle with rationale | ➖ Removed | Removed from the app |
| FR-SC-3 | Win-probability score | ➖ Removed | Removed from the app |
| FR-SC-4 | Draft proposal document | ➖ Removed | Removed from the app |
| FR-SC-5 | Competitive positioning guidance | ➖ Removed | Removed from the app |

---

## 6. Non-functional requirements

| Area | Status | Notes |
|---|---|---|
| 6.1 Performance (2 s pages, 1.5 s Copilot) | 🟡 Partly | Pages and Copilot answers return well under a second locally; not load-tested |
| 6.2 Security: role-based access | ✅ Done | Checked in the backend on every route; dealer and manufacturer users separated; dealers can't approve their own orders or change their own claims' stages; tests |
| 6.2 Security: encryption | 🟡 Partly | Passwords hashed (bcrypt), httpOnly session cookie. HTTPS and encryption at rest come with deployment. |
| 6.2 Security: audit log of write actions | ✅ Done | Orders, quotes, approvals, claims and logins in `AuditLog` |
| 6.2 Security: AI guardrails service | ➖ Platform | See FR-COP-7 |
| 6.3 Availability (99.5%), degraded mode | ➖ Platform | Orders and data screens don't depend on the Copilot |
| 6.4 Scalability (10,000 users) | ➖ Platform | SQLite for the demo; designed to move to PostgreSQL |
| 6.5 Usability | ✅ Done | Built to the UI design; responsive down to phone width |
| 6.6 Privacy: minimise PII in AI logs | ✅ Done | Copilot question text is not stored; no external AI service |
| 6.7 Maintainability: configurable weights and roles | ✅ Done | Health Score weights and role permissions are database data |
| 6.8 AI explainability | ✅ Done | Every score, insight and recommendation shows its evidence |

---

## Delivered beyond the SRS

| Item | Why |
|---|---|
| **Manufacturer Order Approvals** (separate manufacturer login) | Requested by the project lead: dealers send orders to the manufacturer, which approves or rejects them with a reason |
| **Fixed 2-year demo dataset** with linked records | Requirement for the client demo (`dealer-app-backend/prisma/demo.db`) |
| **In-house AI** (no third-party service) | Project decision (see README) |
| **74 automated tests** and `db:verify` | Data accuracy, aggregation and Copilot correctness |

## Known limitations
- **Date drift:** calculations use the real date, while the demo data ends on 15 Nov 2026. A demo-date setting is proposed.
- **Production config** still has mock data switched on (`dealer-app-frontend/src/config/prod.js`).
- **Removed from the app by project decision:** Incentives & Training and Sales Coach (menu items removed; backend data and APIs kept), the Inventory forecast screen and reorder, and claim decisions by the dealer.
- **Warranty:** no claim form or photo upload yet (FR-WAR-1); the board is view only.
