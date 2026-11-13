import { useRef } from 'react'
import OrderFilters from '../components/OrderFilters.jsx'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'
import OwnerOrderActions from '../components/OwnerOrderActions.jsx'
import { Button, EmptyState, Pagination, Skeleton, Table } from '../components/ui'
import useOrderFilters from '../hooks/useOrderFilters.js'
import useOrders from '../hooks/useOrders.js'
import useOwnRestaurant from '../hooks/useOwnRestaurant.js'
import usePartners from '../hooks/usePartners.js'
import { formatDateTime } from '../lib/formatDate.js'
import { formatMoney } from '../lib/formatMoney.js'
import styles from './OwnerOrders.module.css'

const PAGE_SIZE = 10
const SKELETON_ROWS = 4

function countItems(order) {
  const count = order.items.reduce((sum, line) => sum + line.quantity, 0)
  return count === 1 ? '1 item' : `${count} items`
}

function OrderLines({ order }) {
  return (
    <details className={styles.details}>
      <summary className={styles.summary}>
        {countItems(order)}
        <span className="visually-hidden"> in order #{order.id}</span>
      </summary>
      <ul className={styles.lines}>
        {order.items.map((line) => (
          <li key={line.menu_item_id}>
            {line.quantity} x {line.name}
          </li>
        ))}
      </ul>
      <p>Deliver to: {order.delivery_address}</p>
      {order.note && <p>Note: {order.note}</p>}
    </details>
  )
}

function LoadingRows() {
  return (
    <div className={styles.loading} role="status" aria-label="Loading incoming orders">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton key={index} variant="block" />
      ))}
    </div>
  )
}

export default function OwnerOrders() {
  const { filters, page, rangeInvalid, isFiltered, query, applyFilters, goToPage, backToFirstPage, clearFilters } =
    useOrderFilters()
  const { data, status, error, reload } = useOrders(query)
  const { data: restaurant } = useOwnRestaurant()
  const { data: partners } = usePartners()
  const titleRef = useRef(null)

  // A row can disappear (filtered out) or its buttons swap, so hand focus to the heading.
  function finishAction() {
    reload()
    titleRef.current?.focus()
  }

  const columns = [
    { key: 'id', header: 'Order', render: (order) => <span className={styles.orderNumber}>#{order.id}</span> },
    { key: 'customer', header: 'Customer', render: (order) => order.customer_name },
    { key: 'date', header: 'Placed', render: (order) => formatDateTime(order.created_at) },
    { key: 'items', header: 'Items', render: (order) => <OrderLines order={order} /> },
    { key: 'total', header: 'Total', render: (order) => formatMoney(order.total) },
    { key: 'status', header: 'Status', render: (order) => <OrderStatusBadge status={order.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (order) => <OwnerOrderActions order={order} partners={partners} onDone={finishAction} />,
    },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>
          {restaurant ? `${restaurant.name} orders` : 'Incoming orders'}
        </h1>
        <p className={styles.lead}>Tickets for your kitchen, newest first. Move each one along when you are ready.</p>
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

      {status === 'success' && data.items.length === 0 && page > 1 && (
        <EmptyState
          title="That page is empty"
          description="Those orders are not here anymore. Head back to the start of the list."
          action={<Button onClick={backToFirstPage}>Back to first page</Button>}
        />
      )}

      {status === 'success' && data.items.length === 0 && page === 1 && (
        <EmptyState
          title={isFiltered ? 'No orders match those filters' : 'No orders yet, the oven is bored'}
          description={
            isFiltered
              ? 'Try another status or a wider date range.'
              : 'When a customer orders from your kitchen, the ticket lands right here.'
          }
          action={isFiltered ? <Button onClick={clearFilters}>Clear filters</Button> : null}
        />
      )}

      {status === 'success' && data.items.length > 0 && (
        <>
          <Table caption="Incoming orders" hideCaption columns={columns} rows={data.items} getRowKey={(order) => order.id} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={goToPage} />
        </>
      )}
    </div>
  )
}
