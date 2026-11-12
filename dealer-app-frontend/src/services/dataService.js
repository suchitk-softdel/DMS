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
// Module data. In mock mode these return empty results: the full 3-year
// dataset lives in the backend database.
// ---------------------------------------------------------------------------

// Products: [{ id, sku, name, category, unitPrice, packSize }]
export function getProducts() {
  if (!env.useMockData) return apiRequest('/products')
  return mockResponse([])
}

// Orders & Quotes (SRS 3.4). Filters: { type, status, search, limit, offset }
// -> { total, items: [{ id, type, status, total, createdAt, updatedAt, customer, itemCount }] }
export function getOrders(filters) {
  if (!env.useMockData) return apiRequest(`/orders${toQuery(filters)}`)
  return mockResponse({ total: 0, items: [] })
}

// One order with its lines and customer.
export function getOrder(orderId) {
  if (!env.useMockData) return apiRequest(`/orders/${encodeURIComponent(orderId)}`)
  return mockError(`Order ${orderId} not found.`)
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

// Inventory (SRS 3.5) -> [{ onHand, onOrder, reorderPoint, updatedAt, product }]
export function getInventory() {
  if (!env.useMockData) return apiRequest('/inventory')
  return mockResponse([])
}

// Warranty claims (SRS 3.7). Filter: { stage }
// -> [{ id, stage, amount, description, serialNumber, filedAt, ageDays, product, customer, ... }]
export function getClaims(filters) {
  if (!env.useMockData) return apiRequest(`/claims${toQuery(filters)}`)
  return mockResponse([])
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

// Sales Coach opportunities (SRS 3.8). Filter: { stage }
export function getOpportunities(filters) {
  if (!env.useMockData) return apiRequest(`/opportunities${toQuery(filters)}`)
  return mockResponse([])
}
