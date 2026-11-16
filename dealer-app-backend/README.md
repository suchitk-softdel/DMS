# Dealer App – Backend

Node.js API for the Dealer App: Express 5, Prisma 7 and SQLite, with 2 years of fixed demo data
(manufacturer + 6 dealers, in `prisma/demo.db`). Requirements: [`docs/SRS.md`](../docs/SRS.md) (SRS v1.0).

## Setup

Prerequisites: Node.js 22+.

```bash
npm install            # also generates the Prisma client
cp .env.example .env   # then set SESSION_SECRET (see the comment in the file)
npm run dev            # http://localhost:4000/api, restarts on file changes
```

No database setup is needed: the demo data is already in the project (see below).

Then start the frontend (`cd ../dealer-app-frontend && npm run dev`) and sign in with a demo
account. The frontend's dev server forwards `/api` requests here.

| Command              | Purpose                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `npm run dev`        | Start the API with auto-restart                                  |
| `npm start`          | Start the API                                                    |
| `npm run db:reset`   | Put the original demo data back (removes entries made in the app; stop the API first) |
| `npm run db:verify`  | Check record links, aggregates and both models' expected outputs |
| `npm run db:migrate` | After editing `prisma/schema.prisma`: create and apply a migration |
| `npm run db:studio`  | Browse the database in the browser (Prisma Studio)               |
| `npm run db:view`    | Write all tables to `db-view.html` and open it                   |

### The demo database

**`prisma/demo.db` is a ready-made database with 2 years of fixed demo data, committed to git.**
Nothing is generated on anyone's machine:

- On first start, the API copies `prisma/demo.db` to `dev.db` (your working copy, not committed).
- Everything you do in the app (new orders, claims) goes into `dev.db`. `demo.db` never changes.
- `npm run db:reset` (or deleting `dev.db`) gives you the original demo data back, e.g. before a
  client demo.

The data is fixed: there is no data generator in the project.

## Demo accounts

All use the password `demo123`.

| Email                 | Role                 | Dealership                       |
| --------------------- | -------------------- | -------------------------------- |
| `principal@demo.com`  | Dealer Principal     | Summit Comfort Heating & Air     |
| `sales@demo.com`      | Sales Representative | Summit Comfort Heating & Air     |
| `tech@demo.com`       | Service Technician   | Summit Comfort Heating & Air     |
| `principal2@demo.com` | Dealer Principal     | Coastal Climate Solutions        |

`principal2` belongs to a different dealership, for testing that dealers can't see each other's
data. Every dealership also has its own staff accounts (same password), in the `User` table.

## The demo dataset

`prisma/demo.db` holds 2 years of connected data, **1 Nov 2024 – 15 Nov 2026**, for the fictional
manufacturer **Aerovance Climate Systems** and its 6 dealers:

| Data                   | Amount | Notes                                                        |
| ---------------------- | ------ | ------------------------------------------------------------ |
| Dealers / staff users  | 6 / 35 | Different regions, tiers, sizes and growth                   |
| Products               | 40     | AC, heat pumps, furnaces, air handlers, thermostats, IAQ, parts |
| Customers              | 390    | Residential and commercial, in each dealer's own cities      |
| Purchase orders        | ~1,045 | Plus ~350 quotes; 2,276 order lines                          |
| Warranty registrations | 1,475  | One per equipment unit on a fulfilled order line             |
| Warranty claims        | 100    | Each linked to its registered unit and the original order    |
| Inventory              | 240    | Stock per dealer and product                                 |
| Audit log              | 2,967  | Every order/quote created and moved on, every claim filed and moved on |
| Incentives / training / opportunities | 4 / 12 / 186 |                                              |

**How records link:** Manufacturer → Dealer → Customer; Order → Order line → Warranty
registration → Claim. `db:verify` checks every link.

**Source vs computed.** Monthly sales (`Sale`) and incentive progress are **computed** from the
transactions by `src/services/aggregationService.js`, and computed again after every order change
in the app. A new order therefore shows up straight away in
revenue, trends, the forecast and incentives, exactly like the dataset's orders.

**The two models** are checked against fixed results in `prisma/dataset/expected-outputs.json`
(as of the dataset end date):
- **Dealer Health Score** (`healthScoreService.js`): Summit 77, Coastal 78, Prairie 41, ...
- **Demand Forecast** (`forecastService.js`): expected units for the next 30 days and stock-out
  risk. Summit is flagged for furnaces FN-H96-80 and FN-S80-80.

If a logic change alters these, `db:verify` fails and lists the differences. Check that the change
was intended, then save the new results with `npm run db:verify -- --update`.

Built-in business patterns:
- **Seasons:** air conditioners peak in summer; furnaces peak in winter, with a strong
  November–December pre-season.
- **Dealers differ:** Summit (the demo dealer) grows ~10% a year, Prairie Air declines ~15%,
  Lakeside joined in September 2025.
