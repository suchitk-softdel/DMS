import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as dataService from '@/services/dataService'

export const authInitialState = {
  user: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
}

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      return await dataService.login(email, password)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  },
)

// Ends the session on the backend, then clears the local state. The local
// state is cleared even if the request fails, so the user is never stuck.
export const signOut = createAsyncThunk('auth/signOut', async (_, { dispatch }) => {
  try {
    await dataService.logout()
  } finally {
    dispatch(authSlice.actions.logout())
  }
})

// On start-up: the user saved in localStorage may belong to a session that
// has expired on the backend. If so, sign out locally.
export const verifySession = createAsyncThunk('auth/verifySession', async (_, { dispatch, getState }) => {
  if (!getState().auth.user) return
  try {
    await dataService.getCurrentUser()
  } catch (error) {
    if (error.status === 401) dispatch(authSlice.actions.logout())
  }
})

const authSlice = createSlice({
  name: 'auth',
  initialState: authInitialState,
  reducers: {
    // Clears the local session only. Components dispatch signOut() instead.
    logout() {
      return authInitialState
    },
    clearAuthError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.user = action.payload
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload ?? action.error.message
      })
  },
})

export const { logout, clearAuthError } = authSlice.actions

export const selectCurrentUser = (state) => state.auth.user
export const selectAuthStatus = (state) => state.auth.status
export const selectAuthError = (state) => state.auth.error

export default authSlice.reducer
