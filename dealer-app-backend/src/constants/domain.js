// Allowed values for status-like fields. SQLite has no enums, so these lists
// are the single source of truth (see prisma/schema.prisma).

// Module keys: must match dealer-app-frontend/src/constants/modules.js.
export const MODULES = Object.freeze({
  HOME: 'home',
  DEALER_360: 'dealer360',
  ORDERS: 'orders',
  // Dealer sells its stock to customers at its own price (Place Orders).
  PLACE_ORDERS: 'placeOrders',
  INVENTORY: 'inventory',
  INCENTIVES: 'incentives',
  WARRANTY: 'warranty',
  SALES_COACH: 'salesCoach',
  // Manufacturer side: approve or reject dealer orders. Only the
  // manufacturer role has it.
  ORDER_APPROVALS: 'orderApprovals',
})

export const ORDER_TYPES = Object.freeze(['quote', 'order'])
export const ORDER_STATUSES = Object.freeze(['draft', 'submitted', 'approved', 'rejected', 'accepted', 'declined', 'fulfilled']) // FR-ORD-3
export const CLAIM_STAGES = Object.freeze(['submitted', 'underReview', 'approved', 'reimbursed', 'rejected']) // FR-WAR-2
export const OPPORTUNITY_STAGES = Object.freeze(['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'])

// Allowed next statuses / stages, so records only move forward the way they
// would in the real process.
export const ORDER_TRANSITIONS = Object.freeze({
  // Orders: the dealer sends a request with quantities (submitted); the
  // manufacturer approves it and quotes catalogue prices (approved) or rejects
  // it (MANUFACTURER_DECISIONS); the dealer accepts or declines the quote, then
  // fulfils the accepted order.
  order: {
    draft: ['submitted'],
    submitted: ['approved', 'rejected'],
    approved: ['accepted', 'declined'],
    accepted: ['fulfilled'],
    rejected: [],
    declined: [],
    fulfilled: [],
  },
  quote: { draft: ['submitted'], submitted: ['approved'], approved: [] },
})
// How a customer accepted a quote (recorded by the dealer as proof).
export const ACCEPTANCE_METHODS = Object.freeze(['email', 'phone', 'signedCopy', 'inPerson'])

// Order statuses only the manufacturer can set; the dealer submits and fulfils.
export const MANUFACTURER_DECISIONS = Object.freeze(['approved', 'rejected'])

export const CLAIM_TRANSITIONS = Object.freeze({
  submitted: ['underReview'],
  underReview: ['approved', 'rejected'],
  approved: ['reimbursed'],
  reimbursed: [],
  rejected: [],
})

// Product categories that are serialised equipment: each fulfilled unit gets
// a warranty registration, and only these can have warranty claims.
export const EQUIPMENT_CATEGORIES = Object.freeze(['airConditioner', 'heatPump', 'furnace', 'airHandler'])

// Health Score component weights (FR-D360-3). They must add up to 1.
// FR-D360-6 asks for these to be configurable without a code change; until
// that admin setting exists they live here.
export const HEALTH_SCORE_WEIGHTS = Object.freeze({
  revenueGrowth: 0.3,
  orderVelocity: 0.25,
  warrantyCompliance: 0.25,
  trainingCompletion: 0.2,
})

// A claim open longer than this is "aging" (FR-WAR-5, default 10 days).
export const CLAIM_AGING_DAYS = 10
