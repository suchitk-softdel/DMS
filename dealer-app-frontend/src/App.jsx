import { lazy, Suspense, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { Route, Routes } from 'react-router-dom'
import PageLoader from '@/components/common/PageLoader'
import { CLAIM_INSIGHTS_PATH, COPILOT_PATH, MODULE_PATHS, MODULES, ORDER_DETAILS_PATH, PUBLIC_PATHS } from '@/constants/modules'
import MainLayout from '@/layouts/MainLayout'
import ProtectedRoute from '@/routes/ProtectedRoute'
import { verifySession } from '@/store/slices/authSlice'
import { fetchRoles } from '@/store/slices/rolesSlice'

const Login = lazy(() => import('@/pages/Login'))
const Unauthorized = lazy(() => import('@/pages/Unauthorized'))
const NotFound = lazy(() => import('@/pages/NotFound'))

const Home = lazy(() => import('@/pages/dealer/Home'))
const Copilot = lazy(() => import('@/pages/dealer/Copilot'))
const Dealer360 = lazy(() => import('@/pages/dealer/Dealer360'))
const Orders = lazy(() => import('@/pages/dealer/Orders'))
const PlaceOrders = lazy(() => import('@/pages/dealer/PlaceOrders'))
const Inventory = lazy(() => import('@/pages/dealer/Inventory'))
const Warranty = lazy(() => import('@/pages/dealer/Warranty'))
const OrderApprovals = lazy(() => import('@/pages/manufacturer/OrderApprovals'))
const OrderDetails = lazy(() => import('@/pages/manufacturer/OrderDetails'))
const ClaimInsights = lazy(() => import('@/pages/manufacturer/ClaimInsights'))

// Permission-controlled pages, each guarded by its module key.
const MODULE_ROUTES = [
  { path: MODULE_PATHS[MODULES.HOME], moduleKey: MODULES.HOME, Page: Home },
  { path: MODULE_PATHS[MODULES.DEALER_360], moduleKey: MODULES.DEALER_360, Page: Dealer360 },
  { path: MODULE_PATHS[MODULES.ORDERS], moduleKey: MODULES.ORDERS, Page: Orders },
  { path: MODULE_PATHS[MODULES.PLACE_ORDERS], moduleKey: MODULES.PLACE_ORDERS, Page: PlaceOrders },
  { path: MODULE_PATHS[MODULES.INVENTORY], moduleKey: MODULES.INVENTORY, Page: Inventory },
  { path: MODULE_PATHS[MODULES.WARRANTY], moduleKey: MODULES.WARRANTY, Page: Warranty },
  // Manufacturer login only.
  { path: MODULE_PATHS[MODULES.ORDER_APPROVALS], moduleKey: MODULES.ORDER_APPROVALS, Page: OrderApprovals },
  { path: ORDER_DETAILS_PATH, moduleKey: MODULES.ORDER_APPROVALS, Page: OrderDetails },
  { path: CLAIM_INSIGHTS_PATH, moduleKey: MODULES.ORDER_APPROVALS, Page: ClaimInsights },
]

export default function App() {
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(fetchRoles())
    dispatch(verifySession())
  }, [dispatch])

  return (
    <Suspense fallback={<PageLoader fullScreen />}>
      <Routes>
        <Route path={PUBLIC_PATHS.LOGIN} element={<Login />} />

        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          {MODULE_ROUTES.map(({ path, moduleKey, Page }) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute moduleKey={moduleKey}>
                  <Page />
                </ProtectedRoute>
              }
            />
          ))}
          {/* Copilot is open to every dealer role (SRS FR-COP-1). */}
          <Route
            path={COPILOT_PATH}
            element={
              <ProtectedRoute dealerOnly>
                <Copilot />
              </ProtectedRoute>
            }
          />
          <Route path={PUBLIC_PATHS.UNAUTHORIZED} element={<Unauthorized />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