- **Inventory risk:** Summit is low on furnaces going into winter and overstocked on some air
  conditioners.
- **Claims:** open claims in every kanban stage, some waiting more than 10 days (FR-WAR-5 alert).

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
| POST   | `/orders`                    | orders        | New quote/order: `{ type, customerId, status?, items: [{ productId, quantity }] }` |
| PATCH  | `/orders/:id/status`         | orders        | Next status `{ status }`; fulfilling registers the equipment units |
| GET    | `/customers`                 | orders        | Own customers; `search`, `limit`               |
| GET    | `/sales`                     | dealer360     | Monthly sales per product; `from`, `to` (YYYY-MM) |
| GET    | `/sales/monthly`             | dealer360     | Monthly totals; `from`, `to`                    |
| GET    | `/inventory`                 | inventory     | Stock per product                               |
| GET    | `/claims`                    | warranty      | Claims with `ageDays`; filter `stage`           |
| POST   | `/claims`                    | warranty      | File a claim `{ registrationId, amount, description }` |
| PATCH  | `/claims/:id/stage`          | warranty      | Next kanban stage `{ stage }`                   |
| GET    | `/registrations`             | warranty      | Registered units; `search` (serial or customer) |
| GET    | `/incentives`                | incentives    | Programs, progress, next milestone, peer rank   |
| GET    | `/training`                  | incentives    | Courses, upcoming events, certifications        |
| GET    | `/opportunities`             | salesCoach    | Sales opportunities; filter `stage`             |

Status changes only move forward (e.g. an order goes draft → submitted → approved → fulfilled).
Every write is recorded in the audit log.

Status codes: 400 invalid input, 401 not signed in, 403 role not allowed, 404 not found.

## Folder structure

```
dealer-app-backend/
├── prisma/
│   ├── schema.prisma      # Database tables (18 models)
│   ├── migrations/        # Generated SQL migrations (committed)
│   ├── dataset/expected-outputs.json # Expected Health Score + Forecast results
│   └── demo.db            # THE ready-made demo database (committed; copied to dev.db on first start)
├── scripts/verify-dataset.js # npm run db:verify
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
│   ├── clients/           # (later) calls to the IDEP platform API Gateway
│   ├── events/            # (later) Event Bus subscribers
│   └── generated/prisma/  # Generated Prisma client (not committed; npm install creates it)
├── .env.example
└── dev.db                 # Your working database (not committed; copied from prisma/demo.db)
```

A request flows through: **route → requireAuth → requireModule → service → Prisma → SQLite**.

## How this fits the SRS

- **Development stand-in.** The SRS says the production app has no database of its own: data
  comes from the IDEP Unified Dealer Data Layer through the Integration Layer (sections 5 and 7).
  This SQLite database stands in for that until the platform APIs exist. Later, the services
  switch from Prisma to calls in `src/clients/`, and the API the frontend uses stays the same.
- **RBAC on the server** (SRS 6.2): every data route checks the role's modules. Role permissions
  are stored in the database, so they can change without a code change (SRS 6.7).
- **Audit log** (SRS 6.2): logins and every write (orders, order status, claims,
  claim stage) are recorded in the `AuditLog` table.
- **Login:** email and password for the demo. The SRS requires OAuth2 / OIDC with the
  manufacturer's identity provider (section 4.4); that replaces `/auth/login`, and the session
  cookie stays the same.
- **Moving to PostgreSQL:** change `provider` in `schema.prisma`, swap the adapter in
  `src/db/prisma.js` for `@prisma/adapter-pg`, and set `DATABASE_URL`.
- **AI is our own code (project decision).** The SRS describes Azure OpenAI; instead, all AI
  features run in this backend as our own logic on our own database. No third-party AI service,
  API, API key or AI/ML library is used. See "AI engine (planned)" below.

## AI engine (planned)

| Feature                         | Approach                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| Copilot questions (FR-COP-2)    | Detect the intent (sales, orders, claims...) and details (product, period, top-N) from the question, run the matching query, calculate, answer from a template with the evidence |
| Forecast and reorder (FR-INV)   | Seasonal formulas on the monthly sales history (same period last year + trend, and a seasonal trend model), tested on past data; reorder = forecast + safety stock − on hand − on order |
| Health Score (FR-D360-3)        | Weighted score from revenue growth, order velocity, warranty compliance and training; weights stored in the database |
| Home insight (FR-HOME-3)        | Rules over the dealer's data, e.g. stock below reorder point before the season |
| Sales Coach (FR-SC-1 to 3)      | Rules and scoring over opportunity, customer and product data            |

## Not done yet

- **More write endpoints:** approve reorders, invite to training. The frontend doesn't call the
  new order and claim endpoints yet.
- **AI engine:** the features in the table above (no endpoints yet).
- **Tests:** an automated test suite (the endpoints were checked manually with a smoke-test
  script).
- **Login hardening:** rate limiting on `/auth/login`.
