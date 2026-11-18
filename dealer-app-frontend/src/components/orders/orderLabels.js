// Shared labels for the Orders & Quotes screens.

export const CATEGORY_LABELS = Object.freeze({
  airConditioner: 'Air conditioners',
  heatPump: 'Heat pumps',
  furnace: 'Gas furnaces',
  airHandler: 'Air handlers',
  thermostat: 'Thermostats & controls',
  indoorAirQuality: 'Indoor air quality',
  parts: 'Service parts',
})

export const TYPE_LABELS = Object.freeze({ order: 'Order', quote: 'Quote' })

// The dealer's next step for an order or quote, and its button. Must match
// ORDER_TRANSITIONS in the backend (src/constants/domain.js). A submitted
// ORDER has no dealer step: the manufacturer approves or rejects it.
export const NEXT_STEP = Object.freeze({
  order: {
    draft: { status: 'submitted', label: 'Send to manufacturer' },
    approved: { status: 'fulfilled', label: 'Mark fulfilled' },
  },
  // A quote is accepted by the CUSTOMER; the dealer records it with proof.
  quote: {
    draft: { status: 'submitted', label: 'Send to customer' },
    submitted: { status: 'approved', label: 'Customer accepted' },
  },
})

export const STEPS = Object.freeze({
  order: ['draft', 'submitted', 'approved', 'fulfilled'],
  quote: ['draft', 'submitted', 'approved'],
})

export const STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  fulfilled: 'Fulfilled',
})

// What each status means for orders and for quotes (shown on chips and steps).
const TYPE_STATUS_LABELS = {
  order: { submitted: 'Sent to manufacturer' },
  quote: { submitted: 'Sent to customer', approved: 'Accepted by customer' },
}
export const statusLabel = (type, status) => TYPE_STATUS_LABELS[type]?.[status] ?? STATUS_LABELS[status] ?? status

// How a customer accepted a quote. Must match ACCEPTANCE_METHODS in the backend.
export const ACCEPTANCE_METHODS = Object.freeze([
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'signedCopy', label: 'Signed copy' },
  { value: 'inPerson', label: 'In person' },
])
export const acceptanceLabel = (method) => ACCEPTANCE_METHODS.find((m) => m.value === method)?.label.toLowerCase() ?? method

// Quick reasons offered when the manufacturer rejects an order.
export const REJECTION_REASONS = Object.freeze([
  'Out of stock',
  'Credit hold',
  'Pricing error',
  'Duplicate order',
  'Product discontinued',
])
