import dosaDashLogo from '../../assets/logos/dosa-dash.svg'
import southIndianPhoto from '../../assets/photos/south-indian.jpg'
import burgerBarnLogo from '../../assets/logos/burger-barn.svg'
import americanPhoto from '../../assets/photos/american.jpg'
import tacoTuesdayLogo from '../../assets/logos/taco-tuesday.svg'
import mexicanPhoto from '../../assets/photos/mexican.jpg'
import chaiAndChillLogo from '../../assets/logos/chai-and-chill.svg'
import cafePhoto from '../../assets/photos/cafe.jpg'

const CREATED_AT = '2026-01-05T08:00:00Z'

export const restaurants = [
  { id: 1, logo_url: dosaDashLogo, image_url: southIndianPhoto, name: 'Dosa Dash', cuisine: 'South Indian', description: 'Crisp dosas and fluffy idlis, served before your lecture ends.' },
  { id: 3, logo_url: burgerBarnLogo, image_url: americanPhoto, name: 'Burger Barn', cuisine: 'American', description: 'Stacked burgers and golden fries for serious appetites.' },
  { id: 5, logo_url: tacoTuesdayLogo, image_url: mexicanPhoto, name: 'Taco Tuesday', cuisine: 'Mexican', description: 'Tacos and burritos, because every day deserves a Tuesday.' },
  { id: 7, logo_url: chaiAndChillLogo, image_url: cafePhoto, name: 'Chai & Chill', cuisine: 'Cafe', description: 'Hot chai, cold coffee and snacks for long study sessions.' },
].map((restaurant) => ({
  ...restaurant,
  owner_id: restaurant.id + 5,
  is_open: true,
  created_at: CREATED_AT,
}))
