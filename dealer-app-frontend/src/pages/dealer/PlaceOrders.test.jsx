import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import PlaceOrders from '@/pages/dealer/PlaceOrders'
import * as dataService from '@/services/dataService'
import { renderWithApp } from '@/test/utils'

vi.mock('@/services/dataService')

const PRODUCTS = [
  { productId: 'p-1', sku: 'FN-H96-80', name: 'High-efficiency furnace', available: 4, basePrice: 1000, lastSellingPrice: null, status: 'low' },
  { productId: 'p-2', sku: 'AC-16-36', name: 'Air conditioner 3 ton', available: 20, basePrice: 2000, lastSellingPrice: 2500, status: 'ok' },
  { productId: 'p-3', sku: 'FN-S80-80', name: 'Standard furnace', available: 0, basePrice: 800, lastSellingPrice: null, status: 'out' },
]

beforeEach(() => {
  dataService.getPlaceOrders.mockResolvedValue({ products: PRODUCTS, recent: [] })
})

const renderPage = () => renderWithApp(<PlaceOrders />)
const rowOf = (sku) => screen.getByText(sku).closest('tr')

async function openSellDialog(user, sku) {
  renderPage()
  await screen.findByText(sku)
  await user.click(within(rowOf(sku)).getByRole('button', { name: 'Sell' }))
  return screen.findByRole('dialog')
}

describe('product list', () => {
  test('shows products, stock status and how many can be sold', async () => {
    renderPage()
    expect(await screen.findByText('FN-H96-80')).toBeInTheDocument()
    expect(screen.getByText('2 of 3 products available to sell. Sell above the base price.')).toBeInTheDocument()
    expect(within(rowOf('FN-H96-80')).getByText('Low stock')).toBeInTheDocument()
    expect(within(rowOf('AC-16-36')).getByText('In stock')).toBeInTheDocument()
    expect(within(rowOf('FN-S80-80')).getByText('Out of stock')).toBeInTheDocument()
  })

  test('out-of-stock products cannot be sold', async () => {
    renderPage()
    await screen.findByText('FN-S80-80')
    expect(within(rowOf('FN-S80-80')).queryByRole('button', { name: 'Sell' })).not.toBeInTheDocument()
    expect(within(rowOf('FN-S80-80')).getByText('Not available')).toBeInTheDocument()
  })

  test('search by SKU or name', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('FN-H96-80')
    await user.type(screen.getByLabelText('Search products'), 'air cond')
    expect(screen.getByText('AC-16-36')).toBeInTheDocument()
    expect(screen.queryByText('FN-H96-80')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Search products'))
    await user.type(screen.getByLabelText('Search products'), 'zzz')
    expect(screen.getByText('No products match your search.')).toBeInTheDocument()
  })

  test('empty sales history message', async () => {
    renderPage()
    expect(await screen.findByText(/No sales yet/)).toBeInTheDocument()
  })

  test('load error shows a message and Retry works', async () => {
    dataService.getPlaceOrders.mockRejectedValueOnce(new Error('Server unavailable'))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Server unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('FN-H96-80')).toBeInTheDocument()
  })
})

describe('sell dialog validation', () => {
  const quantity = (dialog) => within(dialog).getByLabelText('Quantity')
  const price = (dialog) => within(dialog).getByLabelText('Selling price per unit')
  const placeButton = (dialog) => within(dialog).getByRole('button', { name: 'Place order' })

  test('price is required: Place order starts disabled', async () => {
    const dialog = await openSellDialog(userEvent.setup(), 'FN-H96-80')
    expect(quantity(dialog)).toHaveValue(1)
    expect(placeButton(dialog)).toBeDisabled()
  })

  test('last selling price is pre-filled', async () => {
    const dialog = await openSellDialog(userEvent.setup(), 'AC-16-36')
    expect(price(dialog)).toHaveValue(2500)
    expect(placeButton(dialog)).toBeEnabled()
  })

  test.each([
    ['0', 'Enter a whole number of 1 or more.'],
    ['-2', 'Enter a whole number of 1 or more.'],
    ['1.5', 'Enter a whole number of 1 or more.'],
    ['5', 'Only 4 available.'],
  ])('quantity %s is rejected', async (value, message) => {
    const user = userEvent.setup()
    const dialog = await openSellDialog(user, 'FN-H96-80')
    await user.type(price(dialog), '1200')
    await user.clear(quantity(dialog))
    await user.type(quantity(dialog), value)
    expect(within(dialog).getByText(message)).toBeInTheDocument()
    expect(placeButton(dialog)).toBeDisabled()
  })

  test.each(['1000', '999', '0'])('price %s (not above the base price) is rejected', async (value) => {
    const user = userEvent.setup()
    const dialog = await openSellDialog(user, 'FN-H96-80')
    await user.type(price(dialog), value)
    expect(within(dialog).getByText('Must be higher than the base price ($1,000.00).')).toBeInTheDocument()
    expect(placeButton(dialog)).toBeDisabled()
  })

  test('valid input shows the order total and profit', async () => {
    const user = userEvent.setup()
    const dialog = await openSellDialog(user, 'FN-H96-80')
    await user.clear(quantity(dialog))
    await user.type(quantity(dialog), '3')
    await user.type(price(dialog), '1250')
    expect(within(dialog).getByText('$3,750.00')).toBeInTheDocument() // 3 × 1250
    expect(within(dialog).getByText('$750.00')).toBeInTheDocument() // 3 × (1250 − 1000)
    expect(placeButton(dialog)).toBeEnabled()
  })
})

describe('placing the order', () => {
  test('success: sends the sale, closes, confirms and reloads the list', async () => {
    dataService.placeOrder.mockResolvedValue({ quantity: 2, total: 2500, product: { sku: 'FN-H96-80' } })
    const user = userEvent.setup()
    const dialog = await openSellDialog(user, 'FN-H96-80')
    await user.clear(within(dialog).getByLabelText('Quantity'))
    await user.type(within(dialog).getByLabelText('Quantity'), '2')
    await user.type(within(dialog).getByLabelText('Selling price per unit'), '1250')
    await user.click(within(dialog).getByRole('button', { name: 'Place order' }))

    expect(dataService.placeOrder).toHaveBeenCalledWith({ productId: 'p-1', quantity: 2, sellingPrice: 1250 })
    expect(await screen.findByText('Sold 2 × FN-H96-80 for $2,500.00.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /Sell FN-H96-80/ })).not.toBeInTheDocument()
    expect(dataService.getPlaceOrders).toHaveBeenCalledTimes(2)
  })

  test('backend error stays in the dialog so the dealer can fix it', async () => {
    dataService.placeOrder.mockRejectedValue(new Error('Only 1 available.'))
    const user = userEvent.setup()
    const dialog = await openSellDialog(user, 'FN-H96-80')
    await user.type(within(dialog).getByLabelText('Selling price per unit'), '1250')
    await user.click(within(dialog).getByRole('button', { name: 'Place order' }))
    expect(await within(dialog).findByText('Only 1 available.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Place order' })).toBeEnabled()
  })

  test('Cancel closes without selling', async () => {
    const user = userEvent.setup()
    const dialog = await openSellDialog(user, 'FN-H96-80')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(dataService.placeOrder).not.toHaveBeenCalled()
  })
})
