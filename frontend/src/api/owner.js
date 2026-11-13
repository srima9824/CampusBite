import { roundMoney } from '../lib/cartTotals.js'
import { delay, requireRole, requireUser } from './client.js'
import { ORDER_STATUSES } from './orderStatus.js'
import { store } from './store.js'

const TOP_ITEM_COUNT = 5

function isToday(iso, now) {
  return new Date(iso).toDateString() === now.toDateString()
}

function topItems(orders) {
  const quantities = new Map()
  orders.forEach((order) =>
    order.items.forEach((line) => {
      const known = quantities.get(line.menu_item_id)
      quantities.set(line.menu_item_id, {
        menu_item_id: line.menu_item_id,
        name: line.name,
        quantity: (known?.quantity ?? 0) + line.quantity,
      })
    }),
  )
  return [...quantities.values()]
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
    .slice(0, TOP_ITEM_COUNT)
}

// Computed from the live store, so numbers move as orders move. Cancelled orders earn nothing and sell nothing.
export async function getRestaurantStats() {
  await delay()
  const user = requireUser()
  requireRole(user, 'OWNER')
  const orders = store.orders.filter((order) => order.restaurant_id === user.restaurant_id)
  const counted = orders.filter((order) => order.status !== 'CANCELLED')
  const now = new Date()
  return {
    total_orders: orders.length,
    revenue: roundMoney(counted.reduce((sum, order) => sum + order.total, 0)),
    orders_today: orders.filter((order) => isToday(order.created_at, now)).length,
    by_status: Object.fromEntries(
      ORDER_STATUSES.map((status) => [status, orders.filter((order) => order.status === status).length]),
    ),
    top_items: topItems(counted),
  }
}
