import OrderFilters from '../components/OrderFilters.jsx'
import { Button, EmptyState, Pagination, Skeleton, Table } from '../components/ui'
import useOrderFilters from '../hooks/useOrderFilters.js'
import useOrders from '../hooks/useOrders.js'
import { formatDateTime } from '../lib/formatDate.js'
import { formatMoney } from '../lib/formatMoney.js'
import styles from './DeliveryHistory.module.css'

const PAGE_SIZE = 10
const SKELETON_ROWS = 4

function deliveredAt(order) {
  const entry = order.status_history.findLast((step) => step.status === 'DELIVERED')
  return formatDateTime(entry?.changed_at ?? order.updated_at)
}

const COLUMNS = [
  { key: 'id', header: 'Order', render: (order) => <span className={styles.orderNumber}>#{order.id}</span> },
  { key: 'restaurant', header: 'Restaurant', render: (order) => order.restaurant_name },
  { key: 'address', header: 'Dropped at', render: (order) => order.delivery_address },
  { key: 'delivered', header: 'Delivered', render: deliveredAt },
  { key: 'total', header: 'Total', render: (order) => formatMoney(order.total) },
]

function LoadingRows() {
  return (
    <div className={styles.loading} role="status" aria-label="Loading your delivery history">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton key={index} variant="block" />
      ))}
    </div>
  )
}

export default function DeliveryHistory() {
  const { filters, page, rangeInvalid, query, applyFilters, goToPage, backToFirstPage, clearFilters } =
    useOrderFilters()
  const { data, status, error, reload } = useOrders({ ...query, status: 'DELIVERED' })
  const isFiltered = Boolean(filters.date_from || filters.date_to)

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Delivery history</h1>
        <p className={styles.lead}>Every bag you got to the door, newest first.</p>
      </header>

      <OrderFilters
        hideStatus
        values={filters}
        onChange={applyFilters}
        onClear={clearFilters}
        rangeError={rangeInvalid ? 'The start date must not be after the end date.' : undefined}
      />

      {status === 'loading' && <LoadingRows />}

      {status === 'error' && (
        <div className={styles.error} role="alert">
          <p>{error?.message ?? 'Your history did not load.'} Give it another go.</p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}

      {status === 'success' && data.items.length === 0 && page > 1 && (
        <EmptyState
          title="That page is empty"
          description="Those deliveries are not here anymore. Head back to the start of the list."
          action={<Button onClick={backToFirstPage}>Back to first page</Button>}
        />
      )}

      {status === 'success' && data.items.length === 0 && page === 1 && (
        <EmptyState
          title={isFiltered ? 'No deliveries in those dates' : 'No finished drops yet'}
          description={
            isFiltered
              ? 'Try a wider date range.'
              : 'Once you mark an order delivered, it lands here for the record books.'
          }
          action={isFiltered ? <Button onClick={clearFilters}>Clear filters</Button> : null}
        />
      )}

      {status === 'success' && data.items.length > 0 && (
        <>
          <Table
            caption="Delivered orders"
            hideCaption
            columns={COLUMNS}
            rows={data.items}
            getRowKey={(order) => order.id}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={goToPage} />
        </>
      )}
    </div>
  )
}
