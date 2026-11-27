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
| `npm test`           | Copilot and Dealer 360 tests: answers and figures checked against independently calculated values for every dealer |
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

There are two roles: **Dealer** (every dealer screen) and **Manufacturer** (Order Approvals,
Order Details, Claim Insights).

| Email                   | Role         | Organization                    |
| ----------------------- | ------------ | ------------------------------- |
| `dealer@demo.com`       | Dealer       | Summit Comfort Heating & Air    |
| `dealer2@demo.com`      | Dealer       | Coastal Climate Solutions       |
| `manufacturer@demo.com` | Manufacturer | Aerovance Climate Systems       |

`dealer2` belongs to a different dealership, for testing that dealers can't see each other's
data. Every dealership also has its own staff accounts (same password, role Dealer), in the
`User` table, e.g. `sales@demo.com` and `tech@demo.com` at Summit Comfort.

## The demo dataset

`prisma/demo.db` holds 2 years of connected data, **1 Nov 2024 – 15 Nov 2026**, for the fictional
manufacturer **Aerovance Climate Systems** and its 6 dealers:

| Data                   | Amount | Notes                                                        |
| ---------------------- | ------ | ------------------------------------------------------------ |
| Dealers / staff users  | 6 / 35 | Different regions, tiers, sizes and growth; plus 1 manufacturer user (order desk) |
| Products               | 40     | AC, heat pumps, furnaces, air handlers, thermostats, IAQ, parts |
| Customers              | 390    | Residential and commercial, in each dealer's own cities      |
| Purchase orders        | ~1,045 | Plus ~350 quotes; 2,276 order lines                          |
| Warranty registrations | 6,432  | One per equipment unit on a fulfilled order line             |
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
| GET    | `/notifications`             | signed in     | Bell notifications: manufacturer = orders waiting for approval; dealer = orders approved/rejected in the last 7 days, aging claims, products about to run short (only for modules the role can open) |
| GET    | `/manufacturer/orders/summary` | orderApprovals (manufacturer) | Waiting count and value, oldest waiting, approved/rejected in 30 days, counts per queue, waiting per dealer |
| GET    | `/manufacturer/orders`       | orderApprovals (manufacturer) | Orders of the manufacturer's dealers; `queue` (pending, approved, rejected, fulfilled), `dealerId`, `search`, `limit`, `offset` |
| GET    | `/manufacturer/orders/:id`   | orderApprovals (manufacturer) | One dealer order with lines, dealer and customer |
| POST   | `/manufacturer/orders/:id/approve` | orderApprovals (manufacturer) | Approve a submitted order |
| POST   | `/manufacturer/orders/:id/reject`  | orderApprovals (manufacturer) | Reject a submitted order: `{ reason }` (required, shown to the dealer) |
| GET    | `/dealers/:id`               | signed in     | Own dealer profile (403 for other dealers)      |
| GET    | `/products`                  | signed in     | Product catalogue                               |
| GET    | `/orders`                    | orders        | `{ total, items }`; filters `type`, `status`, `search`, `limit` (max 500), `offset`; sort `sort` (createdAt, total, id, customer, status) and `dir` (asc, desc) |
| GET    | `/orders/summary`            | orders        | Counts per status, open orders, orders awaiting approval, and the Order Insight: open quotes likely to close, each with its chance and evidence |
| GET    | `/orders/:id`                | orders        | One order with lines and customer               |
| POST   | `/orders`                    | orders        | New quote/order: `{ type, customerId, status?, items: [{ productId, quantity }] }` |
| PATCH  | `/orders/:id/status`         | orders        | Next status `{ status }`; fulfilling registers the equipment units. Accepting a quote also needs `acceptance: { method: email/phone/signedCopy/inPerson, contact, note? }` (proof of the customer's acceptance). Approving or rejecting an order is the manufacturer's (403 for dealers). |
| GET    | `/customers`                 | orders        | Own customers; `search`, `limit`               |
| GET    | `/dealer360`                 | dealer360     | Dealer 360 page in one call: tiles, 24-month revenue trend, Health Score breakdown, recommendations with evidence, timeline |
| GET    | `/sales`                     | dealer360     | Monthly sales per product; `from`, `to` (YYYY-MM) |
| GET    | `/sales/monthly`             | dealer360     | Monthly totals; `from`, `to`                    |
| GET    | `/inventory`                 | inventory     | Product list with price and stock               |
| GET    | `/claims`                    | warranty      | Claims with `ageDays` (days in stage); filter `stage` |
| GET    | `/claims/summary`            | warranty      | Open claims, aging, avg. resolution, approval rate |
| POST   | `/claims`                    | warranty      | File a claim `{ registrationId, amount, description }` |
| GET    | `/registrations`             | warranty      | Registered units; `search` (serial or customer) |
| GET    | `/incentives`                | incentives    | Programs, progress, next milestone, peer rank   |
| GET    | `/training`                  | incentives    | Courses, upcoming events, certifications        |
| GET    | `/opportunities`             | salesCoach    | Sales opportunities; filter `stage`             |
| POST   | `/copilot/ask`               | signed in     | Copilot answer: `{ question, context? }` → text, table, evidence, actions, suggestions, context (each answer checks the module its data comes from) |

Status changes only move forward (e.g. an order goes draft → submitted → approved → fulfilled).
Every write is recorded in the audit log.

Status codes: 400 invalid input, 401 not signed in, 403 role not allowed, 404 not found.

## Folder structure

```
dealer-app-backend/
├── prisma/
│   ├── schema.prisma      # Database tables (19 models)
│   ├── migrations/        # SQL migrations (committed), applied with prisma migrate deploy
│   ├── dataset/expected-outputs.json # Expected Health Score + Forecast results (db:verify)
│   └── demo.db            # THE ready-made demo database (committed; copied to dev.db on first start)
├── scripts/
│   ├── reset-demo.js      # npm run db:reset (copy demo.db to dev.db again)
│   ├── verify-dataset.js  # npm run db:verify (links, aggregates, model outputs)
│   └── db-view.js         # npm run db:view (HTML snapshot of the database)
├── tests/                 # npm test (node:test, on a temporary copy of demo.db)
│   ├── copilot.test.js    # Copilot answers vs independent calculations, roles, follow-ups
│   ├── dealer360.test.js  # Tiles, trend, Health Score + weights, recommendations, timeline
│   ├── orders.test.js     # Order list, status groups, request → quote → accept → fulfil
│   └── manufacturer.test.js # Real HTTP API: logins, who can approve, reject/decline reasons
├── prisma.config.ts       # Prisma CLI settings
├── src/
│   ├── server.js          # Entry point
│   ├── app.js             # Express setup and route mounting
│   ├── config/env.js      # Reads .env (port, database, session secret); all optional
│   ├── constants/domain.js# Statuses, allowed steps (ORDER_TRANSITIONS), module keys, weights
│   ├── db/prisma.js       # Shared Prisma client (SQLite adapter); copies demo.db on first start
│   ├── routes/
│   │   ├── auth.js        # Login, logout, current user, roles
│   │   ├── dealerData.js  # Dealer users only: home, dealer360, orders, claims, Copilot, ...
│   │   ├── manufacturer.js# Manufacturer order desk: requests, approve & quote, reject
│   │   └── notifications.js # Bell notifications (dealer or manufacturer)
│   ├── services/          # Business logic per module: orders, manufacturer approvals,
│   │                      #   dealer360, Health Score, forecast, aggregation, notifications,
│   │                      #   home, claims, incentives, training, auth, audit log, ...
│   ├── copilot/           # In-house AI: vocabulary, trainingData, classifier, text, period,
│   │                      #   parser, facts, engine, answers, infoAnswers
│   ├── middlewares/       # requireAuth, requireDealer / requireManufacturer, requireModule, errors
│   ├── utils/             # HTTP errors, password hashing, body and query checks
│   ├── clients/, events/  # (later) IDEP platform API Gateway and Event Bus
│   └── generated/prisma/  # Generated Prisma client (not committed; npm install creates it)
├── .env.example           # Optional settings (the app runs without a .env)
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

## Dealer Copilot (in-house AI)

The Copilot (`src/copilot/`, `src/services/copilotService.js`) answers questions in the user's
own words from the dealer's own data. No third-party AI service, API key or AI library is used.

```
question → clean + fix spelling ("sles" → "sales", "yr" → "year")
         → understand: business dictionary + trained Naive Bayes classifier
         → recipe { metric, groupBy, filters, period, compare, sort, limit }
         → one generic engine runs the recipe on the database
         → answer: text + table + evidence + actions + follow-up suggestions
```

| File | Role |
| ---- | ---- |
| `copilot/vocabulary.js`   | Business dictionary: metrics, breakdowns, categories, statuses (data, not logic) |
| `copilot/trainingData.js` | Example questions the classifier learns from |
| `copilot/classifier.js`   | Naive Bayes text classifier (our own code) |
| `copilot/period.js`       | "last year", "Q3 2025", "last 6 months", "March" → exact dates |
| `copilot/parser.js`       | Question → recipe; follow-ups, comparisons, rankings, filters |
| `copilot/facts.js` + `engine.js` | Loads records and runs any recipe (filter, total, group, compare) |
| `copilot/answers.js`      | Plain-English answers with evidence; Health Score, Forecast, Incentives answers |

**What it can answer:** sales, profit, units, orders, order quantity, quotes, claims and claim
value, by any combination of product, category, customer, city, customer type, month or status,
for any period, with "compare with last year", "top N", "lowest" and follow-ups ("and the year
before?", "what about heat pumps?", "by month"). It also answers health score, stock forecast and
incentive questions.

**Teaching it more:** add words to `vocabulary.js` or example questions to `trainingData.js`.
Products, cities and customers are read from the database, so new ones are understood
automatically.

**Safety:** answers use only the signed-in dealer's data and check the role's modules (a
manufacturer user gets no dealer figures). Off-topic questions are declined, never guessed. Questions are
logged in the audit log without the question text.

**Tested:** `npm test` asks the Copilot natural-language questions for all 6 dealers and checks
each answer against values calculated independently from the raw orders and claims.

## Other in-house AI

| Feature                         | Approach                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| Forecast and reorder (FR-INV)   | Same month last year × the dealer's unit growth, compared with stock (`forecastService.js`) |
| Health Score (FR-D360-3, 6)     | Weighted score from revenue growth, order velocity, warranty compliance and training (`healthScoreService.js`). Weights are stored per manufacturer in the `HealthScoreWeight` table (default 30 / 25 / 25 / 20) and can be changed there without a code change |
| Dealer 360 recommendations (FR-D360-4) | Rules over the dealer's data (aging claims, unfinished training, stock-out risk), each tied to a Health Score component with its evidence, ordered by how many points that component is missing (`dealer360Service.js`) |
| Home insight (FR-HOME-3)        | Rules over the dealer's data, e.g. stock-out risk, aging claims (`homeService.js`) |
| Sales Coach (FR-SC-1 to 5)      | Removed from the app by project decision (customer-based); opportunity data and API kept |

## Not done yet

- **Warranty claim form:** `POST /claims` exists, but the Warranty screen is view only (no form or photo upload yet).
- **Tests:** `npm test` (74) covers the Copilot, Dealer 360, orders and manufacturer approval; other endpoints were checked with smoke-test scripts.
- **Login hardening:** rate limiting on `/auth/login`.
