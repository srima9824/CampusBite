import { restaurants } from '../api'
import useAsync from './useAsync.js'

export default function useMenu(restaurantId, { q, min_price, max_price }) {
  return useAsync(
    async () => {
      const [restaurant, menu] = await Promise.all([
        restaurants.getRestaurant(restaurantId),
        restaurants.listMenu(restaurantId, { q, min_price, max_price }),
      ])
      return { restaurant, items: menu.items }
    },
    [restaurantId, q, min_price, max_price],
  )
}
