import { restaurants } from '../api'
import { useAuth } from '../context/AuthContext.jsx'
import useAsync from './useAsync.js'

// The signed-in owner's restaurant; `data` is null while loading or when it failed.
export default function useOwnRestaurant() {
  const { user } = useAuth()
  return useAsync(() => restaurants.getRestaurant(user.restaurant_id), [user.restaurant_id])
}
