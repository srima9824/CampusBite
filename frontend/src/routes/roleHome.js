const ROLE_HOMES = {
  CUSTOMER: '/restaurants',
  OWNER: '/owner',
  DELIVERY_PARTNER: '/delivery',
}

export function roleHome(role) {
  return ROLE_HOMES[role] ?? '/'
}
