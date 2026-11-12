import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as dataService from '@/services/dataService'

const initialState = {
  items: [],
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
}

export const fetchRoles = createAsyncThunk(
  'roles/fetchRoles',
  async (_, { rejectWithValue }) => {
    try {
      return await dataService.getRoles()
    } catch (error) {
      return rejectWithValue(error.message)
    }
  },
  {
    // Skip duplicate requests (e.g. StrictMode double-mount) once loading or loaded.
    condition: (_, { getState }) => {
      const { status } = getState().roles
      return status !== 'loading' && status !== 'succeeded'
    },
  },
)

const rolesSlice = createSlice({
  name: 'roles',
  initialState,
  // Read-only: permissions are configured by the Manufacturer Administrator in
  // separate admin tooling (SRS 2.3), not in this app.
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload ?? action.error.message
      })
  },
})

export const selectRoles = (state) => state.roles.items
export const selectRolesStatus = (state) => state.roles.status
export const selectRolesError = (state) => state.roles.error

export default rolesSlice.reducer
