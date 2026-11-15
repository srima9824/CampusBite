import { ApiError, delay, paginate, requireRole, requireUser } from './client.js'
import { request } from './http.js'
import { ACTOR_TRANSITIONS, canTransition, ORDER_STATUSES } from './orderStatus.js'
import { store } from './store.js'

function invalid(code, message) {
  return new ApiError(422, code, message)
}

// The backend sends money as whole rupees and has no delivery fee, so the total is the subtotal.
// The timeline and rider fields stay empty until the order screens move over.
function toOrder(order) {
  return {
    ...order,
    restaurant_id: order.restaurant.id,
    restaurant_name: order.restaurant.name,
    note: order.notes ?? '',
    subtotal: order.total,
    delivery_partner: null,
    status_history: [{ status: order.status, changed_at: order.updated_at }],
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

// Each role sees its own slice; an order outside it looks like a missing one.
function isVisibleTo(user, order) {
  if (user.role === 'CUSTOMER') return order.customer_id === user.id
  if (user.role === 'OWNER') return order.restaurant_id === user.restaurant_id
  return order.delivery_partner_id === user.id
}

function parseDay(value, endOfDay) {
  if (value === undefined || value === '') return null
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`) : null
  if (!day || Number.isNaN(day.getTime())) {
    throw invalid('invalid_date_range', 'Dates need the form YYYY-MM-DD.')
  }
  return day.getTime()
}

// `status` is one status or a comma list such as READY,OUT_FOR_DELIVERY.
function parseStatuses(status) {
  if (!status) return []
  const statuses = status.split(',')
  if (statuses.some((entry) => !ORDER_STATUSES.includes(entry))) {
    throw invalid('invalid_status', 'That is not an order status we know.')
  }
  return statuses
}

function validateFilters({ status, date_from: dateFrom, date_to: dateTo }) {
  const statuses = parseStatuses(status)
  const from = parseDay(dateFrom, false)
  const to = parseDay(dateTo, true)
  if (from !== null && to !== null && from > to) {
    throw invalid('invalid_date_range', 'The start date must not be after the end date.')
  }
  return { statuses, from, to }
}

// Newest first. `date_to` includes the whole day; days are read in the viewer's local time.
export async function listOrders({ status, date_from, date_to, page = 1, page_size = 10 } = {}) {
  await delay()
  const user = requireUser()
  const { statuses, from, to } = validateFilters({ status, date_from, date_to })
  const matching = store.orders
    .filter((order) => isVisibleTo(user, order))
    .filter((order) => statuses.length === 0 || statuses.includes(order.status))
    .filter((order) => from === null || Date.parse(order.created_at) >= from)
    .filter((order) => to === null || Date.parse(order.created_at) <= to)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)
  return structuredClone(paginate(matching, page, page_size))
}

export async function cancelOrder(id) {
  await delay()
  const user = requireUser()
  requireRole(user, 'CUSTOMER')
  const order = store.orders.find((candidate) => candidate.id === Number(id))
  if (!order || !isVisibleTo(user, order)) {
    throw new ApiError(404, 'not_found', 'We could not find that order.')
  }
  if (!canTransition(order.status, 'CANCELLED')) {
    throw new ApiError(409, 'invalid_transition', 'This order is already in the kitchen, so it can no longer be cancelled.')
  }
  const now = new Date().toISOString()
  order.status = 'CANCELLED'
  order.status_history.push({ status: 'CANCELLED', changed_at: now })
  order.updated_at = now
  return structuredClone(order)
}

function findOwnOrder(user, id) {
  const order = store.orders.find((candidate) => candidate.id === Number(id))
  if (!order || !isVisibleTo(user, order)) {
    throw new ApiError(404, 'not_found', 'We could not find that order.')
  }
  return order
}

function isActorMove(role, from, to) {
  return ACTOR_TRANSITIONS[role].some(([start, end]) => start === from && end === to)
}

// Owners move their kitchen's orders; partners move only the orders assigned to them.
export async function updateOrderStatus(id, { status }) {
  await delay()
  const user = requireUser()
  requireRole(user, 'OWNER', 'DELIVERY_PARTNER')
  const order = findOwnOrder(user, id)
  const actor = user.role === 'OWNER' ? 'owner' : 'delivery'
  if (!isActorMove(actor, order.status, status)) {
    throw new ApiError(409, 'invalid_transition', 'That order cannot move to that step right now. Reload to see where it stands.')
  }
  const now = new Date().toISOString()
  order.status = status
  order.status_history.push({ status, changed_at: now })
  order.updated_at = now
  return structuredClone(order)
}

// The pool is global: every owner can pick from every delivery partner.
export async function listPartners() {
  await delay()
  requireRole(requireUser(), 'OWNER')
  return store.users
    .filter((candidate) => candidate.role === 'DELIVERY_PARTNER')
    .map(({ id, name }) => ({ id, name }))
}

// Reassigning is allowed while the order is still READY.
export async function assignPartner(id, { delivery_partner_id: partnerId }) {
  await delay()
  const user = requireUser()
  requireRole(user, 'OWNER')
  const order = findOwnOrder(user, id)
  if (order.status !== 'READY') {
    throw new ApiError(409, 'invalid_state', 'A rider can only be assigned while the order is ready.')
  }
  const partner = store.users.find(
    (candidate) => candidate.id === Number(partnerId) && candidate.role === 'DELIVERY_PARTNER',
  )
  if (!partner) throw new ApiError(404, 'not_found', 'We could not find that rider.')
  order.delivery_partner_id = partner.id
  order.delivery_partner = { id: partner.id, name: partner.name }
  order.updated_at = new Date().toISOString()
  return structuredClone(order)
}
