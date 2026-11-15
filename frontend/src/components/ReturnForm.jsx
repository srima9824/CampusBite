import { useState } from 'react'
import { orders } from '../api'
import { Button } from './ui'
import styles from './OrderForms.module.css'

export default function ReturnForm({ orderId, onDone }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (reason.trim().length < 5) {
      setError('Tell us the reason in at least 5 characters.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await orders.requestReturn(orderId, { reason })
      onDone()
    } catch (failure) {
      setError(failure.message)
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-label="Request a return">
      <div className={styles.field}>
        <label htmlFor="return-reason">Reason for the return</label>
        <textarea
          id="return-reason"
          className={styles.textarea}
          rows={3}
          maxLength={300}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" loading={loading}>
        Request return
      </Button>
    </form>
  )
}
