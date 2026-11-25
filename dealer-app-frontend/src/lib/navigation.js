import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined'
import HomeOutlined from '@mui/icons-material/HomeOutlined'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined'
import PointOfSaleOutlined from '@mui/icons-material/PointOfSaleOutlined'
import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined'
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined'
import { COPILOT_PATH, MODULE_PATHS, MODULES } from '@/constants/modules'

export const NAV_RAIL_WIDTH = 248

// The destinations of the navigation rail, in the order of the UI Design
// Concept ("One App Shell, Nine Destinations"). `icon` is shown before each
// label; `badge` is a short text fallback.
//
// `key` is the module that controls access; null means every dealer role can
// open it (Copilot). Menu order also decides each role's landing page: the
// first item the role can access (see getHomePath in lib/rbac.js).
// `end: true` highlights the item only on an exact path match, for items whose
// path is a prefix of other items' paths.
export const NAV_ITEMS = [
  { id: 'home', icon: HomeOutlined, key: MODULES.HOME, label: 'Home', badge: 'H', path: MODULE_PATHS[MODULES.HOME], end: true },
  { id: 'copilot', icon: AutoAwesomeOutlined, key: null, label: 'Copilot', badge: 'AI', path: COPILOT_PATH },
  { id: 'dealer360', icon: InsightsOutlined, key: MODULES.DEALER_360, label: 'Dealer 360', badge: '360', path: MODULE_PATHS[MODULES.DEALER_360] },
  { id: 'orders', icon: ShoppingCartOutlined, key: MODULES.ORDERS, label: 'Orders', badge: 'O', path: MODULE_PATHS[MODULES.ORDERS] },
  { id: 'inventory', icon: Inventory2Outlined, key: MODULES.INVENTORY, label: 'Inventory', badge: 'I', path: MODULE_PATHS[MODULES.INVENTORY] },
  { id: 'warranty', icon: VerifiedUserOutlined, key: MODULES.WARRANTY, label: 'Warranty', badge: 'W', path: MODULE_PATHS[MODULES.WARRANTY] },
  { id: 'placeOrders', icon: PointOfSaleOutlined, key: MODULES.PLACE_ORDERS, label: 'Place Orders', badge: 'PO', path: MODULE_PATHS[MODULES.PLACE_ORDERS] },
  // Manufacturer login only (its only menu item, so also its landing page).
  { id: 'orderApprovals', icon: FactCheckOutlined, key: MODULES.ORDER_APPROVALS, label: 'Order Approvals', badge: 'OA', path: MODULE_PATHS[MODULES.ORDER_APPROVALS] },
]

