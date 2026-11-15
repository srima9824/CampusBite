import { request } from './http.js'

export function listRestaurantReviews(restaurantId, { rating, page = 1, page_size = 10 } = {}) {
  return request(`/restaurants/${Number(restaurantId)}/reviews`, { query: { rating, page, page_size } })
}

export function listDishReviews(menuItemId, { rating, page = 1, page_size = 5 } = {}) {
  return request(`/menu-items/${Number(menuItemId)}/reviews`, { query: { rating, page, page_size } })
}
