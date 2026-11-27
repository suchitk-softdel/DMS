// The ONLY module that reads from src/data or calls the backend. Every
// function returns a Promise, so components and slices don't care whether the
// data is mocked or real.
//
// VITE_USE_MOCK_DATA=true  -> small hardcoded data in src/data (no backend)
// VITE_USE_MOCK_DATA=false -> dealer-app-backend API (3 years of seeded data)
//
// Per SRS v1.0 section 5 the app is a thin presentation layer: all data,
// AI results (forecasts, scores, Copilot answers) and enterprise-system access
// come from the backend. The app never computes AI results itself.
//
// The backend always returns the signed-in user's own dealer data (taken from
// the session cookie), so no dealerId is sent with data requests.
import { env } from '@/config/env'
import { dealers } from '@/data/dealers'
import { roles } from '@/data/roles'
import { users } from '@/data/users'

const MOCK_LATENCY_MS = 300

// Resolve a deep copy after a short delay so callers can never mutate the
// hardcoded source data and loading states are visible during development.
function mockResponse(value) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(value)), MOCK_LATENCY_MS)
  })
}

function mockError(message) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), MOCK_LATENCY_MS)
  })
}

function withoutPassword(user) {
  const { password: _password, ...safeUser } = user
  return safeUser
}

// Error with the HTTP status, so callers can tell "not signed in" (401) apart
// from other failures.
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// The session is an httpOnly cookie set by the backend. Requests go to the
// same origin (Vite proxies /api in development), so the browser sends the
// cookie automatically.
async function apiRequest(path, options = {}) {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, body?.message ?? `Request failed with status ${response.status}`)
  }

  return response.status === 204 ? null : response.json()
}

function toQuery(params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value != null && value !== '')
  return entries.length ? `?${new URLSearchParams(entries)}` : ''
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

// -> { id, name, email, roleId, dealerId }
export function login(email, password) {
  if (!env.useMockData) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = users.find((u) => u.email === normalizedEmail && u.password === password)
  return user ? mockResponse(withoutPassword(user)) : mockError('Invalid email or password.')
}

export function logout() {
  if (!env.useMockData) return apiRequest('/auth/logout', { method: 'POST' })
  return Promise.resolve(null)
}

// The signed-in user according to the backend; rejects with status 401 when
// the session has expired. In mock mode there is no session to check.
export function getCurrentUser() {
  if (!env.useMockData) return apiRequest('/auth/me')
  return Promise.resolve(null)
}

// ---------------------------------------------------------------------------
// Roles: [{ id, name, permissions: [moduleKey] }]
// ---------------------------------------------------------------------------

export function getRoles() {
  if (!env.useMockData) return apiRequest('/roles')
  return mockResponse(roles)
}

// ---------------------------------------------------------------------------
// Dealer profile: { id, name, city, state, region, tier, status, territoryCoverage }
// ---------------------------------------------------------------------------

export function getDealerById(dealerId) {
  if (!env.useMockData) return apiRequest(`/dealers/${encodeURIComponent(dealerId)}`)

  const dealer = dealers.find((d) => d.id === dealerId)
  return dealer ? mockResponse(dealer) : mockError(`Dealer ${dealerId} not found.`)
}

// ---------------------------------------------------------------------------
// Home dashboard (SRS 3.1). The backend leaves out KPIs, insight and activity
// from modules the user's role can't open.
// -> { dealer, kpis: { revenueYtd?, healthScore?, openOrders?, pendingClaims? },
//      insight: { kind, message, evidence: [string], action: { label, module } } | null,
//      activity: [{ date, type: order|claimSubmitted|claimResolved, ref, amount, stage? }] }
// ---------------------------------------------------------------------------

export function getHome() {
  if (!env.useMockData) return apiRequest('/home')
  return mockResponse({ dealer: dealers[0], kpis: {}, insight: null, activity: [] })
}

