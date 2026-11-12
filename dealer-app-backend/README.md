# Dealer App – Backend

Node.js API for the Dealer App: Express 5, Prisma 7 and SQLite, with ~3 years of generated demo
data. Requirements: [`docs/SRS.md`](../docs/SRS.md) (SRS v1.0).

## Setup

Prerequisites: Node.js 22+.

```bash
npm install            # also generates the Prisma client
cp .env.example .env   # then set SESSION_SECRET (see the comment in the file)
npm run db:setup       # creates dev.db and loads ~3 years of data (~2 seconds)
npm run dev            # http://localhost:4000/api, restarts on file changes
```

Then start the frontend (`cd ../dealer-app-frontend && npm run dev`) and sign in with a demo
account. The frontend's dev server forwards `/api` requests here.

| Command              | Purpose                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `npm run dev`        | Start the API with auto-restart                                  |
| `npm start`          | Start the API                                                    |
| `npm run db:setup`   | Create or update the database tables, then load the demo data    |
| `npm run db:seed`    | Reload the demo data (wipes all rows first)                      |
| `npm run db:migrate` | After editing `prisma/schema.prisma`: create and apply a migration |
| `npm run db:studio`  | Browse the database in the browser (Prisma Studio)               |

`db:seed` options: `npm run db:seed -- --seed 7 --years 3 --end 2026-11-12`. The same seed and
end date always produce identical data. The end date defaults to today.

## Demo accounts

All use the password `demo123`.

| Email                 | Role                 | Dealership                       |
| --------------------- | -------------------- | -------------------------------- |
| `principal@demo.com`  | Dealer Principal     | Summit Comfort Heating & Air     |
| `sales@demo.com`      | Sales Representative | Summit Comfort Heating & Air     |
| `tech@demo.com`       | Service Technician   | Summit Comfort Heating & Air     |
| `principal2@demo.com` | Dealer Principal     | Coastal Climate Solutions        |

`principal2` belongs to a different dealership, for testing that dealers can't see each other's
data.

## The demo data

`prisma/seed/generate.js` creates 3 years of data for 4 dealers:

| Data                  | Amount (approx.) | Notes                                                       |
| --------------------- | ---------------- | ----------------------------------------------------------- |
| Products              | 40               | AC, heat pumps, furnaces, air handlers, thermostats, IAQ, parts |
| Customers             | 440              | Residential and commercial                                  |
| Orders and quotes     | 2,500            | 4,000 order lines; Draft, Submitted, Approved, Fulfilled     |
| Monthly sales         | 2,000 rows       | Per dealer, product and month, from fulfilled orders         |
| Warranty registrations| 2,300            |                                                             |
| Warranty claims       | 80               | Open claims in every kanban stage                           |
| Inventory             | 160              | Stock per dealer and product                                |
| Incentive programs    | 4                | With progress and peer rank per dealer                      |
| Training courses      | 12               | Including 3 upcoming webinars                               |
| Sales opportunities   | 130              | Some with a named (fictional) competitor                    |

Built-in patterns for dashboards and AI to find:
- **Seasons:** air conditioners peak in summer; furnaces peak in winter, with a strong
  November–December pre-season.
- **Dealers differ:** Summit (the demo dealer) grows, Prairie Air declines, Lakeside joined in
  September 2025.
- **Inventory risk:** Summit is low on furnaces and cold-climate heat pumps going into winter,
  and overstocked on some air conditioners.
- **Claims:** some have been under review for more than 10 days (FR-WAR-5 alert).

All names are fictional.

## API

All paths start with `/api`. Responses are JSON; errors look like `{ "message": "..." }`.

The session is an **httpOnly cookie** (`dealer_session`), set on login. JavaScript in the
browser can't read it, which protects it from theft by malicious scripts. Data endpoints always
return the **signed-in user's own dealership**. The dealer comes from the session, never from the
request.

