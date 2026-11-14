import { Link } from 'react-router-dom'
import RestaurantLogo from './RestaurantLogo.jsx'
import { Badge, Button, Skeleton } from './ui'
import useCarousel from '../hooks/useCarousel.js'
import useRestaurants from '../hooks/useRestaurants.js'
import styles from './RestaurantCarousel.module.css'

const SLIDE_COUNT = 8
const ADVANCE_MS = 5000

function CarouselLoading() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Loading featured kitchens">
      <Skeleton width="100%" height="100%" />
    </div>
  )
}

export default function RestaurantCarousel() {
  const { data, status, error, reload } = useRestaurants({ q: '', page: 1, page_size: SLIDE_COUNT })
  const items = data?.items ?? []
  const carousel = useCarousel(items.length, ADVANCE_MS)

  if (status === 'loading') return <CarouselLoading />

  if (status === 'error') {
    return (
      <div className={styles.error} role="alert">
        <p>{error?.message ?? 'The featured kitchens did not load.'} Give it another go.</p>
        <Button onClick={reload}>Retry</Button>
      </div>
    )
  }

  if (items.length === 0) return null

  const { index, paused } = carousel

  function handleKeyDown(event) {
    if (event.key === 'ArrowRight') carousel.next()
    if (event.key === 'ArrowLeft') carousel.prev()
  }

  function handleBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) carousel.setFocused(false)
  }

  return (
    <section
      className={styles.carousel}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured kitchens"
      onMouseEnter={() => carousel.setHovered(true)}
      onMouseLeave={() => carousel.setHovered(false)}
      onFocus={() => carousel.setFocused(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.viewport} aria-live={carousel.live} {...carousel.swipe}>
        {items.map((restaurant, position) => {
          const active = position === index
          return (
            <div
              key={restaurant.id}
              className={`${styles.slide} ${active ? styles.active : ''}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${position + 1} of ${items.length}: ${restaurant.name}`}
              aria-hidden={active ? undefined : true}
              inert={!active}
            >
              <img
                className={styles.photo}
                src={restaurant.image_url}
                alt=""
                loading={position === 0 ? undefined : 'lazy'}
                draggable="false"
              />
              <div className={styles.scrim}>
                <RestaurantLogo restaurant={restaurant} size="chip" />
                <h2 className={styles.name}>
                  <Link
                    className={styles.link}
                    to={`/restaurants/${restaurant.id}`}
                    aria-label={`${restaurant.name}, see the menu`}
                  >
                    {restaurant.name}
                  </Link>
                </h2>
                <Badge tone="info">{restaurant.cuisine}</Badge>
                <span className={styles.cta} aria-hidden="true">
                  See the menu
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.controls}>
        <Button variant="secondary" onClick={carousel.prev} aria-label="Previous kitchen">
          Previous
        </Button>
        <Button variant="secondary" onClick={carousel.togglePause}>
          {paused ? 'Play slideshow' : 'Pause slideshow'}
        </Button>
        <Button variant="secondary" onClick={carousel.next} aria-label="Next kitchen">
          Next
        </Button>
        <div className={styles.dots}>
          {items.map((restaurant, position) => (
            <button
              key={restaurant.id}
              type="button"
              className={styles.dot}
              aria-label={`Show kitchen ${position + 1}: ${restaurant.name}`}
              aria-current={position === index ? 'true' : undefined}
              onClick={() => carousel.goTo(position)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