// Dealer 360 (SRS 3.3) in one call.
// -> { dealer, asOf,
//      kpis: { revenue: { value, previous, changePct }, growth: { value, changeThisMonth },
//              healthScore: { value, changeThisMonth }, territoryCoverage: { value (0..1) } },
//      trend: [{ month: 'YYYY-MM', revenue, lastYear, partial }]   (last 24 months; null = no data),
//      health: { score, components: [{ key, label, weight, score, evidence }] },
//      recommendations: [{ key, title, detail, evidence: [string], component: { key, label, score },
//                          pointsMissing, action: { label, module } | null }],
//      timeline: [{ date, type, ref, amount, stage? }] }   (same events as Home activity)
export function getDealer360() {
  if (!env.useMockData) return apiRequest('/dealer360')
  return mockResponse({ dealer: dealers[0], kpis: null, trend: [], health: null, recommendations: [], timeline: [], asOf: new Date() })
}

// ---------------------------------------------------------------------------
// Module data. In mock mode these return empty results: the full 3-year
// dataset lives in the backend database.
// ---------------------------------------------------------------------------

// Products: [{ id, sku, name, category, unitPrice, packSize }]
export function getProducts() {
  if (!env.useMockData) return apiRequest('/products')
  return mockResponse([])
}

// Orders & Quotes (SRS 3.4).
// Filters: { type, status, search, limit, offset, sort: createdAt|total|id|customer|status, dir: asc|desc }
// -> { total, items: [{ id, type, status, total, createdAt, updatedAt, customer, itemCount }] }
export function getOrders(filters) {
  if (!env.useMockData) return apiRequest(`/orders${toQuery(filters)}`)
  return mockResponse({ total: 0, items: [] })
}

// -> { counts: { order: { draft, submitted, approved, fulfilled }, quote: { draft, submitted, approved } },
//      openOrders, awaitingApproval,
//      insight: { message, evidence: [string], likely: [{ id, customer, total, ageDays, probability }],
//                 cold: { count, value }, action: { label, module } } | null }
export function getOrdersSummary() {
  if (!env.useMockData) return apiRequest('/orders/summary')
  return mockResponse({
    counts: { order: { draft: 0, submitted: 0, approved: 0, fulfilled: 0 }, quote: { draft: 0, submitted: 0, approved: 0 } },
    openOrders: 0,
    awaitingApproval: 0,
    insight: null,
  })
}

// One order with its lines and customer.
export function getOrder(orderId) {
  if (!env.useMockData) return apiRequest(`/orders/${encodeURIComponent(orderId)}`)
  return mockError(`Order ${orderId} not found.`)
}

// New quote or order at list price.
// input: { type: quote|order, customerId, status: draft|submitted, items: [{ productId, quantity }] }
export function createOrder(input) {
  if (!env.useMockData) return apiRequest('/orders', { method: 'POST', body: JSON.stringify(input) })
  return mockError('Creating orders needs the backend.')
}

