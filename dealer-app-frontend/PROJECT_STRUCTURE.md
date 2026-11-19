# Project Structure: Dealers App (frontend)

A quick map of the frontend and what each folder is for. Setup steps, design decisions and
limitations are in [README.md](README.md); the API and database are in
[../dealer-app-backend/README.md](../dealer-app-backend/README.md).

## At a glance

- **What:** the web app for dealers and for the manufacturer's order desk. Scope: [docs/SRS.md](../docs/SRS.md).
- **Stack:** React 19 + Vite, Redux Toolkit, React Router, MUI (no custom CSS files).
- **Data:** live from dealer-app-backend through `services/dataService.js`. The small data in `src/data/` is only used with `VITE_USE_MOCK_DATA=true`.
- **Users:** dealer roles (Principal, Sales Rep, Technician) and the manufacturer's order desk. The app is **dealer ↔ manufacturer only** (no end customers).
- **Imports:** `@/` means `src/` (for example `@/lib/rbac`).

## Root

```
dealer-app-frontend/
├── index.html            # HTML entry (title "Dealers App", favicon)
├── public/favicon.svg    # Teal "D" logo (same artwork as the menu logo)
├── vite.config.js        # Vite + "@" alias + /api proxy to the backend (port 4000)
├── jsconfig.json         # "@" alias for VS Code
├── eslint.config.js      # Lint rules (npm run lint)
├── .env.example          # VITE_USE_MOCK_DATA, VITE_API_BASE_URL (both optional)
├── README.md             # Setup, architecture decisions, limitations
├── PROJECT_STRUCTURE.md  # This file
└── src/                  # Application code
```

## src/

```
src/
├── main.jsx                  # Providers: Redux, Theme, CssBaseline, Router, ErrorBoundary, ToastProvider
├── App.jsx                   # All routes (lazy-loaded); fetchRoles + verifySession on start
│
├── config/                   # env.js reads VITE_* variables; dev.js / prod.js defaults
├── constants/
│   ├── modules.js            # MODULES (incl. orderApprovals), MODULE_PATHS, PUBLIC_PATHS, COPILOT_PATH
│   └── roles.js              # ROLES ids
├── theme/theme.js            # MUI theme (colours, cards, tables) + statusColors, riskColors
│
├── data/                     # Small mock data (dealers, roles, users), mock mode only
├── services/dataService.js   # The only data access layer: every backend API call
│
├── store/
│   ├── store.js              # Redux store + saves the logged-in user
│   └── slices/               # authSlice, rolesSlice, uiSlice, copilotSlice (chat history)
│
├── lib/
│   ├── navigation.js         # Menu items (icon, label, path, module key)
│   ├── rbac.js               # canAccess, getHomePath, usePermissions (incl. isDealer)
│   ├── format.js             # Currency, number, percent, date formatting
│   ├── activity.js           # Activity events → timeline items (Home, Dealer 360)
│   ├── toast.js              # useToast(): short confirmation messages
│   ├── useAsyncData.js       # Load data with loading / error / reload
│   └── pageHeader.js         # usePageHeader(): title and subtitle in the top bar
│
├── routes/ProtectedRoute.jsx # Login, permission and dealer-only guard
├── layouts/
│   ├── MainLayout.jsx        # NavRail + TopBar + page (in an ErrorBoundary)
│   └── AuthLayout.jsx        # Sign-in page layout (brand panel + form)
│
├── components/
│   ├── common/               # ErrorBoundary, PageLoader, ContentSkeleton (loading shapes),
│   │                         #   ToastProvider
│   ├── layout/               # NavRail (menu + organisation card), TopBar (title, search,
│   │                         #   notifications bell, account menu), PageHeaderContext
│   ├── ui/                   # Primitives: BrandLogo, KpiTile (icon, sparkline, clickable),
│   │                         #   StatusChip, NameWithInitial, PageHeader, SectionTitle,
│   │                         #   UserAvatar, ProgressBar, RiskBadge, DataTable, ComingSoon,
│   │                         #   PasswordField
│   ├── patterns/             # Composites: KpiGrid, LineChart (own SVG chart), ActivityTimeline,
│   │                         #   CopilotAnswer, InsightCard, AsyncContent, ChartCard,
│   │                         #   SectionCard, QuickActions, FilterBar, EmptyState, ConfirmDialog
│   └── orders/               # Order screens: NewOrderDialog (request with quantities),
│                             #   OrderDrawer (dealer: steps, accept/decline quote, fulfil),
│                             #   ApprovalDrawer (manufacturer: approve & send quote / reject),
│                             #   ReasonDialog, AcceptQuoteDialog, orderLabels.js (statuses)
│
└── pages/
    ├── Login.jsx, Unauthorized.jsx, NotFound.jsx
    ├── dealer/
    │   ├── Home.jsx          # ✅ KPIs, AI insight, quick actions, recent activity
    │   ├── Copilot.jsx       # ✅ In-house AI chat with suggested prompts
    │   ├── Dealer360.jsx     # ✅ Tiles, revenue trend, Health Score, recommendations, timeline
    │   ├── Orders.jsx        # ✅ Order requests, status groups, quotes to accept, fulfilment
    │   ├── Inventory.jsx     # ⏳ Coming soon (backend ready)
    │   ├── Incentives.jsx    # ⏳ Coming soon (also the Training menu item)
    │   ├── Warranty.jsx      # ⏳ Coming soon (backend ready)
    │   └── SalesCoach.jsx    # ⏳ Coming soon (backend ready)
    └── manufacturer/
        └── OrderApprovals.jsx # ✅ Manufacturer order desk: requests, quotes, accepted, closed
```

