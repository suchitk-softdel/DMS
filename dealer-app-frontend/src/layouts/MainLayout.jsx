import { Suspense } from 'react'
import Box from '@mui/material/Box'
import { Outlet, useLocation } from 'react-router-dom'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import PageLoader from '@/components/common/PageLoader'
import NavRail from '@/components/layout/NavRail'
import { PageHeaderProvider } from '@/components/layout/PageHeaderContext'
import TopBar from '@/components/layout/TopBar'

// One app shell for every destination (UI Design Concept): navigation rail on
// the left, top bar with the page title, page content below.
export default function MainLayout() {
  const { pathname } = useLocation()

  return (
    <PageHeaderProvider>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <NavRail />
        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TopBar />
          <Box component="main" sx={{ flexGrow: 1, px: { xs: 2, md: 4.5 }, py: { xs: 2, md: 3.5 } }}>
            {/* Keyed by path so navigating away from a crashed page resets the boundary. */}
            <ErrorBoundary key={pathname}>
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </Box>
        </Box>
      </Box>
    </PageHeaderProvider>
  )
}
