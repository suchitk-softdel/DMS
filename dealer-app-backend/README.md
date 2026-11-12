# Dealer App – Backend

**Status:** folder structure only. There is no `package.json` or code yet. Each folder holds a
`.gitkeep` file so Git tracks it while it is empty.

**Requirements:** [`docs/SRS.md`](../docs/SRS.md) (SRS v1.0). The SRS lists Node.js in the target
stack (section 2.5).

## What this backend is

A **backend-for-frontend (BFF)** for the Dealer App. It sits between the app and the IDEP
platform:

```
Dealer App (frontend)  →  this backend  →  IDEP Integration Layer (API Gateway, Event Bus, Identity)
                                              ├── Unified Dealer Data Layer
                                              ├── AI Intelligence Layer (RAG, forecasting, scoring, guardrails)
                                              └── Enterprise systems (ERP, CRM, Inventory, Warranty...)
```

What the SRS means for this backend:

- **No database of its own.** The Dealer App "does not maintain its own system of record"
  (section 7). Data is read from and written to the Unified Dealer Data Layer through the API
  Gateway.
- **No direct enterprise connections.** ERP, CRM and other systems are reached only through the
  Integration Layer (sections 2.5 and 4.3).
- **Identity via OAuth2 / OIDC** with the manufacturer's identity provider (section 4.4).
- **Enforces RBAC** for the three dealer roles on every request (sections 2.3 and 6.2).
- **Audit-logs every write** (orders, claims, reorders) (section 6.2).
- **AI results come from the AI layer**, already screened by Guardrails (FR-COP-7). The backend
  streams Copilot answers to the app (first token within 1.5 s, section 6.1).
- **Degraded mode:** orders and claims keep working when the AI layer is down (section 6.3).
- **Real-time updates:** subscribes to the Event Bus for order and inventory changes and passes
  them to the app (section 4.4).

The frontend expects this API at `http://localhost:4000/api`. Set `VITE_USE_MOCK_DATA=false` in
`dealer-app-frontend/.env` to call it instead of the frontend's hardcoded data.

## Folder structure

```
dealer-app-backend/
├── src/
│   ├── server.js          # (planned) entry point: starts the HTTP server on PORT
│   ├── app.js             # (planned) app setup: CORS, JSON parsing, routes, error handler
│   ├── config/            # Reads environment variables (gateway URL, OIDC settings...)
│   ├── routes/            # URL → controller mapping, one file per SRS module
│   ├── controllers/       # Read the request, call a service, send the response
│   ├── services/          # Business logic per module: combine and shape platform data
│   ├── clients/           # Calls to the IDEP platform: API Gateway, AI layer, identity
│   ├── events/            # Event Bus subscribers (order status, inventory changes)
│   ├── middlewares/       # Auth (OIDC session), RBAC check, audit log, error handling
│   ├── validators/        # Request body and query validation
│   ├── mocks/             # Mock platform responses for development (USE_MOCKS=true)
│   └── utils/             # Shared helpers
├── tests/
├── .env.example
└── .gitignore
```

A request flows through: **route → middleware (auth, RBAC) → controller → service → client →
IDEP platform**.

## API endpoints the frontend already calls

These come from `dealer-app-frontend/src/services/dataService.js` (marked `TODO(api)` there).
They are placeholders, so agree on the final contract before building them.

| Method | Path                    | Purpose                                   |
| ------ | ----------------------- | ----------------------------------------- |
| POST   | `/api/auth/login`       | Log in (to be replaced by the OIDC flow)  |
| GET    | `/api/roles`            | Roles and their permitted modules         |
| GET    | `/api/dealers/:id`      | The signed-in dealer's profile            |
| GET    | `/api/orders?dealerId=` | Orders                                    |
| GET    | `/api/sales?dealerId=`  | Sales                                     |
| GET    | `/api/products`         | Product catalogue                         |
| GET    | `/api/claims?dealerId=` | Warranty claims                           |

The full API for all SRS modules (quotes, reorders, incentives, training, Copilot, Sales Coach)
still needs to be designed. The SRS build phases (section 8.1) suggest starting with Home,
Copilot and Warranty & Claims (Phase 1).

## Decisions still open

- Framework: Express (simple, flexible) or NestJS (more structure, TypeScript-first)
- REST or GraphQL towards the API Gateway (the SRS allows both, section 4.4)
- Session handling: an httpOnly session cookie after the OIDC login is recommended over storing
  tokens in `localStorage`
- Final RBAC matrix, including who may approve reorders (SRS open item 8.2)
