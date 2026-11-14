import { startTransition } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { CART_LINK, HOME_LINK, ROLE_LABELS, roleLinksFor } from './navLinks.js'
import styles from './AppShell.module.css'

function linksFor(user) {
  return [HOME_LINK, ...roleLinksFor(user)]
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
                  <span className={styles.profile}>
                    <span className={styles.avatar} aria-hidden="true">
                      {user.name.charAt(0)}
                    </span>
                    <span className={styles.identity}>
                      <span className="visually-hidden">Signed in as </span>
                      <span className={styles.profileName}>{user.name}</span>
                      <span className="visually-hidden">, </span>
                      <span className={styles.profileRole}>{ROLE_LABELS[user.role]}</span>
                    </span>
                  </span>
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
        <div className={styles.footerInner}>
          <p>
            CampusBite brings your campus kitchens to one tap. Browse menus, order in a minute
            and track your food from the pan to your door.
          </p>
          <p className={styles.copyright}>
            &copy; {new Date().getFullYear()} CampusBite. Made by students, for students.
          </p>
        </div>
      </footer>
    </div>
  )
}
