import { Suspense } from 'react'
import Box from '@mui/material/Box'
import { Outlet, useLocation } from 'react-router-dom'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import PageLoader from '@/components/common/PageLoader'
import CopilotPanel from '@/components/layout/CopilotPanel'
import NavRail from '@/components/layout/NavRail'
import TopBar from '@/components/layout/TopBar'

export default function MainLayout() {
  const { pathname } = useLocation()

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <NavRail />
      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
          {/* Keyed by path so navigating away from a crashed page resets the boundary. */}
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </Box>
      </Box>
      <CopilotPanel />
    </Box>
  )
}
