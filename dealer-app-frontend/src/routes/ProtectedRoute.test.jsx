import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { MODULES } from '@/constants/modules'
import ProtectedRoute from '@/routes/ProtectedRoute'
import { DEALER_USER, MANUFACTURER_USER, makeStore, renderWithApp, LIMITED_USER } from '@/test/utils'

const extraRoutes = [
  { path: '/login', element: <div>Login page</div> },
  { path: '/unauthorized', element: <div>Unauthorized page</div> },
]

const renderGuard = (props, storeOptions) =>
  renderWithApp(
    <ProtectedRoute {...props}>
      <div>Secret page</div>
    </ProtectedRoute>,
    { store: makeStore(storeOptions), route: '/page', path: '/page', extraRoutes },
  )

describe('ProtectedRoute', () => {
  test('signed out: goes to the login page', () => {
    renderGuard({ moduleKey: MODULES.INVENTORY }, { user: null })
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Secret page')).not.toBeInTheDocument()
  })

  test('allowed module: shows the page', () => {
    renderGuard({ moduleKey: MODULES.INVENTORY }, { user: DEALER_USER })
    expect(screen.getByText('Secret page')).toBeInTheDocument()
  })

  test('module not in the role: Unauthorized', () => {
    renderGuard({ moduleKey: MODULES.ORDERS }, { user: LIMITED_USER })
    expect(screen.getByText('Unauthorized page')).toBeInTheDocument()
  })

  test('dealer cannot open the manufacturer Order Approvals', () => {
    renderGuard({ moduleKey: MODULES.ORDER_APPROVALS }, { user: DEALER_USER })
    expect(screen.getByText('Unauthorized page')).toBeInTheDocument()
  })

  test('manufacturer cannot open dealer pages', () => {
    renderGuard({ moduleKey: MODULES.INVENTORY }, { user: MANUFACTURER_USER })
    expect(screen.getByText('Unauthorized page')).toBeInTheDocument()
  })

  test('dealer-only page (Copilot) is closed to the manufacturer', () => {
    renderGuard({ dealerOnly: true }, { user: MANUFACTURER_USER })
    expect(screen.getByText('Unauthorized page')).toBeInTheDocument()
  })

  test('dealer-only page is open to dealers', () => {
    renderGuard({ dealerOnly: true }, { user: LIMITED_USER })
    expect(screen.getByText('Secret page')).toBeInTheDocument()
  })

  test('waits while permissions load', () => {
    renderGuard({ moduleKey: MODULES.INVENTORY }, { user: DEALER_USER, rolesStatus: 'loading' })
    expect(screen.queryByText('Secret page')).not.toBeInTheDocument()
    expect(screen.queryByText('Unauthorized page')).not.toBeInTheDocument()
  })

  test('permissions failed to load: shows an error, not the page', () => {
    renderGuard({ moduleKey: MODULES.INVENTORY }, { user: DEALER_USER, rolesStatus: 'failed' })
    expect(screen.getByText(/Could not load permissions/)).toBeInTheDocument()
    expect(screen.queryByText('Secret page')).not.toBeInTheDocument()
  })
})
