import { Suspense } from 'react'
import Box from '@mui/material/Box'
import { Outlet, useLocation } from 'react-router-dom'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import PageLoader from '@/components/common/PageLoader'
import CopilotPanel from '@/components/copilot/CopilotPanel'
import NavRail from '@/components/layout/NavRail'
import { PageHeaderProvider } from '@/components/layout/PageHeaderContext'
import TopBar from '@/components/layout/TopBar'
import { useCopilotPanelLayout } from '@/lib/useCopilotPanelLayout'

// One app shell for every destination (UI Design Concept): navigation rail on
// the left, top bar with the page title, page content below, and the Copilot
// side panel (opened from the button in the bottom-right corner).
export default function MainLayout() {
  const { pathname } = useLocation()
  // The open Copilot panel takes room on the right; the page moves left.
  const { space } = useCopilotPanelLayout()

  return (
    <PageHeaderProvider>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <NavRail />
        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', mr: `${space}px`, transition: 'margin-right 200ms ease' }}>
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
      <CopilotPanel />
    </PageHeaderProvider>
  )
}
