// Allowed values for status-like fields. SQLite has no enums, so these lists
// are the single source of truth (see prisma/schema.prisma).

// Module keys: must match dealer-app-frontend/src/constants/modules.js.
export const MODULES = Object.freeze({
  HOME: 'home',
  DEALER_360: 'dealer360',
  ORDERS: 'orders',
  INVENTORY: 'inventory',
  INCENTIVES: 'incentives',
  WARRANTY: 'warranty',
  SALES_COACH: 'salesCoach',
})

export const ORDER_TYPES = Object.freeze(['quote', 'order'])
export const ORDER_STATUSES = Object.freeze(['draft', 'submitted', 'approved', 'fulfilled']) // FR-ORD-3
export const CLAIM_STAGES = Object.freeze(['submitted', 'underReview', 'approved', 'reimbursed', 'rejected']) // FR-WAR-2
export const OPPORTUNITY_STAGES = Object.freeze(['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'])
