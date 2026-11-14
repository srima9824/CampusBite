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

function isWithinPrice(item, min, max) {
  return (min == null || item.price >= min) && (max == null || item.price <= max)
}

function toBound(value) {
  return value == null || value === '' ? null : Number(value)
}

// Unavailable items are returned too; the UI flags them instead of hiding them.
export async function listMenu(
  restaurantId,
  { q = '', min_price, max_price, page = 1, page_size = 50 } = {},
) {
  await delay()
  const id = Number(restaurantId)
  if (!store.restaurants.some((restaurant) => restaurant.id === id)) {
    throw new ApiError(404, 'not_found', 'That kitchen is not on our map.')
  }
  const min = toBound(min_price)
  const max = toBound(max_price)
  if (min != null && max != null && min > max) {
    throw new ApiError(422, 'invalid_price_range', 'The minimum price is higher than the maximum.')
  }
  const wanted = q.trim().toLowerCase()
  const matches = store.menuItems.filter(
    (item) =>
      item.restaurant_id === id &&
      isWithinPrice(item, min, max) &&
      (!wanted ||
        item.name.toLowerCase().includes(wanted) ||
        item.category.toLowerCase().includes(wanted)),
  )
  return paginate(matches, page, page_size)
}
