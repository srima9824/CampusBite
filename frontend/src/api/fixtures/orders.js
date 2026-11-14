import { DELIVERY_FEE } from '../../lib/constants.js'
import { menuItems } from './menuItems.js'
import { restaurants } from './restaurants.js'
import { users } from './users.js'

const HOUR_MS = 3_600_000
const STEP_MS = 10 * 60_000
const FORWARD = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']

const MAYA = 1
const LEO = 2

// Oldest first; ids follow this order. Maya has one order per status; Leo has none cancelled.
// Owner and delivery dashboards in later units read the same rows.
const seeds = [
  { hoursAgo: 168, customer: LEO, restaurant: 1, status: 'DELIVERED', partner: 3, lines: [[2, 1], [7, 1]] },
  { hoursAgo: 144, customer: LEO, restaurant: 2, status: 'DELIVERED', partner: 3, lines: [[8, 2]] },
  { hoursAgo: 120, customer: MAYA, restaurant: 1, status: 'DELIVERED', partner: 3, lines: [[1, 2], [6, 1]], note: 'Extra chutney, please' },
  { hoursAgo: 96, customer: MAYA, restaurant: 2, status: 'CANCELLED', lines: [[9, 1]] },
  { hoursAgo: 7, customer: MAYA, restaurant: 3, status: 'OUT_FOR_DELIVERY', partner: 4, lines: [[15, 1], [18, 1]] },
  { hoursAgo: 6, customer: LEO, restaurant: 2, status: 'OUT_FOR_DELIVERY', partner: 3, lines: [[11, 1], [12, 1]] },
  { hoursAgo: 5, customer: LEO, restaurant: 1, status: 'READY', lines: [[4, 2]] },
  { hoursAgo: 4, customer: MAYA, restaurant: 2, status: 'READY', partner: 3, lines: [[13, 1], [14, 2]] },
  { hoursAgo: 3.5, customer: LEO, restaurant: 2, status: 'PREPARING', lines: [[8, 1], [12, 1]] },
  { hoursAgo: 3, customer: MAYA, restaurant: 3, status: 'PREPARING', lines: [[16, 1], [21, 2]] },
  { hoursAgo: 2.5, customer: LEO, restaurant: 1, status: 'ACCEPTED', lines: [[5, 3]] },
  { hoursAgo: 2, customer: MAYA, restaurant: 2, status: 'ACCEPTED', lines: [[9, 1], [14, 1]] },
  { hoursAgo: 1.5, customer: LEO, restaurant: 2, status: 'PLACED', lines: [[11, 2]] },
  { hoursAgo: 1, customer: LEO, restaurant: 1, status: 'PLACED', lines: [[1, 1], [6, 1]] },
  { hoursAgo: 0.5, customer: MAYA, restaurant: 1, status: 'PLACED', lines: [[2, 1], [4, 1]] },
]

function snapshotLine([menuItemId, quantity]) {
  const item = menuItems.find((candidate) => candidate.id === menuItemId)
  return {
    menu_item_id: item.id,
    name: item.name,
    unit_price: item.price,
    quantity,
    line_total: Math.round(item.price * quantity * 100) / 100,
  }
}

function historyFor(status, placedAt) {
  const steps = status === 'CANCELLED' ? ['PLACED', 'CANCELLED'] : FORWARD.slice(0, FORWARD.indexOf(status) + 1)
  return steps.map((step, index) => ({ status: step, changed_at: new Date(placedAt + index * STEP_MS).toISOString() }))
}

function buildOrder(seed, index, now) {
  const customer = users.find((user) => user.id === seed.customer)
  const restaurant = restaurants.find((candidate) => candidate.id === seed.restaurant)
  const partner = seed.partner ? users.find((user) => user.id === seed.partner) : null
  const items = seed.lines.map(snapshotLine)
  const subtotal = Math.round(items.reduce((sum, line) => sum + line.line_total, 0) * 100) / 100
  const placedAt = now - seed.hoursAgo * HOUR_MS
  const status_history = historyFor(seed.status, placedAt)
  return {
    id: index + 1,
    customer_id: customer.id,
    customer_name: customer.name,
    restaurant_id: restaurant.id,
    restaurant_name: restaurant.name,
    status: seed.status,
    items,
    subtotal,
    delivery_fee: DELIVERY_FEE,
    total: Math.round((subtotal + DELIVERY_FEE) * 100) / 100,
    payment: { method: 'mock', status: 'mock_paid' },
    delivery_address: 'Block C, Room 214, North Campus Hostel',
    note: seed.note ?? '',
    delivery_partner_id: partner?.id ?? null,
    delivery_partner: partner ? { id: partner.id, name: partner.name } : null,
    status_history,
    created_at: status_history[0].changed_at,
    updated_at: status_history.at(-1).changed_at,
  }
}

export function buildSeedOrders(now = Date.now()) {
  return seeds.map((seed, index) => buildOrder(seed, index, now))
}