| Method | Path                         | Module needed | Returns                                         |
| ------ | ---------------------------- | ------------- | ----------------------------------------------- |
| GET    | `/health`                    | (public)      | `{ status: "ok" }`                              |
| POST   | `/auth/login`                | (public)      | The user; sets the session cookie               |
| POST   | `/auth/logout`               | (public)      | 204; clears the cookie                          |
| GET    | `/auth/me`                   | signed in     | The signed-in user, or 401                      |
| GET    | `/roles`                     | (public)      | Roles and their modules                         |
| GET    | `/dealers/:id`               | signed in     | Own dealer profile (403 for other dealers)      |
| GET    | `/products`                  | signed in     | Product catalogue                               |
| GET    | `/orders`                    | orders        | `{ total, items }`; filters `type`, `status`, `search`, `limit` (max 500), `offset` |
| GET    | `/orders/:id`                | orders        | One order with lines and customer               |
| GET    | `/sales`                     | dealer360     | Monthly sales per product; `from`, `to` (YYYY-MM) |
| GET    | `/sales/monthly`             | dealer360     | Monthly totals; `from`, `to`                    |
| GET    | `/inventory`                 | inventory     | Stock per product                               |
| GET    | `/claims`                    | warranty      | Claims with `ageDays`; filter `stage`           |
| GET    | `/incentives`                | incentives    | Programs, progress, next milestone, peer rank   |
| GET    | `/training`                  | incentives    | Courses, upcoming events, certifications        |
| GET    | `/opportunities`             | salesCoach    | Sales opportunities; filter `stage`             |

Status codes: 400 invalid input, 401 not signed in, 403 role not allowed, 404 not found.

## Folder structure

```
dealer-app-backend/
├── prisma/
│   ├── schema.prisma      # Database tables (17 models)
│   ├── migrations/        # Generated SQL migrations (committed)
│   ├── seed.js            # npm run db:seed: wipes and loads demo data
│   └── seed/generate.js   # The 3-year data generator
├── prisma.config.ts       # Prisma CLI settings
├── src/
│   ├── server.js          # Entry point
│   ├── app.js             # Express setup and route mounting
│   ├── config/env.js      # Reads .env (port, database, session secret)
│   ├── constants/domain.js# Allowed statuses, stages and module keys
│   ├── db/prisma.js       # Shared Prisma client (SQLite adapter)
│   ├── routes/            # auth.js (login, roles), dealerData.js (all module data)
│   ├── services/          # Database queries per module, auth, audit log
│   ├── middlewares/       # requireAuth, requireModule (RBAC), error handler
│   ├── utils/             # HTTP errors, password hashing, query checks
│   ├── clients/           # (later) calls to the IDEP platform: API Gateway, AI layer
│   ├── events/            # (later) Event Bus subscribers
│   └── generated/prisma/  # Generated Prisma client (not committed; npm install creates it)
├── .env.example
└── dev.db                 # The SQLite database (not committed; npm run db:setup creates it)
```

A request flows through: **route → requireAuth → requireModule → service → Prisma → SQLite**.

## How this fits the SRS

- **Development stand-in.** The SRS says the production app has no database of its own: data
  comes from the IDEP Unified Dealer Data Layer through the Integration Layer (sections 5 and 7).
  This SQLite database stands in for that until the platform APIs exist. Later, the services
  switch from Prisma to calls in `src/clients/`, and the API the frontend uses stays the same.
- **RBAC on the server** (SRS 6.2): every data route checks the role's modules. Role permissions
  are stored in the database, so they can change without a code change (SRS 6.7).
- **Audit log** (SRS 6.2): logins are recorded in the `AuditLog` table. Every write action
  (orders, claims, reorders) must be logged the same way once those endpoints exist.
- **Login:** email and password for the demo. The SRS requires OAuth2 / OIDC with the
  manufacturer's identity provider (section 4.4); that replaces `/auth/login`, and the session
  cookie stays the same.
- **Moving to PostgreSQL:** change `provider` in `schema.prisma`, swap the adapter in
  `src/db/prisma.js` for `@prisma/adapter-pg`, and set `DATABASE_URL`.

## Not done yet

- **Write endpoints:** create quotes and orders, submit claims, register warranties, approve
  reorders, invite to training. Each must be audit-logged.
- **AI endpoints:** Copilot chat (GPT through Azure OpenAI with guardrails), Home insight, Health
  Score, forecasts and reorder recommendations, Sales Coach briefs.
- **Tests:** an automated test suite (the endpoints were checked manually with a smoke-test
  script).
- **Login hardening:** rate limiting on `/auth/login`.
