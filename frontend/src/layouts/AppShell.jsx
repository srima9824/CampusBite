import { startTransition } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import styles from './AppShell.module.css'

const HOME_LINK = { to: '/', label: 'Home', end: true }
const RESTAURANTS_LINK = { to: '/restaurants', label: 'Restaurants' }
const CART_LINK = { to: '/cart', label: 'Cart' }
const STYLEGUIDE_LINK = { to: '/styleguide', label: 'Styleguide' }

// Only routes that exist are linked; later units add their links here.
const ROLE_LINKS = {
  guest: [
    RESTAURANTS_LINK,
    CART_LINK,
    { to: '/login', label: 'Log in' },
    { to: '/register', label: 'Sign up' },
  ],
  CUSTOMER: [RESTAURANTS_LINK, { to: '/orders', label: 'My orders' }, CART_LINK],
  OWNER: [
    { to: '/owner', label: 'Orders', end: true },
    { to: '/owner/stats', label: 'Stats' },
    { to: '/owner/menu', label: 'Menu' },
  ],
  DELIVERY_PARTNER: [
    { to: '/delivery', label: 'Deliveries', end: true },
    { to: '/delivery/history', label: 'History' },
  ],
}

function linksFor(user) {
  return [HOME_LINK, ...ROLE_LINKS[user?.role ?? 'guest'], STYLEGUIDE_LINK]
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const { itemCount } = useCart()
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
              {linksFor(user).map(({ to, label, end }) => {
                const count = to === CART_LINK.to ? itemCount : 0
                return (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      className={styles.navLink}
                      aria-label={count ? `${label}, ${count} ${count === 1 ? 'item' : 'items'}` : undefined}
                    >
                      {label}
                      {count > 0 && (
                        <span className={styles.count} aria-hidden="true">
                          {count}
                        </span>
                      )}
                    </NavLink>
                  </li>
                )
              })}
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
