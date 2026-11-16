import { useCallback, useEffect, useState } from 'react'

// Loads data from a dataService function and tracks loading and error state.
// `load` must be stable (a module-level function or wrapped in useCallback).
// -> { data, loading, error, reload }
export function useAsyncData(load) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    load()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }))
    return () => {
      cancelled = true
    }
  }, [load, attempt])

  const reload = useCallback(() => {
    setState((previous) => ({ ...previous, loading: true, error: null }))
    setAttempt((value) => value + 1)
  }, [])

  return { ...state, reload }
}
