import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import CancelOrderDialog from '../components/CancelOrderDialog.jsx'
import OrderFilters from '../components/OrderFilters.jsx'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'
import { Button, EmptyState, Pagination, Skeleton, Table } from '../components/ui'
import useOrderFilters from '../hooks/useOrderFilters.js'
import useOrders from '../hooks/useOrders.js'
import { formatDateTime } from '../lib/formatDate.js'
import { formatMoney } from '../lib/formatMoney.js'
import styles from './Orders.module.css'

const PAGE_SIZE = 10
const SKELETON_ROWS = 4

function countItems(order) {
  const count = order.items.reduce((sum, line) => sum + line.quantity, 0)
  return count === 1 ? '1 item' : `${count} items`
}

function LoadingRows() {
  return (
    <div className={styles.loading} role="status" aria-label="Loading your orders">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton key={index} variant="block" />
      ))}
    </div>
  )
}

export default function Orders() {
  const { filters, page, rangeInvalid, isFiltered, query, applyFilters, goToPage, clearFilters } = useOrderFilters()
  const { data, status, error, reload } = useOrders(query)
  const [cancelling, setCancelling] = useState(null)
  const titleRef = useRef(null)

  // The Cancel button disappears with its row, so hand focus to the heading.
  function finishCancel() {
    setCancelling(null)
    reload()
    titleRef.current?.focus()
  }

  const columns = [
    { key: 'id', header: 'Order', render: (order) => <Link className={styles.orderLink} to={`/orders/${order.id}`}>#{order.id}</Link> },
    { key: 'restaurant', header: 'Restaurant', render: (order) => order.restaurant_name },
    { key: 'date', header: 'Placed', render: (order) => formatDateTime(order.created_at) },
    { key: 'items', header: 'Items', render: countItems },
    { key: 'total', header: 'Total', render: (order) => formatMoney(order.total) },
    { key: 'status', header: 'Status', render: (order) => <OrderStatusBadge status={order.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (order) =>
        order.status === 'PLACED' ? (
          <Button variant="secondary" onClick={() => setCancelling(order)}>
            Cancel order #{order.id}
          </Button>
        ) : null,
    },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>
          Your orders
        </h1>
        <p className={styles.lead}>Everything you have asked the kitchens for, newest first.</p>
      </header>

      <OrderFilters
        values={filters}
        onChange={applyFilters}
        onClear={clearFilters}
        rangeError={rangeInvalid ? 'The start date must not be after the end date.' : undefined}
      />

      {status === 'loading' && <LoadingRows />}

      {status === 'error' && (
        <div className={styles.error} role="alert">
          <p>{error?.message ?? 'Your orders did not load.'} Give it another go.</p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}

      {status === 'success' && data.items.length === 0 && (
        <EmptyState
          title={isFiltered ? 'No orders match those filters' : 'No orders yet, your stomach is waiting'}
          description={
            isFiltered
              ? 'Try another status or a wider date range.'
              : 'Pick a kitchen and your first order will show up right here.'
          }
          action={
            isFiltered ? (
              <Button onClick={clearFilters}>Clear filters</Button>
            ) : (
              <Link className={styles.link} to="/restaurants">
                Browse restaurants
              </Link>
            )
          }
        />
      )}

      {status === 'success' && data.items.length > 0 && (
        <>
          <Table caption="Your orders" hideCaption columns={columns} rows={data.items} getRowKey={(order) => order.id} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={goToPage} />
        </>
      )}

      {cancelling && (
        <CancelOrderDialog order={cancelling} onClose={() => setCancelling(null)} onDone={finishCancel} />
      )}
    </div>
  )
}
