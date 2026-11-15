import { logoUrl, photoUrl } from '../lib/restaurantImages.js'
import { request } from './http.js'

function toRestaurant(restaurant) {
  return {
    ...restaurant,
    logo_url: logoUrl(restaurant.logo_key),
    image_url: photoUrl(restaurant.image_key),
  }
}

export async function listRestaurants({ q = '', page = 1, page_size = 6 } = {}) {
  const result = await request('/restaurants', { query: { q: q.trim(), page, page_size } })
  return { ...result, items: result.items.map(toRestaurant) }
}

export async function getRestaurant(id) {
  return toRestaurant(await request(`/restaurants/${Number(id)}`))
}

// Unavailable dishes are returned too; the UI flags them instead of hiding them.
// `veg` is 'veg', 'non_veg' or empty for both.
export async function listMenu(
  restaurantId,
  { q = '', min_price, max_price, veg = '', page = 1, page_size = 50 } = {},
) {
  return request(`/restaurants/${Number(restaurantId)}/menu`, {
    query: { q: q.trim(), min_price, max_price, veg, page, page_size },
  })
}
