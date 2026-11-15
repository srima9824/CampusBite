export const PAYMENT_LABELS = { mock_paid: 'Paid', refunded: 'Refunded' }

export const RETURN_LABELS = {
  REQUESTED: 'Return requested',
  APPROVED: 'Return approved',
  REJECTED: 'Return rejected',
}

export function returnLabel(order) {
  return order.return_status ? RETURN_LABELS[order.return_status] : 'None'
}
