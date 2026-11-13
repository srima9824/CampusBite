import { useRef, useState } from 'react'
import DeliveryOrderCard from '../components/DeliveryOrderCard.jsx'
import { Button, EmptyState, Pagination, Select, Skeleton } from '../components/ui'
import useOrderFilters from '../hooks/useOrderFilters.js'
import useOrders from '../hooks/useOrders.js'
import styles from './DeliveryAssignments.module.css'

const PAGE_SIZE = 10
const SKELETON_CARDS = 3
const ACTIVE_STATUSES = 'READY,OUT_FOR_DELIVERY'
const STATUS_OPTIONS = [
  { value: '', label: 'All active' },
  { value: 'READY', label: 'Ready for pickup' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
]

function LoadingCards() {
  return (
    <div className={styles.loading} role="status" aria-label="Loading your deliveries">
      {Array.from({ length: SKELETON_CARDS }, (_, index) => (
        <Skeleton key={index} variant="block" />
      ))}
    </div>
  )
}

export default function DeliveryAssignments() {
  const { filters, page, goToPage, applyFilters, backToFirstPage, clearFilters } = useOrderFilters()
  const status = STATUS_OPTIONS.some((option) => option.value === filters.status) ? filters.status : ''
  const { data, status: loadStatus, error, reload } = useOrders({ status: status || ACTIVE_STATUSES, page })
  const [refreshed, setRefreshed] = useState(false)
  const titleRef = useRef(null)

  // A card can leave the list once delivered, so hand focus to the heading.
  function finishAction() {
    reload()
    titleRef.current?.focus()
  }

  function refresh() {
    setRefreshed(true)
    reload()
  }

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>
          Your deliveries
        </h1>
        <p className={styles.lead}>Hot bags waiting on you. Pick up, drop off, repeat.</p>
      </header>

      <div className={styles.toolbar}>
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) => applyFilters({ ...filters, status: event.target.value })}
        />
        <Button variant="secondary" onClick={refresh}>
          Refresh
        </Button>
      </div>
      {refreshed && loadStatus === 'success' && (
        <p className="visually-hidden" role="status">
          Updated
        </p>
      )}

      {loadStatus === 'loading' && <LoadingCards />}

      {loadStatus === 'error' && (
        <div className={styles.error} role="alert">
          <p>{error?.message ?? 'Your deliveries did not load.'} Give it another go.</p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}

      {loadStatus === 'success' && data.items.length === 0 && page > 1 && (
        <EmptyState
          title="That page is empty"
          description="Those deliveries are not here anymore. Head back to the start of the list."
          action={<Button onClick={backToFirstPage}>Back to first page</Button>}
        />
      )}

      {loadStatus === 'success' && data.items.length === 0 && page === 1 && (
        <EmptyState
          title="No drops right now, enjoy the quiet"
          description={
            status
              ? 'Nothing matches that status. Try all active deliveries.'
              : 'When a kitchen hands you an order, it shows up here. Past drops live in History.'
          }
          action={status ? <Button onClick={clearFilters}>Show all active</Button> : null}
        />
      )}

      {loadStatus === 'success' && data.items.length > 0 && (
        <>
          <ul className={styles.cards}>
            {data.items.map((order) => (
              <li key={order.id}>
                <DeliveryOrderCard order={order} onDone={finishAction} />
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={goToPage} />
        </>
      )}
    </div>
  )
}