// Moves an order or quote to its next status (draft -> submitted -> approved -> fulfilled).
// Accepting a quote needs acceptance: { method: email|phone|signedCopy|inPerson, contact, note? }.
// Declining the manufacturer's quote on an order needs a reason.
export function updateOrderStatus(orderId, status, acceptance, reason) {
  if (!env.useMockData) {
    return apiRequest(`/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...(acceptance && { acceptance }), ...(reason && { reason }) }),
    })
  }
  return mockError('Updating orders needs the backend.')
}

// Bell notifications for the signed-in user (dealer or manufacturer).
// -> { count, items: [{ id, kind: success|info|warning|error, title, detail, at, link }] }
export function getNotifications() {
  if (!env.useMockData) return apiRequest('/notifications')
  return mockResponse({ count: 0, items: [] })
}

// ---------------------------------------------------------------------------
// Manufacturer order desk (Order Approvals). Manufacturer login only.
// ---------------------------------------------------------------------------

// -> { manufacturer: { id, name }, pending: { count, value, oldestDays }, approvedRecent, rejectedRecent,
//      recentDays, counts: { pending, approved, rejected, fulfilled }, dealers: [{ id, name, pending }] }
export function getApprovalSummary() {
  if (!env.useMockData) return apiRequest('/manufacturer/orders/summary')
  return mockError('Order Approvals needs the backend.')
}

// Filters: { queue: pending|approved|accepted|closed|fulfilled, dealerId, search, limit, offset }
// -> { total, items: [{ id, status, total, createdAt, reviewedAt, rejectionReason, dealer, customer, itemCount, units }] }
export function getNetworkOrders(filters) {
  if (!env.useMockData) return apiRequest(`/manufacturer/orders${toQuery(filters)}`)
  return mockResponse({ total: 0, items: [] })
}

export function getNetworkOrder(orderId) {
  if (!env.useMockData) return apiRequest(`/manufacturer/orders/${encodeURIComponent(orderId)}`)
  return mockError(`Order ${orderId} not found.`)
}

// Dealer claim insights (manufacturer, on Order Approvals): unusual claim patterns.
// -> { asOf, rules, network, dealers: [{ ..., score, risk, flags, recentClaims, investigation }], flaggedCount, underInvestigation }
export function getClaimInsights() {
  if (!env.useMockData) return apiRequest('/manufacturer/claim-insights')
  return mockError('Claim insights need the backend.')
}

// Open (open: true, optional note) or close an investigation of a dealer; returns the updated insights.
export function setDealerInvestigation(dealerId, open, note = null) {
  if (!env.useMockData) {
    return apiRequest(`/manufacturer/claim-insights/dealers/${encodeURIComponent(dealerId)}/investigation`, {
      method: 'POST',
      body: JSON.stringify({ open, note }),
    })
  }
  return mockError('Claim insights need the backend.')
}

export function approveOrder(orderId) {
  if (!env.useMockData) return apiRequest(`/manufacturer/orders/${encodeURIComponent(orderId)}/approve`, { method: 'POST' })
  return mockError('Approving orders needs the backend.')
}

// reason: shown to the dealer (required)
export function rejectOrder(orderId, reason) {
  if (!env.useMockData) {
    return apiRequest(`/manufacturer/orders/${encodeURIComponent(orderId)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) })
  }
  return mockError('Rejecting orders needs the backend.')
}

// The dealership's customers. { search?, limit? } -> [{ id, name, type, city }]
export function getCustomers(filters) {
  if (!env.useMockData) return apiRequest(`/customers${toQuery(filters)}`)
  return mockResponse([])
}

// Monthly sales per product. Range: { from: 'YYYY-MM', to: 'YYYY-MM' }
// -> [{ month, productId, units, revenue, cost }]
export function getSales(range) {
  if (!env.useMockData) return apiRequest(`/sales${toQuery(range)}`)
  return mockResponse([])
}

// Monthly totals for the revenue trend (FR-D360-2) -> [{ month, units, revenue, cost }]
export function getMonthlySales(range) {
  if (!env.useMockData) return apiRequest(`/sales/monthly${toQuery(range)}`)
  return mockResponse([])
}

// Place Orders: the dealer sells its stock to customers.
// -> { products: [{ productId, sku, name, category, available, status, basePrice, lastSellingPrice }],
//      recent: [{ id, product, quantity, basePrice, sellingPrice, total, profit, soldBy, createdAt }] }
export function getPlaceOrders() {
  if (!env.useMockData) return apiRequest('/place-orders')
  return mockResponse({ products: [], recent: [] })
}

// Sells one product. input: { productId, quantity, sellingPrice } -> the sale
export function placeOrder(input) {
  if (!env.useMockData) return apiRequest('/place-orders', { method: 'POST', body: JSON.stringify(input) })
  return mockError('Placing orders needs the backend.')
}

// Inventory (SRS 3.5) -> [{ onHand, onOrder, reorderPoint, updatedAt, product }]
export function getInventory() {
  if (!env.useMockData) return apiRequest('/inventory')
  return mockResponse([])
}

// Inventory dashboard -> { asOf, months, pricing, products, monthly, orders, manufacturer, insights }
// (see getInventoryOverview in the backend's inventoryService.js)
export function getInventoryOverview() {
  if (!env.useMockData) return apiRequest('/inventory/overview')
  return mockError('The Inventory dashboard needs the backend.')
}

// Warranty board tiles (FR-WAR-4)
// -> { counts, openClaims, aging, agingDays, decided, rejected, avgResolutionDays, approvalRate }
export function getClaimsSummary() {
  if (!env.useMockData) return apiRequest('/claims/summary')
  return mockResponse({ counts: {}, openClaims: 0, aging: 0, agingDays: 10, decided: 0, rejected: 0, avgResolutionDays: null, approvalRate: null })
}

