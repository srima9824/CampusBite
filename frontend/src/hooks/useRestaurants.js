import { restaurants } from '../api'
import useAsync from './useAsync.js'

export default function useRestaurants({ q, page, page_size }) {
  return useAsync(() => restaurants.listRestaurants({ q, page, page_size }), [q, page, page_size])
}
