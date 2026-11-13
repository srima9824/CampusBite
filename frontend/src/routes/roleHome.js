const ROLE_HOMES = {
  // Customers land on "/" until the restaurant list route exists.
  CUSTOMER: '/',
  OWNER: '/owner',
  DELIVERY_PARTNER: '/delivery',
}

export function roleHome(role) {
  return ROLE_HOMES[role] ?? '/'
}