// Warranty claims (SRS 3.7). Filter: { stage }
// -> [{ id, stage, amount, description, serialNumber, filedAt, ageDays, product, customer, ... }]
export function getClaims(filters) {
  if (!env.useMockData) return apiRequest(`/claims${toQuery(filters)}`)
  return mockResponse([])
}

// Register Warranty (FR-WAR-1): equipment units of fulfilled orders not registered yet.
// -> [{ orderItemId, orderId, fulfilledAt, product: { id, sku, name }, quantity, registered }]
export function getUnregisteredUnits() {
  if (!env.useMockData) return apiRequest('/registrations/pending')
  return mockResponse([])
}

// The serial number the next registered unit will get -> { serialNumber: 'SN5002946' }
export function getNextSerialNumber() {
  if (!env.useMockData) return apiRequest('/registrations/next-serial')
  return mockResponse({ serialNumber: '' })
}

// Registers one installed unit. The serial number (next SN) and the install
// date (today) are set by the system. input: { orderItemId }
// -> { id, serialNumber, orderId, installDate, warrantyUntil, product }
export function registerWarranty(input) {
  if (!env.useMockData) return apiRequest('/registrations', { method: 'POST', body: JSON.stringify(input) })
  return mockError('Registering warranties needs the backend.')
}

// Registered units to pick for a claim. Filter: { search, limit }
// -> [{ id, serialNumber, orderId, installDate, warrantyUntil, expired, openClaimId, product }]
export function getRegistrations(filters) {
  if (!env.useMockData) return apiRequest(`/registrations${toQuery(filters)}`)
  return mockResponse([])
}

// Submit Claim (FR-WAR-1). input: { registrationId, amount, description }
// The backend refuses expired warranties, a second open claim and amounts above the product price.
export function submitClaim(input) {
  if (!env.useMockData) return apiRequest('/claims', { method: 'POST', body: JSON.stringify(input) })
  return mockError('Submitting claims needs the backend.')
}

// Incentive programs with progress and peer rank (FR-INC-1, FR-INC-2).
export function getIncentives() {
  if (!env.useMockData) return apiRequest('/incentives')
  return mockResponse([])
}

// Training for the signed-in user -> { courses, upcomingEvents, certifications }
export function getTraining() {
  if (!env.useMockData) return apiRequest('/training')
  return mockResponse({ courses: [], upcomingEvents: [], certifications: [] })
}

// Dealer Copilot (SRS 3.2): the backend's in-house question engine.
// context = the previous answer's `context`, for follow-ups ("and last year?").
// -> { text, table?: { columns, rows }, evidence: [string], understood?, actions: [{ label, module }],
//      suggestions: [string], corrections: [string], context }
export function askCopilot(question, context = null) {
  if (!env.useMockData) {
    return apiRequest('/copilot/ask', { method: 'POST', body: JSON.stringify({ question, context }) })
  }
  return mockResponse({
    text: 'The Copilot needs the backend: start dealer-app-backend and set VITE_USE_MOCK_DATA=false.',
    evidence: [],
    actions: [],
    suggestions: [],
    corrections: [],
    context: null,
  })
}

// Changing a filter chip under a Copilot answer re-runs it.
// change: { metric } | { groupBy } | { period } -> the new answer
export function rerunCopilot(context, change) {
  if (!env.useMockData) return apiRequest('/copilot/rerun', { method: 'POST', body: JSON.stringify({ context, change }) })
  return mockError('The Copilot needs the backend.')
}

// The records a Copilot answer is based on -> { title, columns, rows, total }
export function getCopilotRecords(context) {
  if (!env.useMockData) return apiRequest('/copilot/records', { method: 'POST', body: JSON.stringify({ context }) })
  return mockError('The Copilot needs the backend.')
}

// Sales Coach opportunities (SRS 3.8). Filter: { stage }
export function getOpportunities(filters) {
  if (!env.useMockData) return apiRequest(`/opportunities${toQuery(filters)}`)
  return mockResponse([])
}
