export const ORDER_STATUSES = [
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]

export const STATUS_LABELS = {
  PLACED: 'Placed',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  ASSIGNED: 'Assigned',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

const OWNER_MOVES = [
  ['PLACED', 'ACCEPTED'],
  ['ACCEPTED', 'PREPARING'],
  ['PREPARING', 'READY'],
]

const OWNER_ACTION_LABELS = {
  ACCEPTED: 'Accept order',
  PREPARING: 'Start preparing',
  READY: 'Mark ready',
}

// The one move an owner can make from this status, or null when the owner is done with it.
export function ownerNextAction(status) {
  const move = OWNER_MOVES.find(([from]) => from === status)
  return move ? { status: move[1], label: OWNER_ACTION_LABELS[move[1]] } : null
}
