import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { orders } from '../api'
import CancelOrderDialog from '../components/CancelOrderDialog.jsx'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'
import OrderSummary from '../components/OrderSummary.jsx'
import OrderTimeline from '../components/OrderTimeline.jsx'
import ReturnForm from '../components/ReturnForm.jsx'
import ReviewForm from '../components/ReviewForm.jsx'
import { Button, EmptyState, Skeleton } from '../components/ui'
import useAsync from '../hooks/useAsync.js'
import { formatDateTime } from '../lib/formatDate.js'
import { PAYMENT_LABELS, returnLabel } from '../lib/orderLabels.js'
import styles from './OrderDetail.module.css'

function DetailBody({ order, onChanged }) {
  return (
    <>
      <section className={styles.card} aria-labelledby="order-progress-title">
        <h2 id="order-progress-title" className={styles.cardTitle}>
          Where your food is
        </h2>
        <OrderTimeline status={order.status} />
      </section>

      <section className={styles.card} aria-labelledby="order-items-title">
        <h2 id="order-items-title" className={styles.cardTitle}>
          What you ordered
        </h2>
        <OrderSummary
          lines={order.items}
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
            <dd>{PAYMENT_LABELS[order.payment_status] ?? order.payment_status}</dd>
          </div>
          <div>
            <dt>Return</dt>
            <dd>{returnLabel(order)}</dd>
          </div>
          {order.return_reason && (
            <div>
              <dt>Return reason</dt>
              <dd>{order.return_reason}</dd>
            </div>
          )}
        </dl>
      </section>

      {order.review && (
        <section className={styles.card} aria-labelledby="order-review-title">
          <h2 id="order-review-title" className={styles.cardTitle}>
            Your review
          </h2>
          <p>
            <span aria-label={`${order.review.rating} out of 5 stars`}>{'★'.repeat(order.review.rating)}{'☆'.repeat(5 - order.review.rating)}</span>
          </p>
          {order.review.comment && <p>{order.review.comment}</p>}
          <p className={styles.updated}>{formatDateTime(order.review.created_at)}</p>
        </section>
      )}

      {order.status === 'DELIVERED' && !order.review && (
        <section className={styles.card} aria-labelledby="order-review-form-title">
          <h2 id="order-review-form-title" className={styles.cardTitle}>
            How was it?
          </h2>
          <ReviewForm orderId={order.id} onDone={onChanged} />
        </section>
      )}

      {order.status === 'DELIVERED' && !order.return_status && (
        <section className={styles.card} aria-labelledby="order-return-title">
          <h2 id="order-return-title" className={styles.cardTitle}>
            Return or refund
          </h2>
          <ReturnForm orderId={order.id} onDone={onChanged} />
        </section>
      )}
    </>
  )
}

export default function OrderDetail() {
  const { orderId } = useParams()
  const { data: order, status, error, reload } = useAsync(() => orders.getOrder(orderId), [orderId])
  const [refreshed, setRefreshed] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const titleRef = useRef(null)

  function handleRefresh() {
    setRefreshed(true)
    reload()
  }

  // The Cancel button disappears once the order is cancelled, so hand focus to the heading.
  function finishCancel() {
    setCancelling(false)
    reload()
    titleRef.current?.focus()
  }

  if (status === 'error' && error?.status === 404) {
    return (
      <EmptyState
        headingLevel={1}
        title="We could not find that order"
        description="It may belong to someone else, or the link took a wrong turn."
        action={
          <Link className={styles.link} to="/orders">
            Back to your orders
          </Link>
        }
      />
    )
  }

  return (
    <div className={styles.page}>
      <Link className={styles.back} to="/orders">
        Back to your orders
      </Link>

      <header className={styles.intro}>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>
          Order #{orderId}
        </h1>
        {status === 'success' && (
          <>
            <p className={styles.lead}>From {order.restaurant_name}</p>
            <OrderStatusBadge status={order.status} />
          </>
        )}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={handleRefresh} loading={status === 'loading'}>
            Refresh
          </Button>
          {status === 'success' && order.status === 'PLACED' && (
            <Button variant="danger" onClick={() => setCancelling(true)}>
              Cancel order
            </Button>
          )}
        </div>
        <p className={styles.updated} role="status">
          {refreshed && status === 'success' ? 'Updated' : ''}
        </p>
      </header>

      {status === 'loading' && (
        <div className={styles.loading} role="status" aria-label="Loading your order">
          <Skeleton variant="block" />
          <Skeleton variant="block" />
        </div>
      )}

      {status === 'error' && (
        <div className={styles.error} role="alert">
          <p>{error?.message ?? 'Your order did not load.'} Give it another go.</p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}

      {status === 'success' && <DetailBody order={order} onChanged={reload} />}

      {cancelling && (
        <CancelOrderDialog order={order} onClose={() => setCancelling(false)} onDone={finishCancel} />
      )}
    </div>
  )
}
