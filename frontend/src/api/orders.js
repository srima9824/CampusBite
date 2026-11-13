import { DELIVERY_FEE } from '../lib/constants.js'
import { roundMoney } from '../lib/cartTotals.js'
import { ApiError, delay, paginate, requireRole, requireUser } from './client.js'
import { ACTOR_TRANSITIONS, canTransition, ORDER_STATUSES } from './orderStatus.js'
import { store } from './store.js'

const MIN_ADDRESS = 5
const MAX_ADDRESS = 200
const MAX_QUANTITY = 20

function invalid(code, message) {
  return new ApiError(422, code, message)
}

function validateRequest({ items, delivery_address: address }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw invalid('empty_cart', 'Your cart is empty. Add a dish before ordering.')
  }
  const length = (address ?? '').trim().length
  if (length < MIN_ADDRESS || length > MAX_ADDRESS) {
    throw invalid('invalid_address', `The delivery address needs ${MIN_ADDRESS} to ${MAX_ADDRESS} characters.`)
  }
  const quantities = items.map((entry) => entry.quantity)
  if (quantities.some((quantity) => !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY)) {
    throw invalid('invalid_quantity', `Each dish can be ordered 1 to ${MAX_QUANTITY} times.`)
  }
}

function snapshotLine(restaurantId, { menu_item_id: id, quantity }) {
  const item = store.menuItems.find((candidate) => candidate.id === Number(id))
  if (!item) throw new ApiError(404, 'not_found', 'One of the dishes is not on the menu anymore.')
  if (item.restaurant_id !== restaurantId) {
    throw invalid('mixed_restaurants', 'An order can only hold dishes from one kitchen.')
  }
  if (!item.is_available) {
    throw new ApiError(409, 'item_unavailable', `${item.name} just sold out.`)
  }
  return {
    menu_item_id: item.id,
    name: item.name,
    unit_price: item.price,
    quantity,
    line_total: roundMoney(item.price * quantity),
  }
}

// Totals are computed here, never taken from the client, as the real backend will do.
export async function placeOrder(request) {
  await delay()
  const user = requireUser()
  requireRole(user, 'CUSTOMER')
  validateRequest(request)
  const restaurant = store.restaurants.find((candidate) => candidate.id === Number(request.restaurant_id))
  if (!restaurant) throw new ApiError(404, 'not_found', 'That kitchen is not on our map.')

  const items = request.items.map((entry) => snapshotLine(restaurant.id, entry))
  const subtotal = roundMoney(items.reduce((sum, line) => sum + line.line_total, 0))
  const now = new Date().toISOString()
  const order = {
    id: store.nextOrderId,
    customer_id: user.id,
    customer_name: user.name,
    restaurant_id: restaurant.id,
    restaurant_name: restaurant.name,
    status: 'PLACED',
    items,
    subtotal,
    delivery_fee: DELIVERY_FEE,
    total: roundMoney(subtotal + DELIVERY_FEE),
    payment: { method: 'mock', status: 'mock_paid' },
    delivery_address: request.delivery_address.trim(),
    note: (request.note ?? '').trim(),
    delivery_partner_id: null,
    delivery_partner: null,
    status_history: [{ status: 'PLACED', changed_at: now }],
    created_at: now,
    updated_at: now,
  }
  store.nextOrderId += 1
  store.orders.push(order)
  return structuredClone(order)
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

function validateFilters({ status, date_from: dateFrom, date_to: dateTo }) {
  if (status && !ORDER_STATUSES.includes(status)) {
    throw invalid('invalid_status', 'That is not an order status we know.')
  }
  const from = parseDay(dateFrom, false)
  const to = parseDay(dateTo, true)
  if (from !== null && to !== null && from > to) {
    throw invalid('invalid_date_range', 'The start date must not be after the end date.')
  }
  return { from, to }
}

// Newest first. `date_to` includes the whole day; days are read in the viewer's local time.
export async function listOrders({ status, date_from, date_to, page = 1, page_size = 10 } = {}) {
  await delay()
  const user = requireUser()
  const { from, to } = validateFilters({ status, date_from, date_to })
  const matching = store.orders
    .filter((order) => isVisibleTo(user, order))
    .filter((order) => !status || order.status === status)
    .filter((order) => from === null || Date.parse(order.created_at) >= from)
    .filter((order) => to === null || Date.parse(order.created_at) <= to)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)
  return structuredClone(paginate(matching, page, page_size))
}

export async function getOrder(id) {
  await delay()
  const user = requireUser()
  const order = store.orders.find((candidate) => candidate.id === Number(id))
  if (!order || !isVisibleTo(user, order)) {
    throw new ApiError(404, 'not_found', 'We could not find that order.')
  }
  return structuredClone(order)
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

function isOwnerMove(from, to) {
  return ACTOR_TRANSITIONS.owner.some(([start, end]) => start === from && end === to)
}

export async function updateOrderStatus(id, { status }) {
  await delay()
  const user = requireUser()
  requireRole(user, 'OWNER')
  const order = findOwnOrder(user, id)
  if (!isOwnerMove(order.status, status)) {
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
