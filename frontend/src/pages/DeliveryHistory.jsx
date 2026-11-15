import { useSearchParams } from 'react-router-dom'
import { delivery } from '../api'
import { Button, EmptyState, Pagination, Skeleton, Table } from '../components/ui'
import useDeliveries from '../hooks/useDeliveries.js'
import { formatDateTime } from '../lib/formatDate.js'
import styles from './DeliveryHistory.module.css'

const SKELETON_ROWS = 4

const COLUMNS = [
  { key: 'id', header: 'Order', render: (order) => <span className={styles.orderNumber}>#{order.id}</span> },
  { key: 'restaurant', header: 'Restaurant', render: (order) => order.restaurant.name },
  { key: 'customer', header: 'Customer', render: (order) => order.customer.name },
  { key: 'address', header: 'Dropped at', render: (order) => order.delivery_address },
  { key: 'delivered', header: 'Delivered', render: (order) => formatDateTime(order.updated_at) },
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
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, status, error, reload } = useDeliveries({ status: 'DELIVERED', page })

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Delivery history</h1>
        <p className={styles.lead}>Orders you delivered, newest first.</p>
      </header>

      {status === 'loading' && <LoadingRows />}

      {status === 'error' && (
        <div className={styles.error} role="alert">
          <p>{error?.message ?? 'Your history did not load.'}</p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}

      {status === 'success' && data.items.length === 0 && page > 1 && (
        <EmptyState
          title="That page is empty"
          description="Head back to the start of the list."
          action={<Button onClick={() => setParams({}, { replace: true })}>Back to first page</Button>}
        />
      )}

      {status === 'success' && data.items.length === 0 && page === 1 && (
        <EmptyState title="No deliveries yet" description="Orders you mark delivered appear here." />
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
          <Pagination
            page={page}
            pageSize={delivery.DELIVERY_PAGE_SIZE}
            total={data.total}
            onChange={(next) => setParams({ page: String(next) })}
          />
        </>
      )}
    </div>
  )
}
