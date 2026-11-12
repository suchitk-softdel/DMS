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
  reducers: {
    // For the future admin permissions screen: grant/revoke a module for a role.
    togglePermission(state, action) {
      const { roleId, moduleKey } = action.payload
      const role = state.items.find((r) => r.id === roleId)
      if (!role) return

      const index = role.permissions.indexOf(moduleKey)
      if (index === -1) {
        role.permissions.push(moduleKey)
      } else {
        role.permissions.splice(index, 1)
      }
    },
  },
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

export const { togglePermission } = rolesSlice.actions

export const selectRoles = (state) => state.roles.items
export const selectRolesStatus = (state) => state.roles.status
export const selectRolesError = (state) => state.roles.error

export default rolesSlice.reducer
