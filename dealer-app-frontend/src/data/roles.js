import { MODULES } from '@/constants/modules'
import { ROLES } from '@/constants/roles'

// Hardcoded role definitions. Only services/dataService.js may import this file.
// The final RBAC matrix is still an open item in SRS v1.0 section 8.2; this
// is a working assumption based on the user classes in section 2.3.
export const roles = [
  {
    id: ROLES.PRINCIPAL,
    name: 'Dealer Principal',
    // Oversees overall performance, incentives and strategic decisions.
    permissions: [
      MODULES.HOME,
      MODULES.DEALER_360,
      MODULES.ORDERS,
      MODULES.INVENTORY,
      MODULES.INCENTIVES,
      MODULES.WARRANTY,
      MODULES.SALES_COACH,
    ],
  },
  {
    id: ROLES.SALES_REP,
    name: 'Sales Representative',
    // Primary daily user: quotes, orders, Copilot and Sales Coach.
    permissions: [
      MODULES.HOME,
      MODULES.ORDERS,
      MODULES.INVENTORY,
      MODULES.INCENTIVES,
      MODULES.SALES_COACH,
    ],
  },
  {
    id: ROLES.TECHNICIAN,
    name: 'Service Technician',
    // Warranties and claims; limited access to sales data.
    permissions: [MODULES.HOME, MODULES.WARRANTY, MODULES.INCENTIVES],
  },
]
