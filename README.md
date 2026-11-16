# DMS – IDEP Dealer App

The dealer-facing app of Softdel's Intelligent Dealer Ecosystem Platform (IDEP). Dealers use it to
manage orders and quotes, inventory, incentives and training, warranty claims and sales
opportunities, with an AI Copilot on every screen.

Requirements: [`docs/SRS.md`](docs/SRS.md) (SRS v1.0) is the main document, with one project
decision: **all AI features are our own code in the backend. No third-party AI service, API or
key is used** (approach from [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md), sections 7–9).

| Folder                                         | What it is                                          | Status                                  |
| ---------------------------------------------- | --------------------------------------------------- | --------------------------------------- |
| [`dealer-app-frontend/`](dealer-app-frontend/) | React 19 + Vite + Redux Toolkit + MUI web app       | Architecture done; screens are placeholders |
| [`dealer-app-backend/`](dealer-app-backend/)   | Node.js API: Express + Prisma + SQLite              | Login and read APIs with 3 years of demo data |
| [`docs/`](docs/)                               | Requirements and project documents                  |                                         |

Each app folder is its own project with its own `package.json`, `.env` and `node_modules`. See
the README inside each folder for details.

## Quick start

Prerequisites: Node.js 22+. Use two terminals.

```bash
# Terminal 1: backend
cd dealer-app-backend
npm install
cp .env.example .env      # then set SESSION_SECRET
                          # demo data is ready: copied from prisma/demo.db on first start
npm run dev               # http://localhost:4000/api

# Terminal 2: frontend
cd dealer-app-frontend
npm install
npm run dev               # http://localhost:5173
```

Demo logins (password `demo123`): `principal@demo.com`, `sales@demo.com`, `tech@demo.com`.
