import { STATUS_LABELS } from '../api/orderStatus.js'
import styles from './OrderTimeline.module.css'

const FORWARD_STEPS = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED']
const STATE_TEXT = { done: 'Done', current: 'Now', upcoming: 'Up next' }

// The backend keeps no history, so the steps come from the current status alone.
// Only a PLACED order can be cancelled; a refunded order was delivered first.
function stepsFor(status) {
  if (status === 'CANCELLED') return ['PLACED', 'CANCELLED']
  if (status === 'REFUNDED') return [...FORWARD_STEPS, 'REFUNDED']
  return FORWARD_STEPS
}

function stateOf(step, status, steps) {
  if (step === status) return 'current'
  return steps.indexOf(step) < steps.indexOf(status) ? 'done' : 'upcoming'
}

export default function OrderTimeline({ status }) {
  const steps = stepsFor(status)

  return (
    <ol className={styles.timeline} aria-label="Order progress">
      {steps.map((step) => {
        const state = stateOf(step, status, steps)
        return (
          <li
            key={step}
            className={`${styles.step} ${styles[state]} ${step === 'CANCELLED' ? styles.cancelled : ''}`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className={styles.marker} aria-hidden="true" />
            <span className={styles.label}>{STATUS_LABELS[step]}</span>
            <span className={styles.state}>{STATE_TEXT[state]}</span>
          </li>
        )
      })}
    </ol>
  )
}
