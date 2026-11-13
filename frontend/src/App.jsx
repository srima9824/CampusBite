import { Route, Routes } from 'react-router-dom'
import AppShell from './layouts/AppShell.jsx'
import Home from './pages/Home.jsx'
import Styleguide from './pages/Styleguide.jsx'
import Login from './pages/Login.jsx'
import OwnerHome from './pages/OwnerHome.jsx'
import DeliveryHome from './pages/DeliveryHome.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import Orders from './pages/Orders.jsx'
import Checkout from './pages/Checkout.jsx'
import Cart from './pages/Cart.jsx'
import OrderConfirmation from './pages/OrderConfirmation.jsx'
import Register from './pages/Register.jsx'
import RestaurantMenu from './pages/RestaurantMenu.jsx'
import Restaurants from './pages/Restaurants.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="restaurants" element={<Restaurants />} />
        <Route path="restaurants/:restaurantId" element={<RestaurantMenu />} />
        <Route path="cart" element={<Cart />} />
        <Route path="styleguide" element={<Styleguide />} />
        <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
          <Route path="checkout" element={<Checkout />} />
          <Route path="orders" element={<Orders />} />
          <Route path="order-confirmation/:orderId" element={<OrderConfirmation />} />
        </Route>
        <Route element={<ProtectedRoute roles={['OWNER']} />}>
          <Route path="owner" element={<OwnerHome />} />
        </Route>
        <Route element={<ProtectedRoute roles={['DELIVERY_PARTNER']} />}>
          <Route path="delivery" element={<DeliveryHome />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
