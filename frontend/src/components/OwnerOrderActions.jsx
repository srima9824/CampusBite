import { useState } from 'react'
import { orders } from '../api'
import { STATUS_LABELS, ownerNextAction } from '../api/orderStatus.js'
import { Button, Select, useToast } from './ui'
import styles from './OwnerOrderActions.module.css'

// `partners` is null until the pool has loaded. `onDone` runs after every attempt so the page reloads and shows the truth.
export default function OwnerOrderActions({ order, partners, onDone }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [partnerId, setPartnerId] = useState(String(order.delivery_partner_id ?? ''))
  const next = ownerNextAction(order.status)

  async function attempt(request, successMessage) {
    setBusy(true)
    try {
      await request()
      toast.success(successMessage)
    } catch (error) {
      toast.error(error.message ?? 'That did not go through. Please try again.')
    }
    setBusy(false)
    onDone()
  }

  function advance() {
    attempt(
      () => orders.updateOrderStatus(order.id, { status: next.status }),
      `Order #${order.id} is now ${STATUS_LABELS[next.status].toLowerCase()}`,
    )
  }

  function assign() {
    const partner = partners.find((candidate) => String(candidate.id) === partnerId)
    attempt(
      () => orders.assignPartner(order.id, { delivery_partner_id: Number(partnerId) }),
      `${partner.name} will bring order #${order.id}`,
    )
  }

  if (next) {
    return (
      <Button loading={busy} onClick={advance} aria-label={`${next.label} #${order.id}`}>
        {next.label}
      </Button>
    )
  }

  if (order.status === 'READY') {
    const options = [
      { value: '', label: 'Choose a rider' },
      ...(partners ?? []).map((partner) => ({ value: String(partner.id), label: partner.name })),
    ]
    return (
      <div className={styles.assign}>
        {order.delivery_partner && <p className={styles.current}>Rider: {order.delivery_partner.name}</p>}
        <Select
          label={`Rider for order #${order.id}`}
          options={options}
          value={partnerId}
          disabled={!partners || busy}
          onChange={(event) => setPartnerId(event.target.value)}
        />
        <Button
          variant="secondary"
          loading={busy}
          disabled={!partnerId || partnerId === String(order.delivery_partner_id ?? '')}
          onClick={assign}
          aria-label={`Assign rider to order #${order.id}`}
        >
          Assign rider
        </Button>
      </div>
    )
  }

  if (order.delivery_partner) {
    return <p className={styles.current}>With rider {order.delivery_partner.name}</p>
  }
  return null
}
