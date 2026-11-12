# Dealer App – Frontend

The dealer-facing app of Softdel's Intelligent Dealer Ecosystem Platform (IDEP). Dealers use it to
manage orders and quotes, inventory, incentives and training, warranty claims and sales
opportunities, with an AI Copilot available on every screen.

**Requirements:** [`docs/SRS.md`](../docs/SRS.md) (SRS v1.0) defines the scope. Manufacturer and
executive screens (AI Channel Command Center, Digital Twin) and admin tools are out of scope for
this app and are built separately.

**Current stage:** application architecture only. The pages are placeholders (`ComingSoon`). There
is no backend yet: all data is hardcoded in `src/data/` and the app state lives in Redux.

Tech stack: React 19, Vite, Redux Toolkit, React Router, MUI (Material UI). Styling uses MUI
components and the `sx` prop only. There is no custom CSS.

## Setup

Prerequisites: Node.js 20.19+ (or 22.12+) and npm.

```bash
npm install
cp .env.example .env   # optional: the app defaults to mock data without it
npm run dev            # http://localhost:5173
```

Other scripts:

| Command           | Purpose                           |
| ----------------- | --------------------------------- |
| `npm run build`   | Production build into `dist/`     |
| `npm run preview` | Serve the production build        |
| `npm run lint`    | Run ESLint                        |

### Environment variables

| Variable             | Default | Description                                                    |
| -------------------- | ------- | -------------------------------------------------------------- |
| `VITE_USE_MOCK_DATA` | `true`  | `true` reads hardcoded data; `false` calls the API             |
| `VITE_API_BASE_URL`  | (empty) | Base URL of the backend API, used when mock data is turned off |

All variables are read in `src/config/env.js`. Don't read `import.meta.env` anywhere else.

## Roles and demo accounts

The three login roles are the dealer user classes from SRS section 2.3. All accounts use the
password **`demo123`**.

| Email                | Role                 | Accessible modules                                                           |
| -------------------- | -------------------- | ---------------------------------------------------------------------------- |
| `principal@demo.com` | Dealer Principal     | All modules                                                                  |
| `sales@demo.com`     | Sales Representative | Home, Orders & Quotes, Inventory, Incentives & Training, Sales Coach         |
| `tech@demo.com`      | Service Technician   | Home, Warranty & Claims, Incentives & Training (limited sales data, per SRS) |

Every role lands on Home after login, and every role can open the Copilot.

The SRS doesn't define the full access matrix yet (open item in section 8.2), so the module
access above is a working assumption. It is defined in `src/data/roles.js`.

## Routes

| Path           | Module key   | Page                   | SRS section |
| -------------- | ------------ | ---------------------- | ----------- |
| `/`            | `home`       | Home / Dashboard       | 3.1         |
| `/dealer-360`  | `dealer360`  | Dealer 360             | 3.3         |
| `/orders`      | `orders`     | Orders & Quotes        | 3.4         |
| `/inventory`   | `inventory`  | Inventory Intelligence | 3.5         |
| `/incentives`  | `incentives` | Incentives & Training  | 3.6         |
| `/warranty`    | `warranty`   | Warranty & Claims      | 3.7         |
| `/sales-coach` | `salesCoach` | Sales Coach            | 3.8         |

The Dealer Copilot (SRS 3.2) is a side panel (`components/layout/CopilotPanel.jsx`), not a route.

## Folder structure

