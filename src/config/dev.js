// Settings for `npm run dev` and `npm run build:dev`.
// Bundled into browser code: never put secrets here.
const development = {
  apiBaseUrl: 'http://localhost:4000/api',
  useMockData: true,
  showDemoAccounts: true,
  enableReduxDevTools: true,
}

export default development
