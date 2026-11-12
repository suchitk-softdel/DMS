import { lazy, Suspense, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { Route, Routes } from 'react-router-dom'
import PageLoader from '@/components/common/PageLoader'
import { DEALER_DETAILS_PATH, MODULE_PATHS, MODULES, PUBLIC_PATHS } from '@/constants/modules'
import MainLayout from '@/layouts/MainLayout'
import ProtectedRoute from '@/routes/ProtectedRoute'
import { fetchRoles } from '@/store/slices/rolesSlice'

const Login = lazy(() => import('@/pages/Login'))
const Unauthorized = lazy(() => import('@/pages/Unauthorized'))
const NotFound = lazy(() => import('@/pages/NotFound'))

// Dealer side
const Home = lazy(() => import('@/pages/dealer/Home'))
const Tasks = lazy(() => import('@/pages/dealer/Tasks'))
const Performance = lazy(() => import('@/pages/dealer/Performance'))
const Orders = lazy(() => import('@/pages/dealer/Orders'))
const Inventory = lazy(() => import('@/pages/dealer/Inventory'))
const Incentives = lazy(() => import('@/pages/dealer/Incentives'))
const Warranty = lazy(() => import('@/pages/dealer/Warranty'))
const SalesCoach = lazy(() => import('@/pages/dealer/SalesCoach'))

// Manufacturer side
const ManufacturerDashboard = lazy(() => import('@/pages/manufacturer/ManufacturerDashboard'))
const DealerList = lazy(() => import('@/pages/manufacturer/DealerList'))
const DealerDetails = lazy(() => import('@/pages/manufacturer/DealerDetails'))
const DealerSales = lazy(() => import('@/pages/manufacturer/DealerSales'))
const DealerOrders = lazy(() => import('@/pages/manufacturer/DealerOrders'))
const Forecasting = lazy(() => import('@/pages/manufacturer/Forecasting'))

// Platform
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))

// Permission-controlled pages. Each is guarded by its module key; detail
// routes reuse the permission of their parent module.
const MODULE_ROUTES = [
  { path: MODULE_PATHS[MODULES.HOME], moduleKey: MODULES.HOME, Page: Home },
  { path: MODULE_PATHS[MODULES.TASKS], moduleKey: MODULES.TASKS, Page: Tasks },
  { path: MODULE_PATHS[MODULES.PERFORMANCE], moduleKey: MODULES.PERFORMANCE, Page: Performance },
  { path: MODULE_PATHS[MODULES.ORDERS], moduleKey: MODULES.ORDERS, Page: Orders },
  { path: MODULE_PATHS[MODULES.INVENTORY], moduleKey: MODULES.INVENTORY, Page: Inventory },
  { path: MODULE_PATHS[MODULES.INCENTIVES], moduleKey: MODULES.INCENTIVES, Page: Incentives },
  { path: MODULE_PATHS[MODULES.WARRANTY], moduleKey: MODULES.WARRANTY, Page: Warranty },
  { path: MODULE_PATHS[MODULES.SALES_COACH], moduleKey: MODULES.SALES_COACH, Page: SalesCoach },
  {
    path: MODULE_PATHS[MODULES.MFG_DASHBOARD],
    moduleKey: MODULES.MFG_DASHBOARD,
    Page: ManufacturerDashboard,
  },
  { path: MODULE_PATHS[MODULES.DEALER_LIST], moduleKey: MODULES.DEALER_LIST, Page: DealerList },
  { path: DEALER_DETAILS_PATH, moduleKey: MODULES.DEALER_LIST, Page: DealerDetails },
  { path: MODULE_PATHS[MODULES.DEALER_SALES], moduleKey: MODULES.DEALER_SALES, Page: DealerSales },
  {
    path: MODULE_PATHS[MODULES.DEALER_ORDERS],
    moduleKey: MODULES.DEALER_ORDERS,
    Page: DealerOrders,
  },
  { path: MODULE_PATHS[MODULES.FORECASTING], moduleKey: MODULES.FORECASTING, Page: Forecasting },
  { path: MODULE_PATHS[MODULES.ADMIN], moduleKey: MODULES.ADMIN, Page: AdminDashboard },
]

export default function App() {
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(fetchRoles())
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
          <Route path={PUBLIC_PATHS.UNAUTHORIZED} element={<Unauthorized />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
