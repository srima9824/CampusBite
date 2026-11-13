import { STATUS_LABELS } from '../api/orderStatus.js'
import { Badge } from './ui'

const STATUS_TONES = {
  PLACED: 'info',
  ACCEPTED: 'info',
  PREPARING: 'warning',
  READY: 'warning',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
}

export default function OrderStatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
}
