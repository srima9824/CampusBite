export const ORDER_STATUSES = [
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
]

export const STATUS_LABELS = {
  PLACED: 'Placed',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export const NEXT_STATUS = {
  PLACED: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
}

export function canTransition(from, to) {
  return NEXT_STATUS[from] === to || (from === 'PLACED' && to === 'CANCELLED')
}

// Who may make which move; ownership (own order, own restaurant, assigned partner) is checked by the api.
export const ACTOR_TRANSITIONS = {
  customer: [['PLACED', 'CANCELLED']],
  owner: [
    ['PLACED', 'ACCEPTED'],
    ['ACCEPTED', 'PREPARING'],
    ['PREPARING', 'READY'],
  ],
  delivery: [
    ['READY', 'OUT_FOR_DELIVERY'],
    ['OUT_FOR_DELIVERY', 'DELIVERED'],
  ],
}

const OWNER_ACTION_LABELS = {
  ACCEPTED: 'Accept order',
  PREPARING: 'Start preparing',
  READY: 'Mark ready',
}

// The one move an owner can make from this status, or null when the owner is done with it.
export function ownerNextAction(status) {
  const move = ACTOR_TRANSITIONS.owner.find(([from]) => from === status)
  return move ? { status: move[1], label: OWNER_ACTION_LABELS[move[1]] } : null
}

const DELIVERY_ACTION_LABELS = {
  OUT_FOR_DELIVERY: 'Pick up order',
  DELIVERED: 'Mark delivered',
}

// The one move a delivery partner can make from this status, or null when the order is done.
export function deliveryNextAction(status) {
  const move = ACTOR_TRANSITIONS.delivery.find(([from]) => from === status)
  return move ? { status: move[1], label: DELIVERY_ACTION_LABELS[move[1]] } : null
}
