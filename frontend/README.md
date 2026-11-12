# Dealer App

A portal for an HVAC manufacturer and its dealer network. It has two sides:

- **Dealer side:** dealers track performance, orders, inventory, incentives, warranty and tasks,
  and get help from a Sales Coach and Copilot.
- **Manufacturer side:** manufacturer staff see the dealer list, sales and orders per dealer, and
  a demand forecasting page.

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

## Demo accounts

All accounts use the password **`demo123`**.

| Email                   | Role                 | Accessible modules                                              | Lands on        |
| ----------------------- | -------------------- | --------------------------------------------------------------- | --------------- |
| `admin@demo.com`        | Administrator        | Admin                                                           | `/admin`        |
| `manufacturer@demo.com` | Manufacturer         | Dashboard, Dealers (+ details), Dealer Sales, Dealer Orders, Forecasting | `/manufacturer` |
| `principal@demo.com`    | Dealer Principal     | All dealer modules (Home, Tasks, Performance, Orders, Inventory, Incentives, Warranty, Sales Coach) | `/` |
| `sales@demo.com`        | Sales Representative | Home, Tasks, Orders, Inventory, Incentives, Sales Coach         | `/`             |
| `tech@demo.com`         | Service Technician   | Home, Tasks, Warranty, Incentives                               | `/`             |

After login, each user goes to the first module in the menu that their role can access.

## Routes

| Path                              | Module key     | Page                    |
| --------------------------------- | -------------- | ----------------------- |
| `/`                               | `home`         | Dealer home             |
| `/tasks`                          | `tasks`        | Tasks                   |
| `/performance`                    | `performance`  | Performance             |
| `/orders`                         | `orders`       | Orders                  |
| `/inventory`                      | `inventory`    | Inventory               |
| `/incentives`                     | `incentives`   | Incentives              |
| `/warranty`                       | `warranty`     | Warranty                |
| `/sales-coach`                    | `salesCoach`   | Sales Coach             |
| `/manufacturer`                   | `mfgDashboard` | Manufacturer dashboard  |
| `/manufacturer/dealers`           | `dealerList`   | Dealer list             |
| `/manufacturer/dealers/:dealerId` | `dealerList`   | Dealer details          |
| `/manufacturer/sales`             | `dealerSales`  | Sales per dealer        |
| `/manufacturer/orders`            | `dealerOrders` | Orders per dealer       |
| `/manufacturer/forecasting`       | `forecasting`  | Forecasting             |
| `/admin`                          | `admin`        | Admin dashboard         |

Dealer details has no module key of its own. It uses the `dealerList` permission.

## Folder structure

```
scripts/
└── generateData.js          # (planned) seeded generator for 3–4 years of dummy data
src/
├── main.jsx                 # Redux Provider, ThemeProvider, CssBaseline, BrowserRouter
├── App.jsx                  # All routes (lazy-loaded pages); dispatches fetchRoles on mount
├── ai/                      # In-app AI (placeholders, see "AI modules (planned)")
│   ├── forecasting/         # seasonalNaive, holtWinters, backtest
│   ├── replenishment/       # replenishment (suggested order quantities)
│   └── assistant/           # tokenizer, trainingPhrases, intentClassifier,
│                            # entityExtractor, queryEngine, responder
├── config/
│   └── env.js               # Reads VITE_* environment variables
├── constants/
│   ├── modules.js           # MODULES keys, MODULE_PATHS, DEALER_DETAILS_PATH, PUBLIC_PATHS
│   └── roles.js             # ROLES ids, DEALER_ROLES
├── data/                    # Hardcoded data. Only services/dataService.js may import these files
│   ├── dealers.js
│   ├── roles.js             # Role → permitted module keys
│   └── users.js
├── services/
│   └── dataService.js       # Promise-based data access (mock now, API later). getOrders,
│                            # getSales, getProducts, getClaims, getTasks return [] for now
├── store/
│   ├── store.js             # configureStore + localStorage persistence via store.subscribe
│   └── slices/
│       ├── authSlice.js     # login thunk, logout
│       ├── rolesSlice.js    # fetchRoles thunk, togglePermission
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
│   ├── dealer/              # Home, Tasks, Performance, Orders, Inventory, Incentives,
│   │                        # Warranty, SalesCoach
│   ├── manufacturer/        # ManufacturerDashboard, DealerList, DealerDetails,
│   │                        # DealerSales, DealerOrders, Forecasting
│   └── admin/               # AdminDashboard
└── theme/
    └── theme.js             # MUI theme + statusColors and riskColors maps
```

Imports use the `@` alias for `src/` (for example `import { ROLES } from '@/constants/roles'`).
The alias is set in `vite.config.js` and `jsconfig.json`, so VS Code can follow it too.

## Architecture decisions

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
the module to roles. Because permissions are already Redux state, the planned admin permission
matrix can use the existing `togglePermission` reducer.

### MUI wrapper components

