import { useId } from 'react'
import { Link } from 'react-router-dom'
import RestaurantLogo from './RestaurantLogo.jsx'
import { Badge } from './ui'
import styles from './RestaurantCard.module.css'

export default function RestaurantCard({ restaurant }) {
  const nameId = useId()
  return (
    <Link
      className={styles.card}
      to={`/restaurants/${restaurant.id}`}
      aria-labelledby={nameId}
    >
      <RestaurantLogo restaurant={restaurant} />
      <span className={styles.body}>
        <span id={nameId} className={styles.name}>
          {restaurant.name}
        </span>
        <Badge tone="info">{restaurant.cuisine}</Badge>
        <span className={styles.description}>{restaurant.description}</span>
      </span>
    </Link>
  )
}
