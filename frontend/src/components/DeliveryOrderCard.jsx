import { useState } from 'react'
import { delivery } from '../api'
import { Badge, Button, useToast } from './ui'
import styles from './DeliveryOrderCard.module.css'

const DONE_MESSAGES = {
  OUT_FOR_DELIVERY: (id) => `Order #${id} is on your bike. Ride safe.`,
  DELIVERED: () => 'Delivered. Nice legwork.',
}

// `onDone` runs after every attempt so the page reloads and shows the truth.
export default function DeliveryOrderCard({ order, onDone }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const next = delivery.DELIVERY_NEXT[order.status]

  async function advance() {
    setBusy(true)
    try {
      await delivery.updateDeliveryStatus(order.id, next.status)
      toast.success(DONE_MESSAGES[next.status](order.id))
    } catch (error) {
      toast.error(error.message ?? 'That did not go through. Please try again.')
    }
    setBusy(false)
    onDone()
  }

  return (
    <article className={styles.card} aria-labelledby={`delivery-${order.id}`}>
      <header className={styles.header}>
        <h2 className={styles.title} id={`delivery-${order.id}`}>
          Order #{order.id}
        </h2>
        <Badge tone={order.status === 'DELIVERED' ? 'success' : 'info'}>{delivery.DELIVERY_STATUS_LABELS[order.status]}</Badge>
      </header>
      <dl className={styles.details}>
        <div>
          <dt>Pick up from</dt>
          <dd>{order.restaurant.name}</dd>
        </div>
        <div>
          <dt>Drop off at</dt>
          <dd>{order.delivery_address}</dd>
        </div>
        <div>
          <dt>For</dt>
          <dd>{order.customer.name}</dd>
        </div>
        <div>
          <dt>In the bag</dt>
          <dd>{order.items.map((line) => `${line.quantity} x ${line.name}`).join(', ')}</dd>
        </div>
        {order.notes && (
          <div>
            <dt>Note</dt>
            <dd>{order.notes}</dd>
          </div>
        )}
      </dl>
      {next ? (
        <div className={styles.action}>
          <Button loading={busy} onClick={advance} aria-label={`${next.label} for order #${order.id}`}>
            {next.label}
          </Button>
        </div>
      ) : (
        <p className={styles.done}>{delivery.DELIVERY_STATUS_LABELS[order.status]}</p>
      )}
    </article>
  )
}
