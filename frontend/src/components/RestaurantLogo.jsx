import { useState } from 'react'
import styles from './RestaurantLogo.module.css'

export default function RestaurantLogo({ restaurant, size = 'sm' }) {
  // Remember which url broke so a later restaurant with a good url still renders its image.
  const [brokenUrl, setBrokenUrl] = useState(null)
  const url = restaurant.logo_url
  const showImage = Boolean(url) && brokenUrl !== url

  return (
    <span className={`${styles.tile} ${styles[size]}`} aria-hidden="true">
      {showImage ? (
        <img className={styles.image} src={url} alt="" onError={() => setBrokenUrl(url)} />
      ) : (
        restaurant.name.charAt(0)
      )}
    </span>
  )
}
