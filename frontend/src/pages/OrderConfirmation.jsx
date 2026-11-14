import { Link, useParams } from 'react-router-dom'
import { orders } from '../api'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'
import OrderSummary from '../components/OrderSummary.jsx'
import { Button, EmptyState, Skeleton } from '../components/ui'
import useAsync from '../hooks/useAsync.js'
import styles from './OrderConfirmation.module.css'

export default function OrderConfirmation() {
  const { orderId } = useParams()
  const { data: order, status, error, reload } = useAsync(() => orders.getOrder(orderId), [orderId])

  if (status === 'loading') {
    return (
      <div className={styles.page} role="status" aria-label="Loading your order">
        <Skeleton width="60%" height="2rem" />
        <Skeleton variant="block" />
      </div>
    )
  }

  if (status === 'error' && error?.status === 404) {
    return (
      <EmptyState
        headingLevel={1}
        title="We could not find that order"
        description="It may belong to someone else, or the link took a wrong turn."
        action={
          <Link className={styles.link} to="/restaurants">
            Browse restaurants
          </Link>
        }
      />
    )
  }

  if (status === 'error') {
    return (
      <div className={styles.error} role="alert">
        <p>{error?.message ?? 'Your order did not load.'} Give it another go.</p>
        <Button onClick={reload}>Retry</Button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Order placed. The kitchen is on it.</h1>
        <p className={styles.lead}>
          Order #{order.id} from {order.restaurant_name}
        </p>
        <OrderStatusBadge status={order.status} />
      </header>

      <section className={styles.card} aria-labelledby="order-summary-title">
        <h2 id="order-summary-title" className={styles.cardTitle}>
          What you ordered
        </h2>
        <OrderSummary
          lines={order.items}
          subtotal={order.subtotal}
          deliveryFee={order.delivery_fee}
          total={order.total}
        />
      </section>

      <section className={styles.card} aria-labelledby="order-delivery-title">
        <h2 id="order-delivery-title" className={styles.cardTitle}>
          Delivery and payment
        </h2>
        <dl className={styles.details}>
          <div>
            <dt>Deliver to</dt>
            <dd>{order.delivery_address}</dd>
          </div>
          {order.note && (
            <div>
              <dt>Note for the kitchen</dt>
              <dd>{order.note}</dd>
            </div>
          )}
          <div>
            <dt>Payment</dt>
            <dd>Paid (dummy)</dd>
          </div>
        </dl>
      </section>

      <div className={styles.actions}>
        <Link className={styles.link} to={`/orders/${order.id}`}>
          Track this order
        </Link>
        <Link className={styles.linkQuiet} to="/orders">
          View my orders
        </Link>
        <Link className={styles.linkQuiet} to="/restaurants">
          Order more
        </Link>
      </div>
    </div>
  )
}
