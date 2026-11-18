// The Copilot's business dictionary. This is DATA, not logic: to teach the
// Copilot a new word or metric, add it here. No other code needs to change.
//
// A question is turned into a "recipe":
//   { metric, groupBy, filters, period, compare, sort, limit }
// and one generic engine runs any recipe (see engine.js).

import { MODULES } from '../constants/domain.js'

// What can be calculated. `fact` is the set of records it is calculated
// from (see facts.js); `value` is summed per record (no value = count).
export const METRICS = {
  revenue: {
    label: 'sales',
    words: ['sales', 'revenue', 'turnover', 'sell', 'sold', 'selling', 'income', 'how much business', 'invoiced', 'bought', 'buy', 'buys', 'purchased', 'spent', 'spend', 'money came in', 'money in', 'money', 'takings', 'billing', 'billed'],
    fact: 'sales',
    value: (r) => r.revenue,
    format: 'money',
  },
  profit: {
    label: 'profit',
    words: ['profit', 'profits', 'margin', 'margins', 'earn', 'earned', 'earning', 'earnings', 'profitable', 'net gain', 'made a profit'],
    fact: 'sales',
    value: (r) => r.revenue - r.cost,
    format: 'money',
  },
  units: {
    label: 'units sold',
    words: ['units', 'unit', 'quantity', 'qty', 'pieces', 'volume'],
    fact: 'sales',
    value: (r) => r.units,
    format: 'number',
  },
  orderValue: {
    label: 'order value',
    words: ['order value', 'value of orders', 'order amount', 'value of my orders', 'worth of orders'],
    fact: 'orders',
    value: (r) => r.total,
    format: 'money',
  },
  avgOrderValue: {
    label: 'average order value',
    words: ['average order value', 'average order', 'average orders', 'avg order', 'aov', 'average order size', 'typical order', 'average ticket', 'average deal size'],
    fact: 'orders',
    value: (r) => r.total,
    aggregate: 'avg',
    format: 'money',
  },
  // Chosen by the parser when a question mentions orders AND quantity.
  orderUnits: {
    label: 'units on order',
    words: [],
    fact: 'orders',
    value: (r) => r.units,
    format: 'number',
  },
  orderCount: {
    label: 'orders',
    words: ['orders', 'order', 'purchase orders', 'purchase order', 'po', 'pos'],
    fact: 'orders',
    format: 'number',
  },
  quoteCount: {
    label: 'quotes',
    words: ['quotes', 'quote', 'quotations', 'quotation', 'estimates'],
    fact: 'quotes',
    format: 'number',
  },
  claimAmount: {
    label: 'claim value',
    words: ['claim amount', 'claim value', 'claims amount', 'claims value', 'value of claims', 'amount of claims', 'claimed amount', 'warranty cost'],
    fact: 'claims',
    value: (r) => r.amount,
    format: 'money',
  },
  avgClaimAmount: {
    label: 'average claim amount',
    words: ['average claim', 'average claims', 'avg claim', 'average claim amount', 'average claim value', 'typical claim', 'average warranty cost'],
    fact: 'claims',
    value: (r) => r.amount,
    aggregate: 'avg',
    format: 'money',
  },
  registrationCount: {
    label: 'installed units',
    words: ['registrations', 'registration', 'registered units', 'warranty registrations', 'installations', 'installation', 'installs', 'install', 'installed units', 'units installed', 'installed', 'registered'],
    fact: 'registrations',
    format: 'number',
  },
  claimCount: {
    label: 'claims',
    words: ['claims', 'claim', 'warranty claims', 'warranty claim', 'warranty'],
    fact: 'claims',
    format: 'number',
  },
}

// Which module a user's role needs to see each kind of record (SRS 6.2).
export const FACT_MODULE = {
  sales: MODULES.DEALER_360,
  orders: MODULES.ORDERS,
  quotes: MODULES.ORDERS,
  claims: MODULES.WARRANTY,
  registrations: MODULES.WARRANTY,
}

