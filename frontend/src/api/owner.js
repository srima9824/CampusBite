import { request } from './http.js'

function menuBody(values) {
  return {
    name: values.name.trim(),
    description: String(values.description ?? '').trim(),
    category: values.category.trim(),
    price: Number(values.price),
    is_veg: Boolean(values.is_veg),
  }
}

export function listMenu({ page = 1, page_size = 50 } = {}) {
  return request('/owner/menu', { query: { page, page_size } })
}

export function createMenuItem(values) {
  return request('/owner/menu', { method: 'POST', body: menuBody(values) })
}

export function updateMenuItem(id, values) {
  return request(`/owner/menu/${Number(id)}`, { method: 'PATCH', body: menuBody(values) })
}

export function setMenuItemAvailability(id, { is_available: isAvailable }) {
  return request(`/owner/menu/${Number(id)}/availability`, {
    method: 'PATCH',
    body: { is_available: Boolean(isAvailable) },
  })
}

// The backend sends the customer as { name }; the pages read customer_name and note.
function toOwnerOrder(order) {
  return {
    ...order,
    customer_name: order.customer.name,
    note: order.notes ?? '',
    delivery_partner_id: order.delivery_partner?.id ?? null,
  }
}

function toPage(page) {
  return { ...page, items: page.items.map(toOwnerOrder) }
}

export async function listOrders({ status, date_from, date_to, page = 1, page_size = 10 } = {}) {
  return toPage(await request('/owner/orders', { query: { status, date_from, date_to, page, page_size } }))
}

export async function updateOrderStatus(id, { status }) {
  return toOwnerOrder(await request(`/owner/orders/${Number(id)}/status`, { method: 'PATCH', body: { status } }))
}

export async function listPartners() {
  const page = await request('/owner/delivery-partners', { query: { page_size: 50 } })
  return page.items
}

export async function assignPartner(id, { delivery_partner_id: partnerId }) {
  return toOwnerOrder(
    await request(`/owner/orders/${Number(id)}/assign`, { method: 'PATCH', body: { delivery_partner_id: partnerId } }),
  )
}

export async function listReturns({ return_status, page = 1, page_size = 10 } = {}) {
  return toPage(await request('/owner/returns', { query: { return_status, page, page_size } }))
}

// decision is 'APPROVED' or 'REJECTED'.
export async function decideReturn(id, decision) {
  return toOwnerOrder(await request(`/owner/orders/${Number(id)}/return`, { method: 'PATCH', body: { decision } }))
}

export function listReminders({ page = 1, page_size = 10 } = {}) {
  return request('/owner/reminders', { query: { page, page_size } })
}

export function getRestaurantStats() {
  return request('/owner/stats')
}
