// Helpers for component tests: a real Redux store and router around the
// component under test, so pages render the same way as in the app.
import { configureStore } from '@reduxjs/toolkit'
import { ThemeProvider } from '@mui/material/styles'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ToastProvider from '@/components/common/ToastProvider'
import authReducer, { authInitialState } from '@/store/slices/authSlice'
import copilotReducer from '@/store/slices/copilotSlice'
import rolesReducer from '@/store/slices/rolesSlice'
import uiReducer from '@/store/slices/uiSlice'
import { theme } from '@/theme/theme'

// Roles as the backend returns them (GET /roles).
export const ROLES = [
  { id: 'principal', name: 'Dealer Principal', permissions: ['home', 'dealer360', 'orders', 'placeOrders', 'inventory', 'warranty'] },
  { id: 'technician', name: 'Service Technician', permissions: ['home', 'warranty'] },
  { id: 'manufacturer', name: 'Manufacturer', permissions: ['orderApprovals'] },
]

export const DEALER_USER = { id: 'u-1', name: 'Demo Dealer', email: 'principal@demo.com', roleId: 'principal', dealerId: 'd-1001' }
export const TECHNICIAN_USER = { id: 'u-2', name: 'Demo Tech', email: 'tech@demo.com', roleId: 'technician', dealerId: 'd-1001' }
export const MANUFACTURER_USER = { id: 'u-3', name: 'Demo Maker', email: 'manufacturer@demo.com', roleId: 'manufacturer', manufacturerId: 'm-1' }

export function makeStore({ user = null, roles = ROLES, rolesStatus = 'succeeded' } = {}) {
  return configureStore({
    reducer: { auth: authReducer, roles: rolesReducer, ui: uiReducer, copilot: copilotReducer },
    preloadedState: {
      auth: { ...authInitialState, user, status: user ? 'succeeded' : 'idle' },
      roles: { items: roles, status: rolesStatus, error: null },
    },
  })
}

// renderWithApp(<Page />, { user, route: '/inventory', path: '/inventory', extraRoutes })
// extraRoutes: [{ path, element }] so redirects can be checked.
export function renderWithApp(ui, { store = makeStore(), route = '/', path = '*', extraRoutes = [] } = {}) {
  const result = render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={ui} />
              {extraRoutes.map((r) => (
                <Route key={r.path} path={r.path} element={r.element} />
              ))}
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </Provider>,
  )
  return { ...result, store }
}
