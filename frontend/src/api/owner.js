import { roundMoney } from '../lib/cartTotals.js'
import { validateMenuItem } from '../lib/menuItemForm.js'
import { ApiError, delay, requireRole, requireUser } from './client.js'
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

function requireOwner() {
  const user = requireUser()
  requireRole(user, 'OWNER')
  return user
}

function findOwnItem(user, id) {
  const item = store.menuItems.find((candidate) => candidate.id === Number(id))
  if (!item || item.restaurant_id !== user.restaurant_id) {
    throw new ApiError(404, 'not_found', 'We could not find that dish on your menu.')
  }
  return item
}

function checkItem(user, values, ownId) {
  const fields = validateMenuItem(values)
  if (Object.keys(fields).length > 0) {
    throw new ApiError(422, 'validation_error', 'Some fields need another look.', fields)
  }
  const name = values.name.trim().toLowerCase()
  const taken = store.menuItems.some(
    (item) => item.restaurant_id === user.restaurant_id && item.id !== ownId && item.name.toLowerCase() === name,
  )
  if (taken) {
    throw new ApiError(409, 'duplicate_name', 'Your menu already has a dish with that name.', {
      name: 'Your menu already has a dish with that name.',
    })
  }
}

function cleanFields({ name, description, category, price }) {
  return {
    name: name.trim(),
    description: String(description ?? '').trim(),
    category: category.trim(),
    price: roundMoney(Number(price)),
  }
}

export async function createMenuItem(values) {
  await delay()
  const user = requireOwner()
  checkItem(user, values)
  const item = {
    id: store.nextMenuItemId,
    restaurant_id: user.restaurant_id,
    ...cleanFields(values),
    is_available: values.is_available ?? true,
    created_at: new Date().toISOString(),
  }
  store.nextMenuItemId += 1
  store.menuItems.push(item)
  return structuredClone(item)
}

export async function updateMenuItem(id, values) {
  await delay()
  const user = requireOwner()
  const item = findOwnItem(user, id)
  checkItem(user, values, item.id)
  Object.assign(item, cleanFields(values), { is_available: values.is_available ?? item.is_available })
  return structuredClone(item)
}

export async function setMenuItemAvailability(id, { is_available: isAvailable }) {
  await delay()
  const item = findOwnItem(requireOwner(), id)
  item.is_available = Boolean(isAvailable)
  return structuredClone(item)
}

// Placed orders keep their own line snapshots, so they are untouched.
export async function deleteMenuItem(id) {
  await delay()
  const item = findOwnItem(requireOwner(), id)
  store.menuItems.splice(store.menuItems.indexOf(item), 1)
}
