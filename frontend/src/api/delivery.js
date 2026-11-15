import { request } from './http.js'

export const DELIVERY_PAGE_SIZE = 10

export const ACTIVE_DELIVERY_STATUSES = 'ASSIGNED,OUT_FOR_DELIVERY'

export const DELIVERY_STATUS_LABELS = {
  ASSIGNED: 'Assigned',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
}

// The one step a partner can take from each status; delivered orders are finished.
export const DELIVERY_NEXT = {
  ASSIGNED: { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  OUT_FOR_DELIVERY: { status: 'DELIVERED', label: 'Mark delivered' },
}

// `status` is one status or a comma list; omit it to see every assigned order.
export function listDeliveries({ status, page = 1, page_size = DELIVERY_PAGE_SIZE } = {}) {
  return request('/delivery/orders', { query: { status, page, page_size } })
}

export function updateDeliveryStatus(id, status) {
  return request(`/delivery/orders/${Number(id)}/status`, { method: 'PATCH', body: { status } })
}
