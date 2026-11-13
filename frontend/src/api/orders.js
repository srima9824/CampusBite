import { DELIVERY_FEE } from '../lib/constants.js'
import { roundMoney } from '../lib/cartTotals.js'
import { ApiError, delay, requireRole, requireUser } from './client.js'
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

// A customer sees only their own orders; another customer's id looks like a missing one.
export async function getOrder(id) {
  await delay()
  const user = requireUser()
  requireRole(user, 'CUSTOMER')
  const order = store.orders.find((candidate) => candidate.id === Number(id))
  if (!order || order.customer_id !== user.id) {
    throw new ApiError(404, 'not_found', 'We could not find that order.')
  }
  return structuredClone(order)
}
