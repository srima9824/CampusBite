import { useCallback, useEffect, useState } from 'react'

// `deps` decide when to refetch; a response that arrives after they changed is dropped.
export default function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, status: 'loading', error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((previous) => ({ ...previous, status: 'loading', error: null }))
    fn()
      .then((data) => {
        if (!cancelled) setState({ data, status: 'success', error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, status: 'error', error })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])
  return { ...state, reload }
}
