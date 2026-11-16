import { lazy, Suspense, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { Route, Routes } from 'react-router-dom'
import PageLoader from '@/components/common/PageLoader'
import { COPILOT_PATH, MODULE_PATHS, MODULES, PUBLIC_PATHS, TRAINING_PATH } from '@/constants/modules'
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
const Inventory = lazy(() => import('@/pages/dealer/Inventory'))
const Incentives = lazy(() => import('@/pages/dealer/Incentives'))
const Warranty = lazy(() => import('@/pages/dealer/Warranty'))
const SalesCoach = lazy(() => import('@/pages/dealer/SalesCoach'))

// Permission-controlled pages, each guarded by its module key.
const MODULE_ROUTES = [
  { path: MODULE_PATHS[MODULES.HOME], moduleKey: MODULES.HOME, Page: Home },
  { path: MODULE_PATHS[MODULES.DEALER_360], moduleKey: MODULES.DEALER_360, Page: Dealer360 },
  { path: MODULE_PATHS[MODULES.ORDERS], moduleKey: MODULES.ORDERS, Page: Orders },
  { path: MODULE_PATHS[MODULES.INVENTORY], moduleKey: MODULES.INVENTORY, Page: Inventory },
  { path: MODULE_PATHS[MODULES.INCENTIVES], moduleKey: MODULES.INCENTIVES, Page: Incentives },
  // Training has its own rail entry but is part of the Incentives & Training screen (SRS 3.6).
  { path: TRAINING_PATH, moduleKey: MODULES.INCENTIVES, Page: Incentives },
  { path: MODULE_PATHS[MODULES.WARRANTY], moduleKey: MODULES.WARRANTY, Page: Warranty },
  { path: MODULE_PATHS[MODULES.SALES_COACH], moduleKey: MODULES.SALES_COACH, Page: SalesCoach },
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
          {/* Copilot is open to every signed-in role (SRS FR-COP-1). */}
          <Route path={COPILOT_PATH} element={<Copilot />} />
          <Route path={PUBLIC_PATHS.UNAUTHORIZED} element={<Unauthorized />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
