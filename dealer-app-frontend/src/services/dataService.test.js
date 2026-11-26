// The API client: request shape, error messages and HTTP status handling.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ApiError, getInventory, getOrders, login, placeOrder } from '@/services/dataService'

const jsonResponse = (status, body) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('requests', () => {
  test('login posts JSON to /api/auth/login with the cookie', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'u-1' }))
    await expect(login('a@b.com', 'pw')).resolves.toEqual({ id: 'u-1' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(options.method).toBe('POST')
    expect(options.credentials).toBe('same-origin')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ email: 'a@b.com', password: 'pw' })
  })

  test('never sends a dealer id (the backend takes it from the session)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []))
    await getInventory()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/inventory')
  })

  test('filters become a query string; empty values are left out', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []))
    await getOrders({ status: 'submitted', search: '', from: null })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/orders?status=submitted')
  })

  test('place order sends product, quantity and price', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 1 }))
    await placeOrder({ productId: 'p-1', quantity: 2, sellingPrice: 99.5 })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/place-orders')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ productId: 'p-1', quantity: 2, sellingPrice: 99.5 })
  })
})

describe('errors', () => {
  test('uses the backend message and keeps the status', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Invalid email or password.' }))
    const error = await login('a@b.com', 'wrong').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(error.message).toBe('Invalid email or password.')
  })

  test('falls back to a generic message when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))
    const error = await getInventory().catch((e) => e)
    expect(error.status).toBe(502)
    expect(error.message).toBe('Request failed with status 502')
  })

  test('a network failure rejects (so screens can show an error)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getInventory()).rejects.toThrow('Failed to fetch')
  })
})

test('204 No Content resolves to null', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
  await expect(getInventory()).resolves.toBeNull()
})
