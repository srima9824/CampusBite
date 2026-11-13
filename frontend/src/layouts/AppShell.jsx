import { NavLink, Outlet } from 'react-router-dom'
import styles from './AppShell.module.css'

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/styleguide', label: 'Styleguide' },
]

export default function AppShell() {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.wordmark}>CampusBite</span>
          <nav aria-label="Main">
            <ul className={styles.nav}>
              {NAV_LINKS.map(({ to, label, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} className={styles.navLink}>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p>Made by students, for students. Seconds not included.</p>
      </footer>
    </div>
  )
}
