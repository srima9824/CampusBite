import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetStore, setLatency } from '../api/testing.js'
import useMenu from './useMenu.js'

beforeEach(() => {
  resetStore()
  setLatency(0)
})

describe('useMenu', () => {
  it('loads the restaurant together with its menu items', async () => {
    const { result } = renderHook(() => useMenu('1', {}))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data.restaurant.name).toBe('Dosa Dash')
    expect(result.current.data.items.every((item) => item.restaurant_id === 1)).toBe(true)
  })

  it('applies the filters to the items', async () => {
    const { result } = renderHook(() => useMenu('1', { q: 'dosa', max_price: '100' }))

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data.items.map((item) => item.name)).toEqual(['Masala Dosa', 'Egg Dosa'])
  })

  it('filters by diet', async () => {
    const { result } = renderHook(() => useMenu('3', { veg: 'non_veg' }))

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data.items.every((item) => !item.is_veg)).toBe(true)
  })

  it('reports the price ceiling of the whole menu, rounded up to 10, even when filtered', async () => {
    const { result } = renderHook(() => useMenu('3', { max_price: '100' }))

    await waitFor(() => expect(result.current.priceCeiling).toBe(260))
    expect(result.current.data.items.every((item) => item.price <= 100)).toBe(true)
  })

  it('reports a 404 error for an unknown restaurant', async () => {
    const { result } = renderHook(() => useMenu('999', {}))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error.status).toBe(404)
  })

  it('reports a 422 error for an inverted price range', async () => {
    const { result } = renderHook(() => useMenu('1', { min_price: '200', max_price: '50' }))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error.status).toBe(422)
  })
})
