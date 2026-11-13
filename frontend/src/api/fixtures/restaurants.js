const CREATED_AT = '2026-01-05T08:00:00Z'

export const restaurants = [
  { id: 1, name: 'Dosa Dash', cuisine: 'South Indian', description: 'Crisp dosas and fluffy idlis, served before your lecture ends.' },
  { id: 2, name: 'Noodle Nook', cuisine: 'Asian', description: 'Slurp-worthy noodles and stir-fries in a cosy corner.' },
  { id: 3, name: 'Burger Barn', cuisine: 'American', description: 'Stacked burgers and golden fries for serious appetites.' },
  { id: 4, name: 'Pizza Pronto', cuisine: 'Italian', description: 'Wood-fired slices that arrive faster than your group chat.' },
  { id: 5, name: 'Taco Tuesday', cuisine: 'Mexican', description: 'Tacos and burritos, because every day deserves a Tuesday.' },
  { id: 6, name: 'Green Bowl', cuisine: 'Salads', description: 'Fresh bowls and crunchy salads that keep you going.' },
  { id: 7, name: 'Chai & Chill', cuisine: 'Cafe', description: 'Hot chai, cold coffee and snacks for long study sessions.' },
  { id: 8, name: 'Wrap Star', cuisine: 'Wraps', description: 'Rolled, wrapped and ready to eat on the move.' },
].map((restaurant) => ({
  ...restaurant,
  owner_id: restaurant.id + 5,
  is_open: true,
  created_at: CREATED_AT,
}))
