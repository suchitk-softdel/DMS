export const MODULES = Object.freeze({
  // Dealer side
  HOME: 'home',
  TASKS: 'tasks',
  PERFORMANCE: 'performance',
  ORDERS: 'orders',
  INVENTORY: 'inventory',
  INCENTIVES: 'incentives',
  WARRANTY: 'warranty',
  SALES_COACH: 'salesCoach',
  // Manufacturer side
  MFG_DASHBOARD: 'mfgDashboard',
  DEALER_LIST: 'dealerList',
  DEALER_SALES: 'dealerSales',
  DEALER_ORDERS: 'dealerOrders',
  FORECASTING: 'forecasting',
  // Platform
  ADMIN: 'admin',
})

export const MODULE_PATHS = Object.freeze({
  [MODULES.HOME]: '/',
  [MODULES.TASKS]: '/tasks',
  [MODULES.PERFORMANCE]: '/performance',
  [MODULES.ORDERS]: '/orders',
  [MODULES.INVENTORY]: '/inventory',
  [MODULES.INCENTIVES]: '/incentives',
  [MODULES.WARRANTY]: '/warranty',
  [MODULES.SALES_COACH]: '/sales-coach',
  [MODULES.MFG_DASHBOARD]: '/manufacturer',
  [MODULES.DEALER_LIST]: '/manufacturer/dealers',
  [MODULES.DEALER_SALES]: '/manufacturer/sales',
  [MODULES.DEALER_ORDERS]: '/manufacturer/orders',
  [MODULES.FORECASTING]: '/manufacturer/forecasting',
  [MODULES.ADMIN]: '/admin',
})

// Detail routes that reuse a parent module's permission.
export const DEALER_DETAILS_PATH = '/manufacturer/dealers/:dealerId'

export const getDealerDetailsPath = (dealerId) =>
  `${MODULE_PATHS[MODULES.DEALER_LIST]}/${encodeURIComponent(dealerId)}`

// Routes that are not tied to a permission-controlled module.
export const PUBLIC_PATHS = Object.freeze({
  LOGIN: '/login',
  UNAUTHORIZED: '/unauthorized',
})