## Roles and landing pages

Every demo account uses the password `demo123`.

| Login                   | Name             | Role                    | Lands on           |
| ----------------------- | ---------------- | ----------------------- | ------------------ |
| `principal@demo.com`    | Daniel Morgan    | Dealer Principal        | `/` (Home)         |
| `sales@demo.com`        | Priya Sharma     | Sales Representative    | `/` (Home)         |
| `tech@demo.com`         | Carlos Rivera    | Service Technician      | `/` (Home)         |
| `principal2@demo.com`   | Rachel Kim       | Dealer Principal (Coastal) | `/` (Home)      |
| `manufacturer@demo.com` | Olivia Bennett   | Manufacturer Order Desk | `/order-approvals` |

The menu shows only what each role can open; the manufacturer sees only Order Approvals.

## Order flow (dealer ↔ manufacturer)

```
Dealer: New order request (products + quantity) ─► Requested
Manufacturer: Approve & send quote (catalogue prices) ─► Quoted      (or Reject ─► Rejected)
Dealer: Accept quote ─► Accepted                                      (or Decline ─► Declined)
Dealer: Mark fulfilled ─► Fulfilled (revenue + warranty registration)
```

Screens: `pages/dealer/Orders.jsx` + `components/orders/OrderDrawer.jsx` (dealer),
`pages/manufacturer/OrderApprovals.jsx` + `components/orders/ApprovalDrawer.jsx` (manufacturer).

## How data and permissions flow

```
backend API  →  services/dataService.js  →  pages (useAsyncData) / Redux slices  →  components
                                                    │
                        rolesSlice  →  lib/rbac.js  →  NavRail menu, ProtectedRoute, login redirect
```

## Where new code goes

| Adding…                          | Put it in                                         |
| -------------------------------- | ------------------------------------------------- |
| A new dealer screen              | `pages/dealer/`                                   |
| A new manufacturer screen        | `pages/manufacturer/`                             |
| A new module (menu + permission) | `constants/modules.js` → `lib/navigation.js` → `App.jsx`, plus the role's permissions in the backend `Role` table |
| A generic UI building block      | `components/ui/`                                  |
| A reusable layout combination    | `components/patterns/`                            |
| Order-specific UI                | `components/orders/`                              |
| A new data fetch                 | `services/dataService.js`                         |
| Number or date formatting        | `lib/format.js`                                   |
| AI results (forecasts, scores, Copilot) | Backend (`dealer-app-backend/src/copilot`, `src/services`); the app only displays them |
