import { startTransition } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { useAuth } from '../context/AuthContext.jsx'
import styles from './AppShell.module.css'

const HOME_LINK = { to: '/', label: 'Home', end: true }
const STYLEGUIDE_LINK = { to: '/styleguide', label: 'Styleguide' }

// Only routes that exist are linked; later units add their links here.
const ROLE_LINKS = {
  guest: [
    { to: '/login', label: 'Log in' },
    { to: '/register', label: 'Sign up' },
  ],
  CUSTOMER: [],
  OWNER: [{ to: '/owner', label: 'Orders' }],
  DELIVERY_PARTNER: [{ to: '/delivery', label: 'Deliveries' }],
}

function linksFor(user) {
  return [HOME_LINK, ...ROLE_LINKS[user?.role ?? 'guest'], STYLEGUIDE_LINK]
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const { state } = useLocation()
  const navigate = useNavigate()
  const notice = state?.notice

  function handleLogout() {
    // Router state updates run in a transition, so clear the session in the same one;
    // otherwise ProtectedRoute sees anonymous first and redirects to /login.
    startTransition(() => {
      navigate('/')
      logout()
    })
  }

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
              {linksFor(user).map(({ to, label, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} className={styles.navLink}>
                    {label}
                  </NavLink>
                </li>
              ))}
              {user && (
                <li className={styles.account}>
                  <span className={styles.userName}>{user.name}</span>
                  <Button variant="secondary" onClick={handleLogout}>
                    Log out
                  </Button>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className={styles.main}>
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p>Made by students, for students. Seconds not included.</p>
      </footer>
    </div>
  )
}
