import { useCallback, useEffect, useState } from 'react'
import { restaurants } from '../api'

export default function useRestaurants({ q, page }) {
  const [state, setState] = useState({ data: null, status: 'loading', error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((previous) => ({ ...previous, status: 'loading', error: null }))
    restaurants
      .listRestaurants({ q, page })
      .then((data) => {
        if (!cancelled) setState({ data, status: 'success', error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, status: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [q, page, attempt])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])
  return { ...state, reload }
}
