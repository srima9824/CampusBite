import { Link } from 'react-router-dom'
import RestaurantCarousel from '../components/RestaurantCarousel.jsx'
import styles from './Home.module.css'

export default function Home() {
  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <h1 className={styles.title}>Hungry? Pick a kitchen.</h1>
        <p className={styles.lead}>Eight campus favourites, one tap away.</p>
        <Link className={styles.link} to="/restaurants">
          Browse all kitchens
        </Link>
      </section>
      <RestaurantCarousel />
    </div>
  )
}
