import dosaDashLogo from '../../assets/logos/dosa-dash.svg'
import southIndianPhoto from '../../assets/photos/south-indian.jpg'
import noodleNookLogo from '../../assets/logos/noodle-nook.svg'
import asianPhoto from '../../assets/photos/asian.jpg'
import burgerBarnLogo from '../../assets/logos/burger-barn.svg'
import americanPhoto from '../../assets/photos/american.jpg'
import pizzaProntoLogo from '../../assets/logos/pizza-pronto.svg'
import italianPhoto from '../../assets/photos/italian.jpg'
import tacoTuesdayLogo from '../../assets/logos/taco-tuesday.svg'
import mexicanPhoto from '../../assets/photos/mexican.jpg'
import greenBowlLogo from '../../assets/logos/green-bowl.svg'
import saladsPhoto from '../../assets/photos/salads.jpg'
import chaiAndChillLogo from '../../assets/logos/chai-and-chill.svg'
import cafePhoto from '../../assets/photos/cafe.jpg'
import wrapStarLogo from '../../assets/logos/wrap-star.svg'
import wrapsPhoto from '../../assets/photos/wraps.jpg'

const CREATED_AT = '2026-01-05T08:00:00Z'

export const restaurants = [
  { id: 1, logo_url: dosaDashLogo, image_url: southIndianPhoto, name: 'Dosa Dash', cuisine: 'South Indian', description: 'Crisp dosas and fluffy idlis, served before your lecture ends.' },
  { id: 2, logo_url: noodleNookLogo, image_url: asianPhoto, name: 'Noodle Nook', cuisine: 'Asian', description: 'Slurp-worthy noodles and stir-fries in a cosy corner.' },
  { id: 3, logo_url: burgerBarnLogo, image_url: americanPhoto, name: 'Burger Barn', cuisine: 'American', description: 'Stacked burgers and golden fries for serious appetites.' },
  { id: 4, logo_url: pizzaProntoLogo, image_url: italianPhoto, name: 'Pizza Pronto', cuisine: 'Italian', description: 'Wood-fired slices that arrive faster than your group chat.' },
  { id: 5, logo_url: tacoTuesdayLogo, image_url: mexicanPhoto, name: 'Taco Tuesday', cuisine: 'Mexican', description: 'Tacos and burritos, because every day deserves a Tuesday.' },
  { id: 6, logo_url: greenBowlLogo, image_url: saladsPhoto, name: 'Green Bowl', cuisine: 'Salads', description: 'Fresh bowls and crunchy salads that keep you going.' },
  { id: 7, logo_url: chaiAndChillLogo, image_url: cafePhoto, name: 'Chai & Chill', cuisine: 'Cafe', description: 'Hot chai, cold coffee and snacks for long study sessions.' },
  { id: 8, logo_url: wrapStarLogo, image_url: wrapsPhoto, name: 'Wrap Star', cuisine: 'Wraps', description: 'Rolled, wrapped and ready to eat on the move.' },
].map((restaurant) => ({
  ...restaurant,
  owner_id: restaurant.id + 5,
  is_open: true,
  created_at: CREATED_AT,
}))
