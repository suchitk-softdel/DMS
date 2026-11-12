// The ONLY module that reads from src/data. Every function returns a Promise,
// so components and slices stay the same when the mock branch is replaced
// by real API calls.
//
// Per SRS v1.0 section 5 the app is a thin presentation layer: all data,
// AI results (forecasts, scores, Copilot answers) and enterprise-system access
// come from the backend. The app never computes AI results itself.
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

// TODO(api): Shared fetch helper for the real backend. The endpoint paths
// used below are placeholders; align them with the API contract once it exists.
// TODO(api): Attach the auth token once the backend issues one, e.g.
//   headers: { Authorization: `Bearer ${token}` }
async function apiRequest(path, options = {}) {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? `Request failed with status ${response.status}`)
  }

  return response.json()
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export function login(email, password) {
  if (!env.useMockData) {
    // TODO(api): POST /auth/login -> { id, name, email, roleId, dealerId }
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = users.find((u) => u.email === normalizedEmail && u.password === password)
  return user ? mockResponse(withoutPassword(user)) : mockError('Invalid email or password.')
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export function getRoles() {
  if (!env.useMockData) {
    // TODO(api): GET /roles -> [{ id, name, permissions: [moduleKey] }]
    return apiRequest('/roles')
  }

  return mockResponse(roles)
}

// ---------------------------------------------------------------------------
// Dealer profile (the signed-in user's own dealership: name, tier, region)
// ---------------------------------------------------------------------------

export function getDealerById(dealerId) {
  if (!env.useMockData) {
    // TODO(api): GET /dealers/:id -> { id, name, ... }
    return apiRequest(`/dealers/${encodeURIComponent(dealerId)}`)
  }

  const dealer = dealers.find((d) => d.id === dealerId)
  return dealer ? mockResponse(dealer) : mockError(`Dealer ${dealerId} not found.`)
}

// ---------------------------------------------------------------------------
// Orders, sales, products, claims
// Mock branches return empty arrays until scripts/generateData.js produces
// the multi-year dataset in src/data/. Optional `dealerId` filters to one dealer.
// ---------------------------------------------------------------------------

function toQuery(params) {
  const entries = Object.entries(params).filter(([, value]) => value != null && value !== '')
  return entries.length ? `?${new URLSearchParams(entries)}` : ''
}

export function getOrders({ dealerId } = {}) {
  if (!env.useMockData) {
    // TODO(api): GET /orders?dealerId= -> [{ id, dealerId, productId, quantity, status, orderDate, ... }]
    return apiRequest(`/orders${toQuery({ dealerId })}`)
  }

  // TODO(data): read from src/data/orders.js and filter by dealerId.
  return mockResponse([])
}

export function getSales({ dealerId } = {}) {
  if (!env.useMockData) {
    // TODO(api): GET /sales?dealerId= -> [{ dealerId, productId, month, units, revenue, cost }]
    return apiRequest(`/sales${toQuery({ dealerId })}`)
  }

  // TODO(data): read from src/data/sales.js and filter by dealerId.
  return mockResponse([])
}

export function getProducts() {
  if (!env.useMockData) {
    // TODO(api): GET /products -> [{ id, sku, name, category, unitPrice, unitCost }]
    return apiRequest('/products')
  }

  // TODO(data): read from src/data/products.js.
  return mockResponse([])
}

export function getClaims({ dealerId } = {}) {
  if (!env.useMockData) {
    // TODO(api): GET /claims?dealerId= -> [{ id, dealerId, productId, status, amount, filedDate }]
    return apiRequest(`/claims${toQuery({ dealerId })}`)
  }

  // TODO(data): read from src/data/claims.js and filter by dealerId.
  return mockResponse([])
}
