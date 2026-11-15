import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRestaurant, listMenu, listRestaurants } from './restaurants.js'

const dosaDash = {
  id: 1,
  name: 'Dosa Dash',
  cuisine: 'South Indian',
  description: 'Crisp dosas.',
  logo_key: 'dosa-dash',
  image_key: 'south-indian',
  is_open: true,
  average_rating: 4.5,
  review_count: 2,
}

function stubFetch(body) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 })))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('restaurants api', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('maps the backend image keys to the bundled logo and photo', async () => {
    stubFetch({ items: [dosaDash], total: 1, page: 1, page_size: 6 })

    const { items } = await listRestaurants({ q: ' dosa ' })

    expect(items[0].logo_url).toBeTruthy()
    expect(items[0].image_url).toBeTruthy()
    expect(items[0].average_rating).toBe(4.5)
  })

  it('gives each restaurant its own logo and an unknown key none', async () => {
    stubFetch({
      items: [dosaDash, { ...dosaDash, id: 3, logo_key: 'burger-barn' }, { ...dosaDash, id: 9, logo_key: 'nope' }],
      total: 3,
      page: 1,
      page_size: 6,
    })

    const { items } = await listRestaurants()

    expect(items[0].logo_url).not.toBe(items[1].logo_url)
    expect(items[2].logo_url).toBeUndefined()
  })

  it('searches by trimmed text and pages through the backend', async () => {
    const fetchMock = stubFetch({ items: [], total: 0, page: 2, page_size: 6 })

    await listRestaurants({ q: ' dosa ', page: 2 })

    expect(fetchMock.mock.calls[0][0].search).toBe('?q=dosa&page=2&page_size=6')
  })

  it('reads one restaurant with its images', async () => {
    stubFetch(dosaDash)

    const restaurant = await getRestaurant('1')

    expect(restaurant.logo_url).toBeTruthy()
    expect(restaurant.image_url).toBeTruthy()
  })

  it('sends only the menu filters that are set', async () => {
    const fetchMock = stubFetch({ items: [], total: 0, page: 1, page_size: 50 })

    await listMenu(3, { q: 'burger', min_price: 100, max_price: undefined, veg: 'non_veg' })

    expect(fetchMock.mock.calls[0][0].pathname).toBe('/restaurants/3/menu')
    expect(fetchMock.mock.calls[0][0].search).toBe(
      '?q=burger&min_price=100&veg=non_veg&page=1&page_size=50',
    )
  })
})
