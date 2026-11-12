import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined'
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import { MODULE_PATHS, MODULES } from '@/constants/modules'

export const NAV_RAIL_WIDTH = 240

// Menu order also decides each role's landing page: the first item the role
// can access (see getHomePath in lib/rbac.js). Labels follow SRS v1.0 section 3.
// `end: true` highlights the item only on an exact path match, for items
// whose path is a prefix of other items' paths.
export const NAV_ITEMS = [
  {
    key: MODULES.HOME,
    label: 'Home',
    path: MODULE_PATHS[MODULES.HOME],
    icon: HomeOutlinedIcon,
    end: true,
  },
  {
    key: MODULES.DEALER_360,
    label: 'Dealer 360',
    path: MODULE_PATHS[MODULES.DEALER_360],
    icon: InsightsOutlinedIcon,
  },
  {
    key: MODULES.ORDERS,
    label: 'Orders & Quotes',
    path: MODULE_PATHS[MODULES.ORDERS],
    icon: ShoppingCartOutlinedIcon,
  },
  {
    key: MODULES.INVENTORY,
    label: 'Inventory',
    path: MODULE_PATHS[MODULES.INVENTORY],
    icon: Inventory2OutlinedIcon,
  },
  {
    key: MODULES.INCENTIVES,
    label: 'Incentives & Training',
    path: MODULE_PATHS[MODULES.INCENTIVES],
    icon: EmojiEventsOutlinedIcon,
  },
  {
    key: MODULES.WARRANTY,
    label: 'Warranty & Claims',
    path: MODULE_PATHS[MODULES.WARRANTY],
    icon: VerifiedUserOutlinedIcon,
  },
  {
    key: MODULES.SALES_COACH,
    label: 'Sales Coach',
    path: MODULE_PATHS[MODULES.SALES_COACH],
    icon: SchoolOutlinedIcon,
  },
]
