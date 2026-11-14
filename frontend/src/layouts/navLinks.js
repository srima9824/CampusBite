export const HOME_LINK = { to: '/', label: 'Home', end: true }
export const CART_LINK = { to: '/cart', label: 'Cart' }
const RESTAURANTS_LINK = { to: '/restaurants', label: 'Restaurants' }

// Only routes that exist are linked; later units add their links here.
export const ROLE_LINKS = {
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

export function roleLinksFor(user) {
  return ROLE_LINKS[user?.role ?? 'guest']
}
