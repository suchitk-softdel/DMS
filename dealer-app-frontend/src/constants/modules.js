// Modules of the Dealer App, matching SRS v1.0 section 3, plus Order Approvals
// for the manufacturer's order desk (dealers send orders, the manufacturer
// approves or rejects them).
// The Dealer Copilot (FR-COP) is not a module: it is a panel available on
// every screen, so it has no key or route here.
export const MODULES = Object.freeze({
  HOME: 'home', // FR-HOME
  DEALER_360: 'dealer360', // FR-D360
  ORDERS: 'orders', // FR-ORD (orders and quotes)
  INVENTORY: 'inventory', // FR-INV
  INCENTIVES: 'incentives', // FR-INC (incentives and training)
  WARRANTY: 'warranty', // FR-WAR (warranty and claims)
  SALES_COACH: 'salesCoach', // FR-SC
  ORDER_APPROVALS: 'orderApprovals', // manufacturer login only
})

export const MODULE_PATHS = Object.freeze({
  [MODULES.HOME]: '/',
  [MODULES.DEALER_360]: '/dealer-360',
  [MODULES.ORDERS]: '/orders',
  [MODULES.INVENTORY]: '/inventory',
  [MODULES.INCENTIVES]: '/incentives',
  [MODULES.WARRANTY]: '/warranty',
  [MODULES.SALES_COACH]: '/sales-coach',
  [MODULES.ORDER_APPROVALS]: '/order-approvals',
})

// Routes that are not tied to a permission-controlled module.
export const PUBLIC_PATHS = Object.freeze({
  LOGIN: '/login',
  UNAUTHORIZED: '/unauthorized',
})

// Destinations in the navigation rail that are not separate modules:
// - Copilot is available to every role (SRS FR-COP-1), so it has no module key.
// - Training is part of the Incentives & Training module (SRS 3.6) but has its
//   own entry in the rail, as in the UI Design Concept.
export const COPILOT_PATH = '/copilot'
export const TRAINING_PATH = '/training'