```
scripts/
└── generateData.js          # (planned) seeded generator for 3–4 years of mock data
src/
├── main.jsx                 # Redux Provider, ThemeProvider, CssBaseline, BrowserRouter
├── App.jsx                  # All routes (lazy-loaded pages); dispatches fetchRoles on mount
├── config/
│   └── env.js               # Reads VITE_* environment variables
├── constants/
│   ├── modules.js           # MODULES keys, MODULE_PATHS, PUBLIC_PATHS
│   └── roles.js             # ROLES ids
├── data/                    # Hardcoded data. Only services/dataService.js may import these files
│   ├── dealers.js           # Dealer profiles (name, tier, region)
│   ├── roles.js             # Role → permitted module keys
│   └── users.js
├── services/
│   └── dataService.js       # Promise-based data access (mock now, API later). getOrders,
│                            # getSales, getProducts, getClaims return [] for now
├── store/
│   ├── store.js             # configureStore + localStorage persistence via store.subscribe
│   └── slices/
│       ├── authSlice.js     # login thunk, logout
│       ├── rolesSlice.js    # fetchRoles thunk (read-only)
│       └── uiSlice.js       # navOpen, copilotOpen
├── lib/
│   ├── navigation.js        # Menu config: key, label, path, icon, end (exact-match highlight)
│   ├── rbac.js              # canAccess, getHomePath, usePermissions
│   └── format.js            # formatNumber, formatCurrency, formatPercent, formatDate
├── routes/
│   └── ProtectedRoute.jsx   # Auth, roles-loading and permission guard
├── layouts/
│   └── MainLayout.jsx       # NavRail + TopBar + Outlet (in an ErrorBoundary) + CopilotPanel
├── components/
│   ├── common/              # ErrorBoundary, PageLoader
│   ├── layout/              # NavRail, TopBar, CopilotPanel
│   ├── ui/                  # Primitives: ComingSoon, PageHeader, KpiTile, StatusChip,
│   │                        # RiskBadge, ProgressBar, DataTable
│   └── patterns/            # Composites built from ui/: FilterBar, ChartCard, KpiGrid,
│                            # SectionCard, AsyncContent, EmptyState, ConfirmDialog
├── pages/
│   ├── Login.jsx, Unauthorized.jsx, NotFound.jsx
│   └── dealer/              # Home, Dealer360, Orders, Inventory, Incentives, Warranty,
│                            # SalesCoach
└── theme/
    └── theme.js             # MUI theme + statusColors and riskColors maps
```

Imports use the `@` alias for `src/` (for example `import { ROLES } from '@/constants/roles'`).
The alias is set in `vite.config.js` and `jsconfig.json`, so VS Code can follow it too.

## Architecture decisions

### A thin presentation layer (SRS section 5)

The app only displays data and collects input. All data, AI results and enterprise-system access
come from the backend, which sits in front of the platform's Integration Layer. The app never
talks to ERP, CRM or other enterprise systems directly, and never computes AI results itself.

### A `dataService` layer between the UI and the data

`services/dataService.js` is the only module that touches `src/data/`. Every function returns a
Promise, even for hardcoded data, so callers are already written for asynchronous data. When the
backend is ready, only the `!env.useMockData` branches in this one file need to change (they are
marked `TODO(api)` and already have `fetch` calls). Slices and components stay the same. Mock
responses are deep-copied and slightly delayed, so loading states show up and nothing can change
the source data by accident.

### Redux Toolkit for app state

The user session, role permissions and UI state such as the drawers are needed across the whole
app, so they live in one predictable store. Redux Toolkit removes most of the usual Redux
boilerplate. `createSlice` lets reducers use Immer-style updates, and `createAsyncThunk` gives
every request standard `pending/fulfilled/rejected` states. Side effects stay out of reducers:
the logged-in user is saved to `localStorage` by a `store.subscribe` listener in `store.js`.

### Config-driven RBAC

Access is described by data, not by `if (role === ...)` checks scattered through components:

- each role in `data/roles.js` lists the module keys it may open;
- `lib/navigation.js` lists the modules in menu order;
- `lib/rbac.js` combines the two: `canAccess()` checks a module and `getHomePath()` picks the
  landing page. Components use the `usePermissions()` hook.

The same rules control the navigation menu, the route guards (`ProtectedRoute`) and the
post-login redirect, so these can't fall out of sync. To add a module, add a key to
`constants/modules.js`, add an entry to `navigation.js`, add a page route in `App.jsx`, and grant
the module to roles. Permissions are read-only in this app: the Manufacturer Administrator
manages them in separate admin tooling (SRS 2.3), and the backend must enforce them too.

### MUI wrapper components

Screens are built from small wrappers in `components/ui/` (`PageHeader`, `KpiTile`,
`StatusChip`, `RiskBadge`, `ProgressBar`, `DataTable`) instead of raw MUI each time. This keeps
the look consistent (for example, status and risk colors always come from `statusColors` and
`riskColors` in the theme, as FR-ORD-4 and FR-INV-6 require), keeps page code short, and lets the
shared Design System (SRS 2.5) be applied in one place instead of on every screen.

#### Where a reusable component goes

