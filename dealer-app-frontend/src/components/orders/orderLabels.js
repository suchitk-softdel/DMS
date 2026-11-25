// Shared labels for the Orders screens (dealer order requests to the manufacturer).

export const CATEGORY_LABELS = Object.freeze({
  airConditioner: 'Air conditioners',
  heatPump: 'Heat pumps',
  furnace: 'Gas furnaces',
  airHandler: 'Air handlers',
  thermostat: 'Thermostats & controls',
  indoorAirQuality: 'Indoor air quality',
  parts: 'Service parts',
})

// The dealer's next step for an order, and its button. Must match
// ORDER_TRANSITIONS in the backend (src/constants/domain.js).
// Orders: the dealer sends a request with quantities; the manufacturer
// approves it and quotes catalogue prices (or rejects it); the dealer accepts
// or declines the quote (its own buttons), then fulfils the accepted order.
export const NEXT_STEP = Object.freeze({
  draft: { status: 'submitted', label: 'Send request to manufacturer' },
  accepted: { status: 'fulfilled', label: 'Mark fulfilled' },
})

export const STEPS = Object.freeze(['draft', 'submitted', 'approved', 'accepted', 'fulfilled'])

export const STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  accepted: 'Accepted',
  declined: 'Declined',
  fulfilled: 'Fulfilled',
})

// What each status means for an order request (shown on chips and steps).
const ORDER_STATUS_LABELS = { submitted: 'Requested', approved: 'Quoted', accepted: 'Accepted', declined: 'Declined' }

// An order has prices once the manufacturer has quoted it; before that the
// dealer only asks for quantities.
export const hasPrices = (order) => ['approved', 'accepted', 'declined', 'fulfilled'].includes(order.status)

// The type argument is kept so callers read statusLabel(order.type, status);
// every dealer order is type 'order'.
export const statusLabel = (_type, status) => ORDER_STATUS_LABELS[status] ?? STATUS_LABELS[status] ?? status
// Quick reasons offered when the manufacturer rejects an order.
export const REJECTION_REASONS = Object.freeze([
  'Out of stock',
  'Credit hold',
  'Pricing error',
  'Duplicate order',
  'Product discontinued',
])
