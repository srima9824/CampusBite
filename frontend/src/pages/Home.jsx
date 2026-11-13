import { Link } from 'react-router-dom'
import styles from './Home.module.css'

export default function Home() {
  return (
    <section className={styles.home}>
      <h1 className={styles.title}>Hungry? The kitchen is still warming up.</h1>
      <p className={styles.lead}>
        CampusBite is being cooked up right now. Until the menu lands, peek at the look and feel
        in the styleguide.
      </p>
      <Link className={styles.link} to="/styleguide">
        Open the styleguide
      </Link>
    </section>
  )
}
