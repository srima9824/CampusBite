import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetAuthWorld, signInAs } from '../test/helpers.jsx'
import useOrders from './useOrders.js'

beforeEach(() => {
  resetAuthWorld()
  signInAs(1)
})

describe('useOrders', () => {
  it('loads the signed-in customer\'s orders', async () => {
    const { result } = renderHook(() => useOrders({ page: 1 }))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data.total).toBe(7)
  })

  it('applies the status filter', async () => {
    const { result } = renderHook(() => useOrders({ status: 'CANCELLED', page: 1 }))

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data.items.map((order) => order.id)).toEqual([4])
  })

  it('applies the requested page', async () => {
    const { result } = renderHook(() => useOrders({ page: 2 }))

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data.items).toEqual([])
    expect(result.current.data.page).toBe(2)
  })

  it('refetches when the filters change', async () => {
    const { result, rerender } = renderHook((query) => useOrders(query), { initialProps: { page: 1 } })
    await waitFor(() => expect(result.current.status).toBe('success'))

    rerender({ status: 'PLACED', page: 1 })

    await waitFor(() => expect(result.current.data?.items.map((order) => order.id)).toEqual([15]))
  })

  it('reports a 422 for an inverted date range', async () => {
    const { result } = renderHook(() => useOrders({ date_from: '2026-05-10', date_to: '2026-05-01', page: 1 }))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toMatchObject({ status: 422, code: 'invalid_date_range' })
  })

  it('reports a 401 for a guest', async () => {
    resetAuthWorld()

    const { result } = renderHook(() => useOrders({ page: 1 }))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error.status).toBe(401)
  })
})
