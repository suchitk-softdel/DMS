import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { useAsyncData } from '@/lib/useAsyncData'

describe('useAsyncData', () => {
  test('loading, then data', async () => {
    const load = vi.fn().mockResolvedValue([1, 2])
    const { result } = renderHook(() => useAsyncData(load))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current).toMatchObject({ data: [1, 2], error: null })
  })

  test('error is returned, not thrown', async () => {
    const load = vi.fn().mockRejectedValue(new Error('Server down'))
    const { result } = renderHook(() => useAsyncData(load))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeNull()
    expect(result.current.error.message).toBe('Server down')
  })

  test('reload (Retry) recovers from an error', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('Server down')).mockResolvedValue('ok')
    const { result } = renderHook(() => useAsyncData(load))
    await waitFor(() => expect(result.current.error).not.toBeNull())
    act(() => result.current.reload())
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.data).toBe('ok'))
    expect(result.current.error).toBeNull()
  })

  test('refresh keeps the old data on screen while loading', async () => {
    const load = vi.fn().mockResolvedValueOnce('old').mockResolvedValue('new')
    const { result } = renderHook(() => useAsyncData(load))
    await waitFor(() => expect(result.current.data).toBe('old'))
    act(() => result.current.refresh())
    expect(result.current).toMatchObject({ data: 'old', loading: false })
    await waitFor(() => expect(result.current.data).toBe('new'))
  })

  test('a result arriving after unmount is ignored', async () => {
    let resolve
    const load = vi.fn(() => new Promise((r) => (resolve = r)))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = renderHook(() => useAsyncData(load))
    unmount()
    await act(async () => resolve('late'))
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
