# DMS – Dealer Management System

A portal for an HVAC manufacturer and its dealer network.

| Folder                   | What it is                                    | Status                         |
| ------------------------ | --------------------------------------------- | ------------------------------ |
| [`frontend/`](frontend/) | React 19 + Vite + Redux Toolkit + MUI web app | Architecture done, mock data   |
| [`backend/`](backend/)   | Node.js API                                   | Folder structure only          |

Each folder is its own project with its own `package.json`, `.env` and `node_modules`. See the
README inside each folder for setup.

## Quick start (frontend)

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

The frontend runs on hardcoded data until the backend exists (`VITE_USE_MOCK_DATA=true`).
