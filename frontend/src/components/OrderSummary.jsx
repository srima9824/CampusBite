import { formatMoney } from '../lib/formatMoney.js'
import styles from './OrderSummary.module.css'

export default function OrderSummary({ lines, total }) {
  return (
    <div className={styles.summary}>
      <ul className={styles.lines}>
        {lines.map((line) => (
          <li key={line.menu_item_id} className={styles.line}>
            <span>
              {line.quantity} x {line.name}
            </span>
            <span>{formatMoney(line.line_total)}</span>
          </li>
        ))}
      </ul>
      <dl className={styles.totals}>
        <div className={`${styles.row} ${styles.total}`}>
          <dt>Total</dt>
          <dd>{formatMoney(total)}</dd>
        </div>
      </dl>
    </div>
  )
}
