import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { owner } from '../api'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'
import { Badge, Button, EmptyState, Pagination, Select, Skeleton, Table, useToast } from '../components/ui'
import { useOwnerReturns } from '../hooks/useOwnerData.js'
import { formatDateTime } from '../lib/formatDate.js'
import { formatMoney } from '../lib/formatMoney.js'
import styles from './OwnerOrders.module.css'

const PAGE_SIZE = 10
const RETURN_LABELS = { REQUESTED: 'Waiting for a decision', APPROVED: 'Approved', REJECTED: 'Rejected' }
const RETURN_TONES = { REQUESTED: 'warning', APPROVED: 'success', REJECTED: 'danger' }
const FILTER_OPTIONS = [
  { value: '', label: 'All requests' },
  ...Object.entries(RETURN_LABELS).map(([value, label]) => ({ value, label })),
]

function DecisionButtons({ order, onDone }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function decide(decision) {
    setBusy(true)
    try {
      await owner.decideReturn(order.id, decision)
      toast.success(`Return for order #${order.id} ${decision === 'APPROVED' ? 'approved and refunded' : 'rejected'}`)
    } catch (error) {
      toast.error(error.message ?? 'That did not go through. Please try again.')
    }
    setBusy(false)
    onDone()
  }

  return (
    <span className={styles.actionRow}>
      <Button loading={busy} onClick={() => decide('APPROVED')} aria-label={`Approve return for order #${order.id}`}>
        Approve
      </Button>
      <Button variant="secondary" disabled={busy} onClick={() => decide('REJECTED')} aria-label={`Reject return for order #${order.id}`}>
        Reject
      </Button>
    </span>
  )
}

export default function OwnerReturns() {
  const [params, setParams] = useSearchParams()
  const returnStatus = Object.keys(RETURN_LABELS).includes(params.get('return_status')) ? params.get('return_status') : ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, status, error, reload } = useOwnerReturns({ return_status: returnStatus, page })

  function go(nextStatus, nextPage) {
    const next = {}
    if (nextStatus) next.return_status = nextStatus
    if (nextPage > 1) next.page = String(nextPage)
    setParams(next)
  }

  const columns = [
    { key: 'id', header: 'Order', render: (order) => <span className={styles.orderNumber}>#{order.id}</span> },
    { key: 'customer', header: 'Customer', render: (order) => order.customer_name },
    { key: 'reason', header: 'Reason', render: (order) => order.return_reason },
    { key: 'asked', header: 'Asked', render: (order) => formatDateTime(order.return_requested_at) },
    { key: 'total', header: 'Total', render: (order) => formatMoney(order.total) },
    {
      key: 'status',
      header: 'Return',
      render: (order) => (
        <span className={styles.actionRow}>
          <Badge tone={RETURN_TONES[order.return_status]}>{RETURN_LABELS[order.return_status]}</Badge>
          {order.status === 'REFUNDED' && <OrderStatusBadge status="REFUNDED" />}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (order) => (order.return_status === 'REQUESTED' ? <DecisionButtons order={order} onDone={reload} /> : null),
    },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Returns</h1>
        <p className={styles.lead}>Customers ask for a return after delivery. Approving refunds the order.</p>
      </header>

      <Select
        label="Show"
        options={FILTER_OPTIONS}
        value={returnStatus}
        onChange={(event) => go(event.target.value, 1)}
      />

      {status === 'loading' && (
        <div className={styles.loading} role="status" aria-label="Loading return requests">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} variant="block" />
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className={styles.error} role="alert">
          <p>{error?.message ?? 'Your return requests did not load.'} Give it another go.</p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}

      {status === 'success' && data.items.length === 0 && page > 1 && (
        <EmptyState
          title="That page is empty"
          description="Head back to the start of the list."
          action={<Button onClick={() => go(returnStatus, 1)}>Back to first page</Button>}
        />
      )}

      {status === 'success' && data.items.length === 0 && page === 1 && (
        <EmptyState
          title={returnStatus ? 'No return requests match' : 'No return requests'}
          description={returnStatus ? 'Try another filter.' : 'When a customer asks for a return, it shows up here.'}
        />
      )}

      {status === 'success' && data.items.length > 0 && (
        <>
          <Table caption="Return requests" hideCaption columns={columns} rows={data.items} getRowKey={(order) => order.id} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={(next) => go(returnStatus, next)} />
        </>
      )}
    </div>
  )
}
