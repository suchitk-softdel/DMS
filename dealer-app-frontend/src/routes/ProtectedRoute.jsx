import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import { useSelector } from 'react-redux'
import { Navigate, Outlet } from 'react-router-dom'
import PageLoader from '@/components/common/PageLoader'
import { PUBLIC_PATHS } from '@/constants/modules'
import { usePermissions } from '@/lib/rbac'
import { selectRolesError } from '@/store/slices/rolesSlice'

// Guards a route: requires login, waits for roles, then checks the module
// permission (when moduleKey is given). `dealerOnly` routes (Copilot) are
// closed to manufacturer users. Renders children, or the nested <Outlet />
// when used as a layout route.
export default function ProtectedRoute({ moduleKey, dealerOnly = false, children }) {
  const { user, rolesStatus, can, isDealer } = usePermissions()
  const rolesError = useSelector(selectRolesError)

  if (!user) {
    return <Navigate to={PUBLIC_PATHS.LOGIN} replace />
  }

  if (rolesStatus === 'idle' || rolesStatus === 'loading') {
    return <PageLoader fullScreen={!moduleKey} />
  }

  if (rolesStatus === 'failed') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Could not load permissions: {rolesError}</Alert>
      </Box>
    )
  }

  if ((moduleKey && !can(moduleKey)) || (dealerOnly && !isDealer)) {
    return <Navigate to={PUBLIC_PATHS.UNAUTHORIZED} replace />
  }

  return children ?? <Outlet />
}
