import { COPILOT_PATH, MODULE_PATHS, MODULES, TRAINING_PATH } from '@/constants/modules'

export const NAV_RAIL_WIDTH = 248

// The nine destinations of the navigation rail, in the order of the UI Design
// Concept ("One App Shell, Nine Destinations"). `badge` is the short text in
// the circle before each label.
//
// `key` is the module that controls access; null means every role can open it
// (Copilot). Menu order also decides each role's landing page: the first item
// the role can access (see getHomePath in lib/rbac.js).
// `end: true` highlights the item only on an exact path match, for items whose
// path is a prefix of other items' paths.
export const NAV_ITEMS = [
  { id: 'home', key: MODULES.HOME, label: 'Home', badge: 'H', path: MODULE_PATHS[MODULES.HOME], end: true },
  { id: 'copilot', key: null, label: 'Copilot', badge: 'AI', path: COPILOT_PATH },
  { id: 'dealer360', key: MODULES.DEALER_360, label: 'Dealer 360', badge: '360', path: MODULE_PATHS[MODULES.DEALER_360] },
  { id: 'orders', key: MODULES.ORDERS, label: 'Orders & Quotes', badge: 'O', path: MODULE_PATHS[MODULES.ORDERS] },
  { id: 'inventory', key: MODULES.INVENTORY, label: 'Inventory', badge: 'I', path: MODULE_PATHS[MODULES.INVENTORY] },
  { id: 'incentives', key: MODULES.INCENTIVES, label: 'Incentives', badge: '$', path: MODULE_PATHS[MODULES.INCENTIVES] },
  { id: 'training', key: MODULES.INCENTIVES, label: 'Training', badge: 'T', path: TRAINING_PATH },
  { id: 'warranty', key: MODULES.WARRANTY, label: 'Warranty', badge: 'W', path: MODULE_PATHS[MODULES.WARRANTY] },
  { id: 'salesCoach', key: MODULES.SALES_COACH, label: 'Sales Coach', badge: 'SC', path: MODULE_PATHS[MODULES.SALES_COACH] },
]
