# Requirement Traceability

Status of every requirement in the SRS (`docs/SRS.md`, v1.0): what is done, what is partly done, and where it is implemented.

**Status as of:** 18 Nov 2026 · branch `feature/dealer-360-copilot`

| Mark | Meaning |
|---|---|
| ✅ Done | Built, working in the app and covered by tests or checked in the browser |
| 🟡 Partly done | Main part works; a piece is missing (explained in the notes) |
| 🔧 Backend only | Backend API or model is ready; the screen is not built yet |
| ⬜ Not started | Not built yet |
| ➖ Not applicable | Depends on the production platform, not on this app |

---

## Summary

| Module (SRS section) | Requirements | ✅ | 🟡 | 🔧 | ⬜ |
|---|---|---|---|---|---|
| 3.1 Home | 6 | 4 | 2 | 0 | 0 |
| 3.2 Dealer Copilot | 7 | 3 | 3 | 0 | 1 |
| 3.3 Dealer 360 | 6 | 5 | 1 | 0 | 0 |
| 3.4 Orders & Quotes | 6 | 5 | 0 | 0 | 0 |
| 3.5 Inventory Intelligence | 6 | 0 | 0 | 2 | 4 |
| 3.6 Incentives & Training | 6 | 0 | 0 | 3 | 3 |
| 3.7 Warranty & Claims | 5 | 0 | 1 | 2 | 2 |
| 3.8 Sales Coach | 5 | 0 | 0 | 1 | 4 |
| **Total functional** | **47** | **17** | **7** | **8** | **14** |

Done or partly done: **24 of 47 (51%)**. With backend-only items: **32 of 47 (68%)**. FR-ORD-5 was removed by project decision.

---

## 3.1 Home / Dashboard

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-HOME-1 | Greeting with dealer name, tier, region | ✅ Done | `Home.jsx` header; dealer from `GET /api/home` |
| FR-HOME-2 | KPI tiles: Revenue YTD, Health Score, Open Orders, Pending Claims, with trends | ✅ Done | `homeService.js`; tiles shown per role |
| FR-HOME-3 | One AI Insight banner with evidence and a one-click action | ✅ Done | Rules in `homeService.js` (stock-out risk, aging claims, revenue trend) |
| FR-HOME-4 | Quick actions: Create Quote, Register Warranty, Place Reorder, Submit Claim | 🟡 Partly | All four buttons exist. **Create Order** (replaces Create Quote) opens the new order request. The other three go to the Warranty and Inventory screens, which are not built yet. |
| FR-HOME-5 | Recent Activity timeline | ✅ Done | Latest orders, claims and training (`recentActivity` in `homeService.js`) |
| FR-HOME-6 | Refresh KPIs and insight each session and on a background interval | 🟡 Partly | Refreshed every time Home opens. No background interval yet. |

## 3.2 Dealer Copilot

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-COP-1 | Conversational AI available from every screen | 🟡 Partly | Copilot is its own screen in the menu (one click from anywhere), not a panel inside every screen. |
| FR-COP-2 | Natural-language answers grounded in the dealer's own data (SRS: RAG) | ✅ Done (in-house) | Project decision: built in-house, no third-party AI or RAG service (`REQUIREMENTS.md` 7–9). Classifier + business dictionary + query engine over the dealer's orders, quotes, claims, registrations, stock and training (`src/copilot/`). 42 accuracy tests. |
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

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-INV-1 | Tiles: Inventory Risk, 30-day Stock-outs, Overstock value, Forecast Accuracy | ⬜ Not started | Stock data exists; tile calculations and screen not built |
| FR-INV-2 | Demand vs. supply trend chart | ⬜ Not started | |
| FR-INV-3 | Highest-risk SKU with recommended action and impact | 🔧 Backend only | Forecast finds stock-out risks and revenue at risk (`forecastService.js`) |
| FR-INV-4 | Ranked reorder recommendations table | 🔧 Backend only | Forecast items ranked by revenue at risk |
| FR-INV-5 | Approve and trigger a reorder from a recommendation | ⬜ Not started | |
| FR-INV-6 | Consistent risk colours | ⬜ Not started | `RiskBadge` component exists |

## 3.6 Incentives & Training

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-INC-1 | Forecasted incentive earnings and rank among peers | ⬜ Not started | Earned payouts exist; forecast and rank not built |
| FR-INC-2 | Progress bar per program with % to next milestone | 🔧 Backend only | `IncentiveProgress` (aggregated from sales and training) |
| FR-INC-3 | Action to reach the next tier | ⬜ Not started | |
| FR-INC-4 | Certifications and in-progress courses | 🔧 Backend only | `trainingService.js` |
| FR-INC-5 | Upcoming training events and webinars | 🔧 Backend only | Scheduled courses in the data |
| FR-INC-6 | Invite team members to training | ⬜ Not started | |

## 3.7 Warranty & Claims

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-WAR-1 | Register a warranty and submit a claim with evidence | 🔧 Backend only | `POST /api/claims`; registrations are created automatically when an order is fulfilled. Photo upload not built. |
| FR-WAR-2 | Kanban board: Submitted, Under Review, Approved, Reimbursed | 🔧 Backend only | `GET /api/claims`, `PATCH /api/claims/:id/stage` |
| FR-WAR-3 | Card: Claim ID, SKU, Amount, Age | ⬜ Not started | Age (days in stage) is available from the API |
| FR-WAR-4 | Metrics: Open Claims, Avg Resolution Time, Approval Rate | ⬜ Not started | |
| FR-WAR-5 | Notify when a claim ages past a threshold (10 days) | 🟡 Partly | Home tile ("1 aging > 10 days"), Home AI insight and a Dealer 360 recommendation |

## 3.8 Sales Coach

| ID | Requirement (short) | Status | Implementation / notes |
|---|---|---|---|
| FR-SC-1 | Customer brief for an opportunity | 🔧 Backend only | Opportunities with budget, decision date, need (`GET /api/opportunities`) |
| FR-SC-2 | Recommended product bundle with rationale | ⬜ Not started | |
| FR-SC-3 | Win-probability score | ⬜ Not started | |
| FR-SC-4 | Draft proposal document | ⬜ Not started | |
| FR-SC-5 | Competitive positioning guidance | ⬜ Not started | Competitor is recorded on opportunities |

---

## 6. Non-functional requirements

| Area | Status | Notes |
|---|---|---|
| 6.1 Performance (2 s pages, 1.5 s Copilot) | 🟡 Partly | Pages and Copilot answers return well under a second locally; not load-tested |
| 6.2 Security: role-based access | ✅ Done | Checked in the backend on every route; dealer and manufacturer users separated; tests |
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
| **Fixed 2-year demo dataset** with linked records | Requirement for the client demo (`docs/DEMO_DATA.md`) |
| **In-house AI** (no third-party service) | Project decision (`REQUIREMENTS.md` 7–9) |
| **70 automated tests** and `db:verify` | Data accuracy, aggregation and Copilot correctness |

## Known limitations
- **Date drift:** calculations use the real date, while the demo data ends on 15 Nov 2026. A demo-date setting is proposed.
- **Production config** still has mock data switched on (`dealer-app-frontend/src/config/prod.js`).
- **Pending screens:** Inventory, Incentives & Training, Warranty & Claims, Sales Coach.
