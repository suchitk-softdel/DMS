# DMS – IDEP Dealer App

The dealer-facing web app of Softdel's **Intelligent Dealer Ecosystem Platform (IDEP)**. HVAC
dealers use it to manage orders and quotes, inventory, warranty claims, incentives and training,
and sales opportunities, with an AI Copilot on every screen.

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

Each role sees only its own modules, and each dealer sees only its own data.

## Demo data

The app runs on **2 years of fixed, connected demo data** (1 Nov 2024 – 15 Nov 2026) for the
fictional manufacturer **Aerovance Climate Systems** and its 6 dealers. All names are fictional.

| Data                   | Amount  |
| ---------------------- | ------- |
| Dealers / users        | 6 / 35  |
| Products / customers   | 40 / 390 |
| Purchase orders        | ~1,045 (plus ~350 quotes) |
| Warranty registrations | 1,475   |
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
| Orders & Quotes (3.4)            | Backend API done (list, create, status changes); screen pending |
| Warranty & Claims (3.7)          | Backend API done (list, file claim, stage changes); screen pending |
| Inventory (3.5)                  | Backend API and Forecast done; screen pending                   |
| Incentives & Training (3.6)      | Backend API done; screen pending                                |
| Dealer 360 (3.3)                 | Health Score done in the backend; screen pending                |
| Dealer Copilot (3.2)             | Screen done; in-house question engine pending                   |
| Sales Coach (3.8)                | Backend API done; screen pending                                |

## More information

- [Backend README](dealer-app-backend/README.md): API endpoints, database, demo data, scripts
- [Frontend README](dealer-app-frontend/README.md): structure, configuration, roles
- [SRS v1.0](docs/SRS.md): full requirements
