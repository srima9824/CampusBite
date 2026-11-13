import { useCallback, useEffect, useState } from 'react'

// `deps` decide when to refetch; a response that arrives after they changed is dropped.
// Status is derived from the request key, so no state is set synchronously in the effect.
export default function useAsync(fn, deps) {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState({ key: null, data: null, error: null })
  const key = JSON.stringify([...deps, attempt])

  useEffect(() => {
    let cancelled = false
    fn()
      .then((data) => {
        if (!cancelled) setSettled({ key, data, error: null })
      })
      .catch((error) => {
        if (!cancelled) setSettled({ key, data: null, error })
      })
    return () => {
      cancelled = true
    }
    // `key` stands for the deps; `fn` is a new closure on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])
  if (settled.key !== key) return { data: null, status: 'loading', error: null, reload }
  if (settled.error) return { data: null, status: 'error', error: settled.error, reload }
  return { data: settled.data, status: 'success', error: null, reload }
}
