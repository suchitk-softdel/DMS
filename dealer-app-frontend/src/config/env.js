// Single entry point for environment configuration. The rest of the app
// imports only `env` from here, never dev.js / prod.js.
//
// Selected by Vite's MODE: `npm run build` -> prod.js,
// `npm run dev` and `npm run build:dev` -> dev.js.
// (Not import.meta.env.PROD: that is true for every `vite build`, even with
// --mode development.) Only the selected file ends up in the bundle.
import development from '@/config/dev'
import production from '@/config/prod'

const isProductionMode = import.meta.env.MODE === 'production'
const config = isProductionMode ? production : development

function toBoolean(value, fallback) {
  if (value === undefined || value === '') return fallback
  return String(value).trim().toLowerCase() === 'true'
}

export const env = Object.freeze({
  appEnv: isProductionMode ? 'production' : 'development',
  isProd: isProductionMode,
  isDev: import.meta.env.DEV,
  // Optional .env overrides, e.g. a different API URL per server (see .env.example).
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? config.apiBaseUrl).replace(/\/+$/, ''),
  useMockData: toBoolean(import.meta.env.VITE_USE_MOCK_DATA, config.useMockData),
  // Google Maps JavaScript API key for the dealer map (optional; without it
  // Google shows the map greyed out, marked "for development purposes only").
  googleMapsApiKey: (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim(),
  showDemoAccounts: config.showDemoAccounts,
  enableReduxDevTools: config.enableReduxDevTools,
})
