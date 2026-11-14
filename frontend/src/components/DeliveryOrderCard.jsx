import { useState } from 'react'
import { orders } from '../api'
import { STATUS_LABELS, deliveryNextAction } from '../api/orderStatus.js'
import { Button, useToast } from './ui'
import OrderStatusBadge from './OrderStatusBadge.jsx'
import styles from './DeliveryOrderCard.module.css'

const DONE_MESSAGES = {
  OUT_FOR_DELIVERY: (id) => `Order #${id} is on your bike. Ride safe.`,
  DELIVERED: () => 'Delivered. Nice legwork.',
}

function countItems(order) {
  const count = order.items.reduce((sum, line) => sum + line.quantity, 0)
  return count === 1 ? '1 item' : `${count} items`
}

// `onDone` runs after every attempt so the page reloads and shows the truth.
export default function DeliveryOrderCard({ order, onDone }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const next = deliveryNextAction(order.status)
  const firstName = order.customer_name.split(' ')[0]

  async function advance() {
    setBusy(true)
    try {
      await orders.updateOrderStatus(order.id, { status: next.status })
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
        <OrderStatusBadge status={order.status} />
      </header>
      <dl className={styles.details}>
        <div>
          <dt>Pick up from</dt>
          <dd>{order.restaurant_name}</dd>
        </div>
        <div>
          <dt>Drop off at</dt>
          <dd>{order.delivery_address}</dd>
        </div>
        <div>
          <dt>For</dt>
          <dd>{firstName}</dd>
        </div>
        <div>
          <dt>In the bag</dt>
          <dd>{countItems(order)}</dd>
        </div>
        {order.note && (
          <div>
            <dt>Note</dt>
            <dd>{order.note}</dd>
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
        <p className={styles.done}>{STATUS_LABELS[order.status]}</p>
      )}
    </article>
  )
}
