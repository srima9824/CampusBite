import { owner } from '../api'
import useAsync from './useAsync.js'

export default function useRestaurantStats() {
  return useAsync(() => owner.getRestaurantStats(), [])
}
