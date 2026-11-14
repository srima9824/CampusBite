import { describe, expect, it } from 'vitest'
import { ROLE_LABELS, ROLE_LINKS, roleLinksFor } from './navLinks.js'

describe('navLinks', () => {
  it('returns the guest links for no user', () => {
    expect(roleLinksFor(null).map((link) => link.label)).toEqual(['Restaurants', 'Cart', 'Log in', 'Sign up'])
  })

  it.each([
    ['CUSTOMER', ['Restaurants', 'My orders', 'Cart']],
    ['OWNER', ['Orders', 'Stats', 'Menu']],
    ['DELIVERY_PARTNER', ['Deliveries', 'History']],
  ])('returns the %s links', (role, labels) => {
    expect(roleLinksFor({ role }).map((link) => link.label)).toEqual(labels)
  })

  it('is the single table the header and footer read from', () => {
    expect(roleLinksFor({ role: 'OWNER' })).toBe(ROLE_LINKS.OWNER)
  })

  it('never lists the styleguide', () => {
    const all = Object.values(ROLE_LINKS).flat()

    expect(all.some((link) => link.to === '/styleguide' || /styleguide/i.test(link.label))).toBe(false)
  })

  it('labels every signed-in role', () => {
    expect(ROLE_LABELS).toEqual({
      CUSTOMER: 'Customer',
      OWNER: 'Owner',
      DELIVERY_PARTNER: 'Delivery partner',
    })
  })
})
