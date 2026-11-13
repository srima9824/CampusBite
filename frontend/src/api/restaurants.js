import { ApiError, delay, paginate } from './client.js'
import { store } from './store.js'

export async function listRestaurants({ q = '', page = 1, page_size = 6 } = {}) {
  await delay()
  const wanted = q.trim().toLowerCase()
  const matches = store.restaurants.filter(
    (restaurant) =>
      !wanted ||
      restaurant.name.toLowerCase().includes(wanted) ||
      restaurant.cuisine.toLowerCase().includes(wanted),
  )
  return paginate(matches, page, page_size)
}

export async function getRestaurant(id) {
  await delay()
  const restaurant = store.restaurants.find((candidate) => candidate.id === Number(id))
  if (!restaurant) throw new ApiError(404, 'not_found', 'That kitchen is not on our map.')
  return restaurant
}
