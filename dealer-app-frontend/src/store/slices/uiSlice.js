import { createSlice } from '@reduxjs/toolkit'
import { logout } from '@/store/slices/authSlice'

// Copilot side panel width: chosen by dragging its edge, remembered in this
// browser (a convenience only; the default is used when storage is blocked).
export const COPILOT_WIDTH = Object.freeze({ min: 360, default: 440, storageKey: 'copilotPanelWidth' })

function savedCopilotWidth() {
  try {
    const value = Number(window.localStorage.getItem(COPILOT_WIDTH.storageKey))
    return Number.isFinite(value) && value >= COPILOT_WIDTH.min ? value : COPILOT_WIDTH.default
  } catch {
    return COPILOT_WIDTH.default
  }
}

export function saveCopilotWidth(width) {
  try {
    window.localStorage.setItem(COPILOT_WIDTH.storageKey, String(Math.round(width)))
  } catch {
    // Storage blocked (private window, policy): the width just isn't remembered.
  }
}

const initialState = () => ({
  navOpen: false, // mobile navigation drawer
  copilotOpen: false, // Copilot side panel
  copilotWidth: savedCopilotWidth(),
})

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleNav(state) {
      state.navOpen = !state.navOpen
    },
    setNavOpen(state, action) {
      state.navOpen = action.payload
    },
    setCopilotOpen(state, action) {
      state.copilotOpen = action.payload
    },
    setCopilotWidth(state, action) {
      state.copilotWidth = action.payload
    },
  },
  extraReducers: (builder) => {
    // Signing out closes the panel; the chosen width stays.
    builder.addCase(logout, (state) => ({ ...initialState(), copilotWidth: state.copilotWidth }))
  },
})

export const { toggleNav, setNavOpen, setCopilotOpen, setCopilotWidth } = uiSlice.actions

export const selectNavOpen = (state) => state.ui.navOpen
export const selectCopilotOpen = (state) => state.ui.copilotOpen
export const selectCopilotWidth = (state) => state.ui.copilotWidth

export default uiSlice.reducer
