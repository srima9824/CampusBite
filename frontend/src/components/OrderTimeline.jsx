import { STATUS_LABELS } from '../api/orderStatus.js'
import { formatDateTime } from '../lib/formatDate.js'
import styles from './OrderTimeline.module.css'

const FORWARD_STEPS = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']
const STATE_TEXT = { done: 'Done', current: 'Now', upcoming: 'Up next' }

// A cancelled order keeps the steps it reached and ends on "Cancelled".
function stepsFor(status, history) {
  const reached = new Set(history.map((entry) => entry.status))
  if (status === 'CANCELLED') return [...FORWARD_STEPS.filter((step) => reached.has(step)), 'CANCELLED']
  return FORWARD_STEPS
}

function stateOf(step, status, steps) {
  if (step === status) return 'current'
  return steps.indexOf(step) < steps.indexOf(status) ? 'done' : 'upcoming'
}

export default function OrderTimeline({ status, history }) {
  const steps = stepsFor(status, history)

  return (
    <ol className={styles.timeline} aria-label="Order progress">
      {steps.map((step) => {
        const state = stateOf(step, status, steps)
        const entry = history.find((candidate) => candidate.status === step)
        return (
          <li
            key={step}
            className={`${styles.step} ${styles[state]} ${step === 'CANCELLED' ? styles.cancelled : ''}`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className={styles.marker} aria-hidden="true" />
            <span className={styles.label}>{STATUS_LABELS[step]}</span>
            <span className={styles.state}>{STATE_TEXT[state]}</span>
            {entry && (
              <time className={styles.time} dateTime={entry.changed_at}>
                {formatDateTime(entry.changed_at)}
              </time>
            )}
          </li>
        )
      })}
    </ol>
  )
}
