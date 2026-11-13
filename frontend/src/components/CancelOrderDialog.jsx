import { useState } from 'react'
import { orders } from '../api'
import { ConfirmDialog, useToast } from './ui'

// `onDone` runs after the attempt either way, so the caller reloads and shows the truth.
export default function CancelOrderDialog({ order, onClose, onDone }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await orders.cancelOrder(order.id)
      toast.success('Order cancelled')
    } catch (error) {
      toast.error(error.message ?? 'We could not cancel that order. Please try again.')
    }
    onDone()
  }

  return (
    <ConfirmDialog
      title={`Cancel order #${order.id}?`}
      message="You can only cancel before the restaurant accepts. This cannot be undone."
      confirmLabel="Cancel order"
      cancelLabel="Keep order"
      tone="danger"
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onClose}
    />
  )
}
