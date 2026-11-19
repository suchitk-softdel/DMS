import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined'
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined'
import HandshakeOutlined from '@mui/icons-material/HandshakeOutlined'
import HomeOutlined from '@mui/icons-material/HomeOutlined'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined'
import SchoolOutlined from '@mui/icons-material/SchoolOutlined'
import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined'
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined'
import { COPILOT_PATH, MODULE_PATHS, MODULES, TRAINING_PATH } from '@/constants/modules'

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
  { id: 'incentives', icon: EmojiEventsOutlined, key: MODULES.INCENTIVES, label: 'Incentives', badge: '$', path: MODULE_PATHS[MODULES.INCENTIVES] },
  { id: 'training', icon: SchoolOutlined, key: MODULES.INCENTIVES, label: 'Training', badge: 'T', path: TRAINING_PATH },
  { id: 'warranty', icon: VerifiedUserOutlined, key: MODULES.WARRANTY, label: 'Warranty', badge: 'W', path: MODULE_PATHS[MODULES.WARRANTY] },
  { id: 'salesCoach', icon: HandshakeOutlined, key: MODULES.SALES_COACH, label: 'Sales Coach', badge: 'SC', path: MODULE_PATHS[MODULES.SALES_COACH] },
  // Manufacturer login only (its only menu item, so also its landing page).
  { id: 'orderApprovals', icon: FactCheckOutlined, key: MODULES.ORDER_APPROVALS, label: 'Order Approvals', badge: 'OA', path: MODULE_PATHS[MODULES.ORDER_APPROVALS] },
]

