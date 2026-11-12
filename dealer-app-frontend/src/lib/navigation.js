import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import AutoGraphOutlinedIcon from '@mui/icons-material/AutoGraphOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined'
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import { MODULE_PATHS, MODULES } from '@/constants/modules'

export const NAV_RAIL_WIDTH = 240

// Menu order also decides each role's landing page: the first item the role
// can access (see getHomePath in lib/rbac.js).
// `end: true` highlights the item only on an exact path match, for items
// whose path is a prefix of other items' paths.
export const NAV_ITEMS = [
  // Dealer side
  {
    key: MODULES.HOME,
    label: 'Home',
    path: MODULE_PATHS[MODULES.HOME],
    icon: HomeOutlinedIcon,
    end: true,
  },
  {
    key: MODULES.TASKS,
    label: 'Tasks',
    path: MODULE_PATHS[MODULES.TASKS],
    icon: AssignmentOutlinedIcon,
  },
  {
    key: MODULES.PERFORMANCE,
    label: 'Performance',
    path: MODULE_PATHS[MODULES.PERFORMANCE],
    icon: InsightsOutlinedIcon,
  },
  {
    key: MODULES.ORDERS,
    label: 'Orders',
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
    label: 'Incentives',
    path: MODULE_PATHS[MODULES.INCENTIVES],
    icon: EmojiEventsOutlinedIcon,
  },
  {
    key: MODULES.WARRANTY,
    label: 'Warranty',
    path: MODULE_PATHS[MODULES.WARRANTY],
    icon: VerifiedUserOutlinedIcon,
  },
  {
    key: MODULES.SALES_COACH,
    label: 'Sales Coach',
    path: MODULE_PATHS[MODULES.SALES_COACH],
    icon: SchoolOutlinedIcon,
  },

  // Manufacturer side
  {
    key: MODULES.MFG_DASHBOARD,
    label: 'Dashboard',
    path: MODULE_PATHS[MODULES.MFG_DASHBOARD],
    icon: DashboardOutlinedIcon,
    end: true,
  },
  {
    key: MODULES.DEALER_LIST,
    label: 'Dealers',
    path: MODULE_PATHS[MODULES.DEALER_LIST],
    icon: StorefrontOutlinedIcon,
  },
  {
    key: MODULES.DEALER_SALES,
    label: 'Dealer Sales',
    path: MODULE_PATHS[MODULES.DEALER_SALES],
    icon: BarChartOutlinedIcon,
  },
  {
    key: MODULES.DEALER_ORDERS,
    label: 'Dealer Orders',
    path: MODULE_PATHS[MODULES.DEALER_ORDERS],
    icon: LocalShippingOutlinedIcon,
  },
  {
    key: MODULES.FORECASTING,
    label: 'Forecasting',
    path: MODULE_PATHS[MODULES.FORECASTING],
    icon: AutoGraphOutlinedIcon,
  },

  // Platform
  {
    key: MODULES.ADMIN,
    label: 'Admin',
    path: MODULE_PATHS[MODULES.ADMIN],
    icon: AdminPanelSettingsOutlinedIcon,
  },
]
