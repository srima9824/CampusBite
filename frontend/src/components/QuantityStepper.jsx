import { Button } from './ui'
import styles from './QuantityStepper.module.css'

const MIN_QUANTITY = 1
const MAX_QUANTITY = 20

export default function QuantityStepper({ name, quantity, onChange }) {
  return (
    <div className={styles.stepper} role="group" aria-label={`Quantity of ${name}`}>
      <Button
        variant="secondary"
        aria-label={`Remove one ${name}`}
        disabled={quantity <= MIN_QUANTITY}
        onClick={() => onChange(quantity - 1)}
      >
        <span aria-hidden="true">-</span>
      </Button>
      <span className={styles.count} aria-live="polite">
        {quantity}
      </span>
      <Button
        variant="secondary"
        aria-label={`Add one more ${name}`}
        disabled={quantity >= MAX_QUANTITY}
        onClick={() => onChange(quantity + 1)}
      >
        <span aria-hidden="true">+</span>
      </Button>
    </div>
  )
}
