import { restaurants } from '../api'
import useAsync from './useAsync.js'

export default function useRestaurants({ q, page }) {
  return useAsync(() => restaurants.listRestaurants({ q, page }), [q, page])
}
