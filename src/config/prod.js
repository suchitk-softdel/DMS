// Settings for `npm run build`.
// Bundled into browser code: never put secrets here.
const production = {
  // TODO: set the real API URL and switch useMockData to false once the
  // backend is live. Until then production also runs on the hardcoded data.
  apiBaseUrl: '',
  useMockData: true,
  showDemoAccounts: false,
  enableReduxDevTools: false,
}

export default production
