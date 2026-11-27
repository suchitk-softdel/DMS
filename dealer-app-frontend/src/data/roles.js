import { MODULES } from '@/constants/modules'
import { ROLES } from '@/constants/roles'

// Hardcoded role definitions for mock mode (VITE_USE_MOCK_DATA=true), the same
// two roles as the backend. Only services/dataService.js may import this file.
export const roles = [
  {
    id: ROLES.DEALER,
    name: 'Dealer',
    permissions: [
      MODULES.HOME,
      MODULES.DEALER_360,
      MODULES.ORDERS,
      MODULES.PLACE_ORDERS,
      MODULES.INVENTORY,
      MODULES.INCENTIVES,
      MODULES.WARRANTY,
      MODULES.SALES_COACH,
    ],
  },
  {
    id: ROLES.MANUFACTURER,
    name: 'Manufacturer',
    permissions: [MODULES.ORDER_APPROVALS],
  },
]
