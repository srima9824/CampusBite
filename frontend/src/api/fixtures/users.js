const PASSWORD = 'bite-fixture-1'

const people = [
  { id: 1, name: 'Maya Patel', email: 'maya@campusbite.test', role: 'CUSTOMER' },
  { id: 2, name: 'Leo Chen', email: 'leo@campusbite.test', role: 'CUSTOMER' },
  { id: 3, name: 'Sam Okafor', email: 'sam@campusbite.test', role: 'DELIVERY_PARTNER' },
  { id: 4, name: 'Priya Nair', email: 'priya@campusbite.test', role: 'DELIVERY_PARTNER' },
  { id: 5, name: 'Jonah Reyes', email: 'jonah@campusbite.test', role: 'DELIVERY_PARTNER' },
]

const owners = Array.from({ length: 8 }, (_, index) => ({
  id: 6 + index,
  name: `Owner ${index + 1}`,
  email: `owner${index + 1}@campusbite.test`,
  role: 'OWNER',
  restaurant_id: index + 1,
}))

export const users = [...people, ...owners].map((user) => ({ ...user, password: PASSWORD }))
