import { Badge } from './ui'
import { formatMoney } from '../lib/formatMoney.js'
import styles from './MenuItemCard.module.css'

export default function MenuItemCard({ item, action }) {
  const soldOut = !item.is_available
  return (
    <article className={`${styles.card} ${soldOut ? styles.soldOut : ''}`}>
      <div className={styles.top}>
        <h3 className={styles.name}>
          <span
            className={`${styles.diet} ${item.is_veg ? styles.veg : styles.nonVeg}`}
            role="img"
            aria-label={item.is_veg ? 'Vegetarian' : 'Non-vegetarian'}
          />
          {item.name}
        </h3>
        <span className={styles.price}>{formatMoney(item.price)}</span>
      </div>
      <p className={styles.description}>{item.description}</p>
      <div className={styles.footer}>
        <Badge>{item.category}</Badge>
        {soldOut && <Badge tone="warning">Sold out</Badge>}
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </article>
  )
}
