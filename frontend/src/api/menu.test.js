import { beforeEach, describe, expect, it } from 'vitest'
import { restaurants } from './index.js'
import { resetStore, setLatency } from './testing.js'

beforeEach(() => {
  resetStore()
  setLatency(0)
})

const names = (result) => result.items.map((item) => item.name)

describe('listMenu', () => {
  it('returns only the items of the requested restaurant', async () => {
    const result = await restaurants.listMenu(1)

    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.every((item) => item.restaurant_id === 1)).toBe(true)
  })

  it('includes unavailable items flagged as not available', async () => {
    const result = await restaurants.listMenu(1)

    expect(result.items.some((item) => item.is_available === false)).toBe(true)
  })

  it('searches item names ignoring case', async () => {
    expect(names(await restaurants.listMenu(1, { q: 'MASALA' }))).toEqual(['Masala Dosa'])
  })

  it('searches item categories ignoring case', async () => {
    expect(names(await restaurants.listMenu(1, { q: 'drinks' }))).toEqual(['Filter Coffee', 'Mango Lassi'])
  })

  it('keeps items priced exactly at the minimum and maximum', async () => {
    const result = await restaurants.listMenu(1, { min_price: 60, max_price: 80 })

    expect(result.items.map((item) => item.price).sort((a, b) => a - b)).toEqual([60, 70, 80])
  })

  it('accepts price bounds given as text, as they arrive from URL params', async () => {
    const result = await restaurants.listMenu(1, { min_price: '100', max_price: '' })

    expect(result.items.every((item) => item.price >= 100)).toBe(true)
    expect(result.items.length).toBeGreaterThan(0)
  })

  it('combines search with a price limit', async () => {
    const result = await restaurants.listMenu(1, { q: 'dosa', max_price: 100 })

    expect(names(result)).toEqual(['Masala Dosa'])
  })

  it('pages the menu', async () => {
    const result = await restaurants.listMenu(1, { page: 2, page_size: 3 })

    expect(result.items).toHaveLength(3)
    expect(result).toMatchObject({ page: 2, page_size: 3, total: 7 })
  })

  it('rejects a minimum above the maximum with 422 invalid_price_range', async () => {
    await expect(restaurants.listMenu(1, { min_price: 200, max_price: 50 })).rejects.toMatchObject({
      status: 422,
      code: 'invalid_price_range',
    })
  })

  it('rejects an unknown restaurant with 404 not_found', async () => {
    await expect(restaurants.listMenu(999)).rejects.toMatchObject({ status: 404, code: 'not_found' })
  })
})
