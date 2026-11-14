import { orders } from '../api'
import useAsync from './useAsync.js'

export default function usePartners() {
  return useAsync(() => orders.listPartners(), [])
}
