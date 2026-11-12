import { MODULES } from '@/constants/modules'
import { ROLES } from '@/constants/roles'

// Hardcoded role definitions. Only services/dataService.js may import this file.
export const roles = [
  {
    id: ROLES.ADMIN,
    name: 'Administrator',
    permissions: [MODULES.ADMIN],
  },
  {
    id: ROLES.MANUFACTURER,
    name: 'Manufacturer',
    permissions: [
      MODULES.MFG_DASHBOARD,
      MODULES.DEALER_LIST,
      MODULES.DEALER_SALES,
      MODULES.DEALER_ORDERS,
      MODULES.FORECASTING,
    ],
  },
  {
    id: ROLES.PRINCIPAL,
    name: 'Dealer Principal',
    permissions: [
      MODULES.HOME,
      MODULES.TASKS,
      MODULES.PERFORMANCE,
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
    permissions: [
      MODULES.HOME,
      MODULES.TASKS,
      MODULES.ORDERS,
      MODULES.INVENTORY,
      MODULES.INCENTIVES,
      MODULES.SALES_COACH,
    ],
  },
  {
    id: ROLES.TECHNICIAN,
    name: 'Service Technician',
    permissions: [MODULES.HOME, MODULES.TASKS, MODULES.WARRANTY, MODULES.INCENTIVES],
  },
]
