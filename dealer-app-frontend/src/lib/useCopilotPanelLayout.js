import { useSyncExternalStore } from 'react'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { COPILOT_PATH } from '@/constants/modules'
import { usePermissions } from '@/lib/rbac'
import { COPILOT_WIDTH, selectCopilotOpen, selectCopilotWidth } from '@/store/slices/uiSlice'

// Where the Copilot side panel is and how wide it is. MainLayout gives the
// page a right margin of `space` px, so the open panel never covers it.

// Full screen only on a real phone. Zooming the browser in also makes the
// window "narrower"; the panel stays a side panel then.
const PHONE_QUERY = '(max-width: 480px)'

// The window width, kept up to date on resize (and zoom).
const subscribeResize = (onChange) => {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}
const useWindowWidth = () => useSyncExternalStore(subscribeResize, () => window.innerWidth)

// Between 360 px and half the window (never under 360).
export const clampCopilotWidth = (width, windowWidth) =>
  Math.round(Math.min(Math.max(width, COPILOT_WIDTH.min), Math.max(COPILOT_WIDTH.min, windowWidth / 2)))

// -> { available, open, isPhone, width, windowWidth, space }
export function useCopilotPanelLayout() {
  const { isDealer, isManufacturer } = usePermissions()
  const { pathname } = useLocation()
  const open = useSelector(selectCopilotOpen)
  const savedWidth = useSelector(selectCopilotWidth)
  const isPhone = useMediaQuery(PHONE_QUERY)
  const windowWidth = useWindowWidth()
  // Dealer logins (their dealership) and the manufacturer (its whole dealer
  // network); not on the Copilot page itself.
  const available = (isDealer || isManufacturer) && pathname !== COPILOT_PATH
  const width = clampCopilotWidth(savedWidth, windowWidth)
  return { available, open: available && open, isPhone, width, windowWidth, space: available && open && !isPhone ? width : 0 }
}
