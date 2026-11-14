import { restaurants } from '../api'
import useAsync from './useAsync.js'

const PRICE_STEP = 10

export default function useMenu(restaurantId, { q, min_price, max_price, veg }) {
  const menu = useAsync(
    async () => {
      const [restaurant, listing] = await Promise.all([
        restaurants.getRestaurant(restaurantId),
        restaurants.listMenu(restaurantId, { q, min_price, max_price, veg }),
      ])
      return { restaurant, items: listing.items }
    },
    [restaurantId, q, min_price, max_price, veg],
  )
  // The sliders' top end comes from the whole menu, not the filtered view.
  const ceiling = useAsync(async () => {
    const { items } = await restaurants.listMenu(restaurantId)
    const highest = Math.max(0, ...items.map((item) => item.price))
    return Math.ceil(highest / PRICE_STEP) * PRICE_STEP
  }, [restaurantId])
  return { ...menu, priceCeiling: ceiling.data ?? 0 }
}
