import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetStore, setLatency } from '../api/testing.js'
import useRestaurants from './useRestaurants.js'

beforeEach(() => {
  resetStore()
  setLatency(0)
})

describe('useRestaurants', () => {
  it('loads the first page of restaurants', async () => {
    const { result } = renderHook(() => useRestaurants({ q: '', page: 1 }))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data.items).toHaveLength(4)
    expect(result.current.data.total).toBe(4)
  })

  it('refetches when the search text changes', async () => {
    const { result, rerender } = renderHook((query) => useRestaurants(query), {
      initialProps: { q: '', page: 1 },
    })
    await waitFor(() => expect(result.current.status).toBe('success'))

    rerender({ q: 'burger', page: 1 })

    await waitFor(() => expect(result.current.data?.items.map((r) => r.name)).toEqual(['Burger Barn']))
  })

  it('loads the requested page', async () => {
    const { result } = renderHook(() => useRestaurants({ q: '', page: 2 }))

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data.items).toEqual([])
    expect(result.current.data.total).toBe(4)
  })
})