Screens are built from small wrappers in `components/ui/` (`PageHeader`, `KpiTile`,
`StatusChip`, `RiskBadge`, `ProgressBar`, `DataTable`) instead of raw MUI each time. This keeps
the look consistent (for example, status and risk colors always come from `statusColors` and
`riskColors` in the theme), keeps page code short, and lets the upcoming UI design be applied in
one place instead of on every screen.

#### Where a reusable component goes

| If the component…                                                 | Put it in                                      |
| ----------------------------------------------------------------- | ---------------------------------------------- |
| is generic with no business terms (chip, tile, table)             | `components/ui/`                               |
| combines ui pieces into a common layout (filters, chart card)     | `components/patterns/`                         |
| knows about dealers, orders, forecasts (e.g. `DealerSelect`)      | `features/<feature>/components/` (planned)     |
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

## AI modules (planned)

Both AI features will run entirely in the browser on the app's own data. No external AI services
or APIs are used. Today `src/ai/` contains only placeholders: each file exports its final
function signature with a `TODO` describing the algorithm and returns an empty/neutral value, so
the app builds and nothing breaks if it's called early.

### 1. Forecasting + replenishment (`src/ai/forecasting/`, `src/ai/replenishment/`)

Goal: forecast each dealer's required quantity for next **November and December** from past
years' monthly data, then suggest order quantities.

| File                             | Function                   | Planned approach                                                  |
| -------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| `forecasting/seasonalNaive.js`   | `seasonalNaiveForecast`    | Same month last year (optionally growth-adjusted); the baseline   |
| `forecasting/holtWinters.js`     | `holtWintersForecast`      | Triple exponential smoothing (level + trend + 12-month season)    |
| `forecasting/backtest.js`        | `backtest`                 | Hold out last year's Nov–Dec; MAE / MAPE / RMSE to pick a model   |
| `replenishment/replenishment.js` | `suggestOrderQuantities`   | Forecast + safety stock − on hand − on order, rounded to pack size |

Pipeline: `getSales()` → monthly series per dealer/product → backtest both models → forecast
Nov–Dec with the more accurate one → `suggestOrderQuantities()` → Forecasting page.

### 2. Q&A assistant (`src/ai/assistant/`)

Goal: answer questions about profit, sales, claims and orders using intent classification and
calculations on the hardcoded data. This will power the Copilot panel.

| File                  | Function             | Role in the pipeline                                            |
| --------------------- | -------------------- | --------------------------------------------------------------- |
| `tokenizer.js`        | `tokenize`           | Normalise text: lowercase, strip punctuation, stop words, synonyms |
| `trainingPhrases.js`  | `getTrainingPhrases` | Example questions per intent                                    |
| `intentClassifier.js` | `classifyIntent`     | Naive Bayes / TF-IDF classifier trained on the phrases          |
| `entityExtractor.js`  | `extractEntities`    | Dealer, product, time period, metric, top-N                     |
| `queryEngine.js`      | `runQuery`           | Filter + aggregate the data for the intent, scoped to the user's role |
| `responder.js`        | `composeResponse`    | Template-based natural-language answer                          |

Pipeline: question → `tokenize` → `classifyIntent` + `extractEntities` → `runQuery` →
`composeResponse`.

### Data needed

Both features need several years of history. `scripts/generateData.js` will generate 3–4 years
of seeded (reproducible) data in `src/data/`, with HVAC seasonality: summer and winter peaks and
a strong November–December pre-season. The `getOrders`, `getSales`, `getProducts`, `getClaims`
and `getTasks` functions in `dataService.js` will then return that data instead of `[]`.

## Known limitations / next steps

- **Hardcoded login.** Demo credentials are part of the client bundle and there is no real
  authentication, token or session expiry. Replace this with backend auth (and preferably
  httpOnly cookies) before any real use. The persisted user in `localStorage` is not a security
  boundary, and the backend must enforce permissions too.
- **Permissions reset on reload.** Roles are loaded from hardcoded data on every start, so
  changes made with `togglePermission` are not saved.
- **No tests yet.** Next steps: Vitest + React Testing Library for `rbac.js`, the slices,
  `dataService.js` and `ProtectedRoute`, then Playwright for login and role-based navigation.
- **Placeholder screens.** All module pages use `ComingSoon` until the UI design arrives. The
  search field, notification count and Copilot replies are placeholders too.
- **No transactional data yet.** Orders, sales, products, claims and tasks return empty arrays
  until `scripts/generateData.js` is implemented. The AI modules are placeholders.
- **API endpoints are assumptions.** The `TODO(api)` paths in `dataService.js` must be matched
  to the real API contract.
- **Folder structure.** Folders are currently grouped by type (`pages/`, `components/`,
  `store/slices/`). As modules grow, this may move to feature-based folders (for example
  `features/orders/` holding the page, slice, service calls and components for that feature).
- **Plain JavaScript.** Consider moving to TypeScript as the domain models settle.
