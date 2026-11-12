// Settings for `npm run dev` and `npm run build:dev`.
// Bundled into browser code: never put secrets here.
const development = {
  // Same-origin path; vite.config.js proxies it to the backend on port 4000.
  apiBaseUrl: '/api',
  // false = use dealer-app-backend (start it first). Set VITE_USE_MOCK_DATA=true
  // in .env to work on the UI without the backend.
  useMockData: false,
  showDemoAccounts: true,
  enableReduxDevTools: true,
}

export default development
