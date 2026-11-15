import { delivery } from '../api'
import useAsync from './useAsync.js'

export default function useDeliveries({ status, page }) {
  return useAsync(() => delivery.listDeliveries({ status, page }), [status, page])
}
