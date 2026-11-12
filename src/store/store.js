import { configureStore } from '@reduxjs/toolkit'
import { env } from '@/config/env'
import authReducer, { authInitialState } from '@/store/slices/authSlice'
import rolesReducer from '@/store/slices/rolesSlice'
import uiReducer from '@/store/slices/uiSlice'

const AUTH_STORAGE_KEY = 'dealerApp.auth.user'

function loadPersistedUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistUser(user) {
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  } catch {
    // Storage can be unavailable (private mode, quota); the session still works in memory.
  }
}

const persistedUser = loadPersistedUser()

export const store = configureStore({
  reducer: {
    auth: authReducer,
    roles: rolesReducer,
    ui: uiReducer,
  },
  // Redux DevTools expose the whole app state, so keep them out of production.
  devTools: env.enableReduxDevTools,
  preloadedState: {
    auth: {
      ...authInitialState,
      user: persistedUser,
      status: persistedUser ? 'succeeded' : 'idle',
    },
  },
})

// Persistence is a side effect, so it lives here rather than in reducers.
// Only write when the user object actually changes.
let lastUser = store.getState().auth.user
store.subscribe(() => {
  const { user } = store.getState().auth
  if (user === lastUser) return
  lastUser = user
  persistUser(user)
})