// What results can be split by. `facts` = where the field exists.
export const DIMENSIONS = {
  product: { label: 'product', plural: 'products', words: ['product', 'products', 'item', 'items', 'model', 'models', 'sku', 'skus'], facts: ['sales', 'claims', 'registrations'] },
  category: { label: 'category', plural: 'categories', words: ['category', 'categories', 'product type', 'product line', 'product lines'], facts: ['sales', 'claims', 'registrations'] },
  customer: { label: 'customer', plural: 'customers', words: ['customer', 'customers', 'client', 'clients', 'buyer', 'buyers', 'account', 'accounts', 'who bought', 'who buys', 'who ordered', 'who purchased', 'who spent'], facts: ['sales', 'orders', 'quotes', 'claims', 'registrations'] },
  city: { label: 'city', plural: 'cities', words: ['city', 'cities', 'location', 'locations', 'area', 'areas', 'town'], facts: ['sales', 'orders', 'quotes', 'claims', 'registrations'] },
  customerType: { label: 'customer type', plural: 'customer types', words: ['customer type', 'customer types', 'residential vs commercial', 'commercial vs residential', 'segment', 'segments'], facts: ['sales', 'orders', 'quotes', 'claims', 'registrations'] },
  month: { label: 'month', plural: 'months', words: ['month', 'months', 'monthly', 'trend', 'trends', 'over time', 'each month', 'per month', 'month wise'], facts: ['sales', 'orders', 'quotes', 'claims', 'registrations'] },
  status: { label: 'status', plural: 'statuses', words: ['status', 'statuses', 'stage', 'stages'], facts: ['orders', 'quotes', 'claims'] },
}

// Product categories (fixed by the catalogue).
export const CATEGORY_WORDS = {
  airConditioner: ['air conditioner', 'air conditioners', 'ac', 'acs', 'a/c', 'cooling'],
  heatPump: ['heat pump', 'heat pumps', 'heatpump', 'heatpumps'],
  furnace: ['furnace', 'furnaces', 'heating'],
  airHandler: ['air handler', 'air handlers'],
  thermostat: ['thermostat', 'thermostats', 'controls'],
  indoorAirQuality: ['indoor air quality', 'iaq', 'filters', 'filter', 'humidifier', 'humidifiers'],
  parts: ['parts', 'part', 'spares', 'spare parts', 'components'],
}

export const CATEGORY_LABELS = {
  airConditioner: 'Air conditioners',
  heatPump: 'Heat pumps',
  furnace: 'Furnaces',
  airHandler: 'Air handlers',
  thermostat: 'Thermostats',
  indoorAirQuality: 'Indoor air quality',
  parts: 'Parts',
}

// Record states. The same word means different statuses for orders and claims.
export const STATE_WORDS = {
  pending: { words: ['pending', 'open', 'waiting', 'outstanding', 'in progress', 'unresolved', 'not settled'], orders: ['submitted', 'approved', 'accepted'], claims: ['submitted', 'underReview'] },
  draft: { words: ['draft', 'drafts'], orders: ['draft'] },
  submitted: { words: ['submitted'], orders: ['submitted'], claims: ['submitted'] },
  underReview: { words: ['under review', 'in review', 'reviewing'], claims: ['underReview'] },
  approved: { words: ['approved', 'accepted'], orders: ['approved'], claims: ['approved'] },
  fulfilled: { words: ['fulfilled', 'completed', 'delivered', 'shipped', 'done'], orders: ['fulfilled'] },
  settled: { words: ['settled', 'reimbursed', 'paid', 'closed'], claims: ['reimbursed'] },
  rejected: { words: ['rejected', 'denied', 'declined', 'refused'], orders: ['rejected', 'declined'], claims: ['rejected'] },
}

export const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  fulfilled: 'Fulfilled',
  underReview: 'Under review',
  reimbursed: 'Reimbursed',
  rejected: 'Rejected',
}

export const CUSTOMER_TYPE_WORDS = {
  residential: ['residential', 'homeowner', 'homeowners', 'home', 'homes', 'household'],
  commercial: ['commercial', 'business customers', 'businesses', 'company', 'companies'],
}

// Words that change the shape of the answer.
export const RANKING_WORDS = ['top', 'best', 'highest', 'most', 'biggest', 'largest', 'leading', 'maximum', 'max', 'which', 'what product', 'who']
export const LOWEST_WORDS = ['lowest', 'least', 'worst', 'smallest', 'minimum', 'min', 'bottom', 'fewest']
export const COMPARE_WORDS = ['compare', 'compared', 'comparison', 'vs', 'versus', 'growth', 'grow', 'grew', 'change', 'changed', 'difference', 'than last', 'increase', 'decrease', 'up or down', 'improve', 'improved']
export const FOLLOW_UP_STARTS = ['and ', 'what about', 'how about', 'same for', 'same but', 'now ', 'also ', 'only ', 'just ']

// Words that are understood but carry no business meaning (used to tell an
// in-scope question from an out-of-scope one).
export const STOP_WORDS = new Set(
  `a an the of in on at to for from by with and or is are was were be been am do does did
   i me my mine we our us you your it its this that these those what whats which who how
   much many show tell give list get find see please can could would will shall should
   total overall all number count amount value my much last this next previous current year
   years month months week weeks day days quarter today yesterday ever time so far till
   until since between have has had any there their them they about vs`.split(/\s+/),
)
