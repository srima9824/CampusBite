import { request } from './http.js'

// The backend sends money as whole rupees and has no delivery fee, so the total is the subtotal.
// It keeps no status history, so the timeline is built from the current status alone.
function toOrder(order) {
  return {
    ...order,
    restaurant_id: order.restaurant.id,
    restaurant_name: order.restaurant.name,
    note: order.notes ?? '',
    subtotal: order.total,
    payment_status: order.payment.status,
  }
}

export async function placeOrder({ items, delivery_address, note }) {
  const created = await request('/orders', {
    method: 'POST',
    body: { items, delivery_address, notes: note?.trim() || undefined },
  })
  return toOrder(created)
}

export async function getOrder(id) {
  return toOrder(await request(`/orders/${Number(id)}`))
}

// `status` is one status or a comma list; dates are YYYY-MM-DD. Newest first.
export async function listOrders({ status, date_from, date_to, page = 1, page_size = 10 } = {}) {
  const result = await request('/orders', { query: { status, date_from, date_to, page, page_size } })
  return { ...result, items: result.items.map(toOrder) }
}

export async function cancelOrder(id) {
  return toOrder(await request(`/orders/${Number(id)}/cancel`, { method: 'POST' }))
}

export async function submitReview(id, { rating, comment }) {
  return request(`/orders/${Number(id)}/review`, {
    method: 'POST',
    body: { rating, comment: comment?.trim() || undefined },
  })
}

export async function requestReturn(id, { reason }) {
  return toOrder(await request(`/orders/${Number(id)}/return`, { method: 'POST', body: { reason: reason.trim() } }))
}
