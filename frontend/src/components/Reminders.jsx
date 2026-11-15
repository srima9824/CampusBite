import { useOwnerReminders } from '../hooks/useOwnerData.js'
import { Button } from './ui'
import { STATUS_LABELS } from '../api/orderStatus.js'
import styles from './Reminders.module.css'

function waited(minutes) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}

// View only: orders still PLACED or ACCEPTED after too long. Nothing shows when there are none.
export default function Reminders() {
  const { data, status, error, reload } = useOwnerReminders()

  if (status === 'loading') return <p className={styles.quiet} role="status">Checking for orders that need attention...</p>
  if (status === 'error') {
    return (
      <div className={styles.box} role="alert">
        <p>{error?.message ?? 'We could not check for stale orders.'}</p>
        <Button variant="secondary" onClick={reload}>
          Retry
        </Button>
      </div>
    )
  }
  if (data.items.length === 0) return null

  return (
    <section className={styles.box} aria-labelledby="needs-attention">
      <h2 id="needs-attention" className={styles.heading}>
        Needs attention
      </h2>
      <ul className={styles.list}>
        {data.items.map((reminder) => (
          <li key={reminder.id}>
            Order #{reminder.order_id} has been {STATUS_LABELS[reminder.order_status].toLowerCase()} for{' '}
            {waited(reminder.minutes_waiting)} with no update.
          </li>
        ))}
      </ul>
    </section>
  )
}
