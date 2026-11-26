import { configureStore } from '@reduxjs/toolkit'
import { describe, expect, test, vi } from 'vitest'
import * as dataService from '@/services/dataService'
import authReducer, { authInitialState, clearAuthError, login, signOut, verifySession } from '@/store/slices/authSlice'
import { DEALER_USER } from '@/test/utils'

vi.mock('@/services/dataService')

const makeStore = (user = null) =>
  configureStore({ reducer: { auth: authReducer }, preloadedState: { auth: { ...authInitialState, user } } })

describe('login', () => {
  test('success stores the user', async () => {
    dataService.login.mockResolvedValue(DEALER_USER)
    const store = makeStore()
    await store.dispatch(login({ email: 'principal@demo.com', password: 'pw' }))
    expect(store.getState().auth).toMatchObject({ user: DEALER_USER, status: 'succeeded', error: null })
  })

  test('failure keeps the user signed out and shows the message', async () => {
    dataService.login.mockRejectedValue(new Error('Invalid email or password.'))
    const store = makeStore()
    await store.dispatch(login({ email: 'x@y.com', password: 'bad' }))
    expect(store.getState().auth).toMatchObject({ user: null, status: 'failed', error: 'Invalid email or password.' })
  })

  test('clearAuthError', () => {
    const state = authReducer({ ...authInitialState, error: 'oops' }, clearAuthError())
    expect(state.error).toBeNull()
  })
})

describe('signOut', () => {
  test('clears the user', async () => {
    dataService.logout.mockResolvedValue(null)
    const store = makeStore(DEALER_USER)
    await store.dispatch(signOut())
    expect(store.getState().auth.user).toBeNull()
  })

  test('clears the user even when the backend call fails', async () => {
    dataService.logout.mockRejectedValue(new Error('offline'))
    const store = makeStore(DEALER_USER)
    await store.dispatch(signOut())
    expect(store.getState().auth.user).toBeNull()
  })
})

describe('verifySession (on start-up)', () => {
  test('expired session (401) signs out', async () => {
    dataService.getCurrentUser.mockRejectedValue(Object.assign(new Error('expired'), { status: 401 }))
    const store = makeStore(DEALER_USER)
    await store.dispatch(verifySession())
    expect(store.getState().auth.user).toBeNull()
  })

  test('other errors (e.g. backend down) keep the user', async () => {
    dataService.getCurrentUser.mockRejectedValue(Object.assign(new Error('down'), { status: 500 }))
    const store = makeStore(DEALER_USER)
    await store.dispatch(verifySession())
    expect(store.getState().auth.user).toEqual(DEALER_USER)
  })

  test('nobody signed in: no request', async () => {
    const store = makeStore()
    await store.dispatch(verifySession())
    expect(dataService.getCurrentUser).not.toHaveBeenCalled()
  })
})
