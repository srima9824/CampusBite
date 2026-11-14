import { beforeEach, describe, expect, it } from 'vitest'
import { restaurants } from './index.js'
import { resetStore, setLatency } from './testing.js'

beforeEach(() => {
  resetStore()
  setLatency(0)
})

describe('listRestaurants', () => {
  it('returns the first page of six with the total of eight', async () => {
    const result = await restaurants.listRestaurants()

    expect(result.items).toHaveLength(6)
    expect(result).toMatchObject({ total: 8, page: 1, page_size: 6 })
  })

  it('returns the remaining two restaurants on page two', async () => {
    const result = await restaurants.listRestaurants({ page: 2 })

    expect(result.items.map((restaurant) => restaurant.name)).toEqual(['Chai & Chill', 'Wrap Star'])
  })

  it('returns no items for a page past the end but keeps the total', async () => {
    const result = await restaurants.listRestaurants({ page: 9 })

    expect(result.items).toEqual([])
    expect(result.total).toBe(8)
  })

  it('finds a restaurant by name ignoring case', async () => {
    const result = await restaurants.listRestaurants({ q: 'DOSA' })

    expect(result.items.map((restaurant) => restaurant.name)).toEqual(['Dosa Dash'])
  })

  it('finds a restaurant by cuisine ignoring case', async () => {
    const result = await restaurants.listRestaurants({ q: 'mexican' })

    expect(result.items.map((restaurant) => restaurant.name)).toEqual(['Taco Tuesday'])
  })

  it('ignores surrounding spaces in the search text', async () => {
    const result = await restaurants.listRestaurants({ q: '  pizza  ' })

    expect(result.total).toBe(1)
  })

  it('returns an empty list when nothing matches', async () => {
    const result = await restaurants.listRestaurants({ q: 'xyz' })

    expect(result).toMatchObject({ items: [], total: 0 })
  })
})

describe('getRestaurant', () => {
  it('returns the restaurant for a known id, numeric or string', async () => {
    expect((await restaurants.getRestaurant(1)).name).toBe('Dosa Dash')
    expect((await restaurants.getRestaurant('2')).name).toBe('Noodle Nook')
  })

  it('rejects an unknown id with a 404 not_found error', async () => {
    await expect(restaurants.getRestaurant(999)).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
    })
  })
})

describe('restaurant images', () => {
  it('gives every listed restaurant a logo_url and an image_url', async () => {
    const all = [
      ...(await restaurants.listRestaurants({ page: 1 })).items,
      ...(await restaurants.listRestaurants({ page: 2 })).items,
    ]

    expect(all).toHaveLength(8)
    for (const restaurant of all) {
      expect(restaurant.logo_url, restaurant.name).toEqual(expect.any(String))
      expect(restaurant.logo_url, restaurant.name).not.toBe('')
      expect(restaurant.image_url, restaurant.name).toEqual(expect.any(String))
      expect(restaurant.image_url, restaurant.name).not.toBe('')
    }
  })

  it('uses a distinct logo and photo per restaurant', async () => {
    const { items } = await restaurants.listRestaurants({ page_size: 8 })

    expect(new Set(items.map((restaurant) => restaurant.logo_url)).size).toBe(8)
    expect(new Set(items.map((restaurant) => restaurant.image_url)).size).toBe(8)
  })

  it('returns the same images from getRestaurant as from the list', async () => {
    const listed = (await restaurants.listRestaurants()).items[0]
    const fetched = await restaurants.getRestaurant(listed.id)

    expect(fetched).toMatchObject({ logo_url: listed.logo_url, image_url: listed.image_url })
  })

  it('honours page_size so the carousel can ask for all eight at once', async () => {
    const result = await restaurants.listRestaurants({ page_size: 8 })

    expect(result.items).toHaveLength(8)
  })
})
