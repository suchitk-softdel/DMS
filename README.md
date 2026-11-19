# Dealers App

The dealer-facing web app of Softdel's **Intelligent Dealer Ecosystem Platform (IDEP)**. HVAC
dealers use it to send orders to their manufacturer, see their product stock, track warranty claims
and follow their performance, with an in-house AI Copilot.

- **Requirements:** [`docs/SRS.md`](docs/SRS.md) (SRS v1.0) is the main document.
- **Project decision:** all AI features (Copilot, Health Score, Forecast, insights) are **our own
  code in the backend**. No third-party AI service, API, key or AI library is used
  (see [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md), sections 7–9).

## Tech stack

| Part     | Technology                                                        |
| -------- | ----------------------------------------------------------------- |
| Frontend | React 19, Vite, Redux Toolkit, React Router, MUI                  |
| Backend  | Node.js 22, Express 5, Prisma 7                                   |
| Database | SQLite for development and demos (PostgreSQL-ready via Prisma)    |
| Auth     | Session in an httpOnly cookie; role-based access checked on the server |

## Repository layout

| Folder                                         | What it is                                   |
| ---------------------------------------------- | -------------------------------------------- |
| [`dealer-app-frontend/`](dealer-app-frontend/) | The web app (screens, navigation, roles)     |
| [`dealer-app-backend/`](dealer-app-backend/)   | The API, database, demo data and AI logic    |
| [`docs/`](docs/)                               | SRS and requirements documents               |

Each app folder is its own project, with its own `package.json`, `.env` and `node_modules`. The
README inside each folder has the details.

## Quick start

Prerequisites: **Node.js 22+**. Use two terminals.

```bash
# Terminal 1: backend
cd dealer-app-backend
npm install
cp .env.example .env      # then set SESSION_SECRET
npm run dev               # http://localhost:4000/api

# Terminal 2: frontend
cd dealer-app-frontend
npm install
npm run dev               # http://localhost:5173
```

No database setup is needed: on first start the backend copies the ready-made demo database
(`dealer-app-backend/prisma/demo.db`).

### Demo logins

All use the password `demo123`.

| Email                 | Role                 | Dealership                   |
| --------------------- | -------------------- | ---------------------------- |
| `principal@demo.com`  | Dealer Principal     | Summit Comfort Heating & Air |
| `sales@demo.com`      | Sales Representative | Summit Comfort Heating & Air |
| `tech@demo.com`       | Service Technician   | Summit Comfort Heating & Air |
| `principal2@demo.com` | Dealer Principal     | Coastal Climate Solutions    |
| `manufacturer@demo.com` | Manufacturer Order Desk | Aerovance (sees only **Order Approvals**) |

Each role sees only its own modules, and each dealer sees only its own data.

## Demo data

The app runs on **2 years of fixed, connected demo data** (1 Nov 2024 – 15 Nov 2026) for the
fictional manufacturer **Aerovance Climate Systems** and its 6 dealers. All names are fictional.

| Data                   | Amount  |
| ---------------------- | ------- |
| Dealers / users        | 6 / 35 dealer users + 1 manufacturer user |
| Products / customers   | 40 / 390 |
| Purchase orders        | ~1,045 (plus ~350 quotes) |
| Warranty registrations | 6,432   |
| Warranty claims        | 100     |
| Audit log entries      | 2,967   |

- **Connected:** Claim → Warranty registration → Order line → Purchase order → Customer → Dealer
  → Manufacturer.
- **Fixed:** the data is never regenerated, so everyone works on the same records.
- **Live on top:** orders and claims entered in the app are processed by the same aggregation
  logic. `npm run db:reset` (in the backend) restores the original data.
- **Checked:** `npm run db:verify` (in the backend) validates every link, the aggregated totals
  and the model outputs against expected results.

## Modules and status

| Module (SRS)                     | Status                                                         |
| -------------------------------- | -------------------------------------------------------------- |
| Login and role-based access      | ✅ Done                                                        |
| Home dashboard (3.1)             | ✅ Done: KPIs, AI insight, quick actions, recent activity      |
| Orders (3.4)                     | ✅ Done: order requests to the manufacturer (quantities only), status groups, search, sorting, quote acceptance, fulfilment, banners for requests and quotes. Dealer ↔ manufacturer only (no end customers); `npm test` |
| Warranty & Claims (3.7)          | ✅ Done (view only): Open Claims, Avg. Resolution and Approval Rate tiles, 4-stage claims board. The manufacturer decides claims; no claim form yet |
| Inventory (3.5)                  | ✅ Done (product list): stock levels per product, search and filters. Not connected to orders (project decision) |
| Incentives & Training (3.6)      | ➖ Removed from the menu (project decision); backend data and API kept |
| Dealer 360 (3.3)                 | ✅ Done: tiles, revenue trend, explainable Health Score (weights in the database), recommendations with evidence, timeline; `npm test` |
| Dealer Copilot (3.2)             | ✅ Done: in-house question engine, answers from the 2-year data with evidence; `npm test` |
| Sales Coach (3.8)                | ➖ Removed from the menu: it is customer-based and the app is dealer ↔ manufacturer only; backend data and API kept |
| Order Approvals (manufacturer)   | ✅ Done: the dealer sends an order request with quantities; the manufacturer approves it and sends a quote at catalogue prices (or rejects it with a reason); the dealer accepts or declines the quote, then fulfils. Only the manufacturer login sees this tab; `npm test` |

## More information

- [Backend README](dealer-app-backend/README.md): API endpoints, database, demo data, scripts
- [Frontend README](dealer-app-frontend/README.md): structure, configuration, roles
- [Demo data](docs/DEMO_DATA.md): how the 2-year manufacturer and dealer data is built and linked
- [Requirement traceability](docs/REQUIREMENT_TRACEABILITY.md): status of every SRS requirement and where it is implemented
- [Demo script](docs/DEMO_SCRIPT.md): 10-minute client demo, step by step
- [SRS v1.0](docs/SRS.md): full requirements
