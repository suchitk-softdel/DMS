# DMS – IDEP Dealer App

The dealer-facing app of Softdel's Intelligent Dealer Ecosystem Platform (IDEP). Dealers use it to
manage orders and quotes, inventory, incentives and training, warranty claims and sales
opportunities, with an AI Copilot on every screen.

Requirements: [`docs/SRS.md`](docs/SRS.md) (SRS v1.0).

| Folder                                         | What it is                                         | Status                       |
| ---------------------------------------------- | -------------------------------------------------- | ---------------------------- |
| [`dealer-app-frontend/`](dealer-app-frontend/) | React 19 + Vite + Redux Toolkit + MUI web app      | Architecture done, mock data |
| [`dealer-app-backend/`](dealer-app-backend/)   | Node.js backend-for-frontend to the IDEP platform  | Folder structure only        |
| [`docs/`](docs/)                               | Requirements and project documents                 |                              |

Each app folder is its own project with its own `package.json`, `.env` and `node_modules`. See
the README inside each folder for setup.

## Quick start (frontend)

```bash
cd dealer-app-frontend
npm install
npm run dev   # http://localhost:5173
```

The frontend runs on hardcoded data until the backend exists (`VITE_USE_MOCK_DATA=true`).
Demo logins: `principal@demo.com`, `sales@demo.com`, `tech@demo.com` (password `demo123`).
