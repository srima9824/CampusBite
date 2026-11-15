import { owner } from '../api'
import useAsync from './useAsync.js'

export function useOwnerOrders({ status, date_from, date_to, page }) {
  return useAsync(() => owner.listOrders({ status, date_from, date_to, page }), [status, date_from, date_to, page])
}

export function useOwnerReturns({ return_status, page }) {
  return useAsync(() => owner.listReturns({ return_status, page }), [return_status, page])
}

export function useOwnerReminders() {
  return useAsync(() => owner.listReminders({ page_size: 50 }), [])
}

export function useOwnerPartners() {
  return useAsync(() => owner.listPartners(), [])
}

export function useOwnerMenu() {
  return useAsync(() => owner.listMenu(), [])
}
