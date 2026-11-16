import { createSlice } from '@reduxjs/toolkit'
import { logout } from '@/store/slices/authSlice'

const initialState = {
  navOpen: false, // mobile navigation drawer
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
  },
  extraReducers: (builder) => {
    builder.addCase(logout, () => initialState)
  },
})

export const { toggleNav, setNavOpen } = uiSlice.actions

export const selectNavOpen = (state) => state.ui.navOpen

export default uiSlice.reducer
