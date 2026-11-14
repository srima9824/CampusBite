import { orders } from '../api'
import useAsync from './useAsync.js'

export default function useOrders({ status, date_from, date_to, page }) {
  return useAsync(() => orders.listOrders({ status, date_from, date_to, page }), [status, date_from, date_to, page])
}
