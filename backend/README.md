# Dealer App – Backend

**Status:** folder structure only. The framework (for example Express or NestJS) and the
database haven't been chosen yet, so there is no `package.json` or code. Each folder holds a
`.gitkeep` file so Git tracks it while it is empty.

The frontend already expects this API at `http://localhost:4000/api`. Set
`VITE_USE_MOCK_DATA=false` in `frontend/.env` to call it instead of the hardcoded data.

## Folder structure

```
backend/
├── src/
│   ├── server.js          # (planned) entry point: starts the HTTP server on PORT
│   ├── app.js             # (planned) app setup: CORS, JSON body parsing, routes, error handler
│   ├── config/            # Reads environment variables (PORT, DATABASE_URL, JWT_SECRET...)
│   ├── routes/            # URL → controller mapping, one file per resource
│   ├── controllers/       # Read the request, call a service, send the response
│   ├── services/          # Business logic; no HTTP objects here
│   ├── models/            # Database models / schemas
│   ├── middlewares/       # Auth (JWT), role/permission check (RBAC), error handling
│   ├── validators/        # Request body and query validation
│   ├── utils/             # Shared helpers
│   └── db/
│       ├── migrations/    # Database schema changes
│       └── seeds/         # Demo data (can reuse scripts/generateData.js from the frontend)
├── tests/
├── .env.example
└── .gitignore
```

A request flows through: **route → middleware → controller → service → model → database**.

## API endpoints the frontend already calls

These come from `frontend/src/services/dataService.js` (marked `TODO(api)` there). They are
placeholders, so agree on the final contract before building them.

| Method | Path                    | Purpose                              |
| ------ | ----------------------- | ------------------------------------ |
| POST   | `/api/auth/login`       | Log in, return user + token          |
| GET    | `/api/roles`            | Roles and their permitted modules    |
| GET    | `/api/dealers`          | Dealer list                          |
| GET    | `/api/dealers/:id`      | One dealer                           |
| GET    | `/api/orders?dealerId=` | Orders, optionally for one dealer    |
| GET    | `/api/sales?dealerId=`  | Sales, optionally for one dealer     |
| GET    | `/api/products`         | Product catalogue                    |
| GET    | `/api/claims?dealerId=` | Warranty claims                      |
| GET    | `/api/tasks?dealerId=`  | Tasks                                |

## Decisions still open

- Framework: Express (simple, flexible) or NestJS (more structure, TypeScript-first)
- Database: PostgreSQL / MySQL (relational, fits orders and sales well) or MongoDB
- Authentication: JWT in an httpOnly cookie is recommended over `localStorage`
- The backend must enforce role permissions itself; checks in the frontend are not security