| If the component…                                                 | Put it in                                      |
| ----------------------------------------------------------------- | ---------------------------------------------- |
| is generic with no business terms (chip, tile, table)             | `components/ui/`                               |
| combines ui pieces into a common layout (filters, chart card)     | `components/patterns/`                         |
| knows about orders, claims, incentives (e.g. `ClaimCard`)         | `features/<feature>/components/` (planned)     |
| is used by only one page                                          | next to that page until a second page needs it |

Rules for `ui/` and `patterns/`:

- **No Redux or `dataService` imports.** Data comes in through props; events go out through
  callbacks. Pages or feature hooks own data loading and filter state.
- **Theme first.** Put colours, radius and default props in `theme/theme.js`. Only write a
  wrapper when it adds behaviour or a simpler API.
- **Handle every state.** Data views support `loading`, `error` and `empty`, usually through
  `AsyncContent`.
- **Format values through `lib/format.js`** so numbers, money, percentages and dates look the
  same everywhere.
- **Chart-library independent.** `ChartCard` takes the chart as `children`, so the chart library
  can change without editing pages.
- **Give a component its own folder when it grows** (`DataTable/DataTable.jsx` + `index.js`).
  Avoid one big barrel file that re-exports everything.

### Other production basics

- **Lazy loading:** every page is loaded with `React.lazy`, so each route is a separate chunk.
  `Suspense` shows an MUI `CircularProgress` while a chunk loads.
- **Error boundaries:** one wraps the whole app and another wraps the page `Outlet`. A crashing
  page shows a "Reload page" message while the navigation stays usable. The page boundary resets
  when you navigate to another route.

## AI features

Per the SRS, all AI runs in the platform's AI Intelligence Layer (Azure OpenAI with RAG,
forecasting, scoring and a Guardrails service), reached through the backend. The app only
displays the results. Every AI result must show the evidence behind it (SRS 6.8), and core
features must keep working if the AI layer is down (SRS 6.3).

| Feature in the app                         | Comes from the AI layer        | SRS            |
| ------------------------------------------ | ------------------------------ | -------------- |
| Copilot answers, suggested prompts         | RAG over the dealer's own data | FR-COP-2, 3, 5 |
| Home AI insight banner                     | Insight generation             | FR-HOME-3      |
| Health Score and its recommendations       | Scoring                        | FR-D360-3, 4   |
| Likely-to-close quotes                     | Scoring                        | FR-ORD-5       |
| Demand forecast, reorder recommendations   | Forecasting                    | FR-INV-2 to 4  |
| Incentive earnings forecast                | Forecasting                    | FR-INC-1, 3    |
| Customer brief, bundles, win probability   | Agents / scoring               | FR-SC-1 to 3   |

## Known limitations / next steps

- **Hardcoded login.** Demo credentials are part of the client bundle and there is no real
  authentication, token or session expiry. The SRS requires OAuth2 / OIDC through the
  manufacturer's identity provider (section 4.4). The persisted user in `localStorage` is not a
  security boundary, and the backend must enforce permissions too.
- **RBAC matrix not final.** Module access per role is an assumption until SRS open item 8.2 is
  resolved. Action-level rules (for example, who may approve a reorder) aren't modelled yet.
- **No tests yet.** Next steps: Vitest + React Testing Library for `rbac.js`, the slices,
  `dataService.js` and `ProtectedRoute`, then Playwright for login and role-based navigation.
- **Placeholder screens.** All module pages use `ComingSoon` until the UI design is applied. The
  search field, notification count and Copilot replies are placeholders too.
- **No transactional data yet.** Orders, sales, products and claims return empty arrays until
  `scripts/generateData.js` is implemented.
- **API endpoints are assumptions.** The `TODO(api)` paths in `dataService.js` must be matched
  to the real API contract.
- **Tech stack.** The SRS lists Next.js; this app uses Vite. Confirm with the architecture team.
- **Not yet covered:** WCAG 2.1 AA review (SRS 4.1), the mobile app (SRS 2.4) and audit logging
  of write actions (done by the backend, SRS 6.2).
- **Folder structure.** Folders are currently grouped by type (`pages/`, `components/`,
  `store/slices/`). As modules grow, this may move to feature-based folders (for example
  `features/orders/` holding the page, slice, service calls and components for that feature).
- **Plain JavaScript.** Consider moving to TypeScript as the domain models settle.
