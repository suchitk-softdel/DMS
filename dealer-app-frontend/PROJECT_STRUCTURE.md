# Project Structure: Dealer App

A quick map of the project and what each folder is for. Setup steps, design decisions and
limitations are in [README.md](README.md).

## At a glance

- **What:** the dealer-facing app of IDEP. Scope is defined in [docs/SRS.md](../docs/SRS.md).
- **Stack:** React 19 + Vite, Redux Toolkit, React Router, MUI. No custom CSS.
- **Data:** from dealer-app-backend through `services/dataService.js` (small mock data in `src/data/` for `VITE_USE_MOCK_DATA=true`).
- **Imports:** `@/` means `src/` (for example `@/lib/rbac`).

## Root

```
dealer-app-frontend/
├── index.html            # HTML entry
├── vite.config.js        # Vite + "@" alias + /api proxy to the backend
├── jsconfig.json         # "@" alias for VS Code
├── eslint.config.js      # Lint rules
├── .env.example          # VITE_USE_MOCK_DATA, VITE_API_BASE_URL (both optional)
├── .gitignore            # Excludes node_modules, dist, logs, .env files (keeps .env.example)
├── README.md             # Setup, architecture decisions, limitations
├── PROJECT_STRUCTURE.md  # This file
└── src/                  # Application code
```

## src/

```
src/
├── main.jsx                  # Providers: Redux, Theme, CssBaseline, Router, ErrorBoundary
├── App.jsx                   # All routes (lazy-loaded) + fetchRoles on start
│
├── config/env.js             # Reads environment variables
├── constants/
│   ├── roles.js              # ROLES (3 dealer roles)
│   └── modules.js            # MODULES, MODULE_PATHS, PUBLIC_PATHS
├── theme/theme.js            # MUI theme + statusColors, riskColors
│
├── data/                     # Hardcoded data (dealers, roles, users)
├── services/dataService.js   # The only data access layer (mock now, API later)
│
├── store/
│   ├── store.js              # Redux store + save logged-in user to localStorage
│   └── slices/               # authSlice, rolesSlice, uiSlice
│
├── lib/
│   ├── navigation.js         # Menu items (key, label, path, icon)
│   ├── rbac.js               # canAccess, getHomePath, usePermissions
│   └── format.js             # Currency, number, percent, date formatting
│
├── routes/ProtectedRoute.jsx # Login + permission guard
├── layouts/MainLayout.jsx    # NavRail + TopBar + page + CopilotPanel
│
├── components/
│   ├── common/               # ErrorBoundary, PageLoader
│   ├── layout/               # NavRail, TopBar, CopilotPanel
│   ├── ui/                   # Primitives: PageHeader, KpiTile, StatusChip, RiskBadge,
│   │                         #   ProgressBar, DataTable, ComingSoon
│   └── patterns/             # Composites: FilterBar, ChartCard, KpiGrid, SectionCard,
│                             #   AsyncContent, EmptyState, ConfirmDialog
│
└── pages/
    ├── Login, Unauthorized, NotFound
    └── dealer/               # Home, Dealer360, Orders, Inventory, Incentives,
                              #   Warranty, SalesCoach (one per SRS module)
```

## Roles and landing pages

Every demo account uses the password `demo123`.

| Login                   | Role                 | Lands on        |
| ----------------------- | -------------------- | --------------- |
| `principal@demo.com`    | Dealer Principal     | `/`             |
| `sales@demo.com`        | Sales Representative | `/`             |
| `tech@demo.com`         | Service Technician   | `/`             |

## How data and permissions flow

```
src/data/  →  dataService.js  →  Redux slices  →  pages  →  components (ui / patterns)
                                      │
                    rolesSlice  →  rbac.js  →  NavRail menu, ProtectedRoute, login redirect
```

## Where new code goes

| Adding…                          | Put it in                                         |
| -------------------------------- | ------------------------------------------------- |
| A new screen                     | `pages/dealer/`                                   |
| A new module (menu + permission) | `constants/modules.js` → `lib/navigation.js` → `App.jsx` → `data/roles.js` |
| A generic UI building block      | `components/ui/`                                  |
| A reusable layout combination    | `components/patterns/`                            |
| A new data fetch                 | `services/dataService.js` (+ a slice if shared)   |
| Number or date formatting        | `lib/format.js`                                   |
| AI results (forecasts, scores)   | Backend AI layer; the app only displays them      |
