import { createSlice } from '@reduxjs/toolkit'
import { logout } from '@/store/slices/authSlice'

const initialState = {
  navOpen: false, // mobile navigation drawer
  copilotOpen: false,
}

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
    toggleCopilot(state) {
      state.copilotOpen = !state.copilotOpen
    },
    setCopilotOpen(state, action) {
      state.copilotOpen = action.payload
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout, () => initialState)
  },
})

export const { toggleNav, setNavOpen, toggleCopilot, setCopilotOpen } = uiSlice.actions

export const selectNavOpen = (state) => state.ui.navOpen
export const selectCopilotOpen = (state) => state.ui.copilotOpen

export default uiSlice.reducer
