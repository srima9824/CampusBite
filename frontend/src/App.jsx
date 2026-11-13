import { Route, Routes } from 'react-router-dom'
import AppShell from './layouts/AppShell.jsx'
import Home from './pages/Home.jsx'
import Styleguide from './pages/Styleguide.jsx'
import Login from './pages/Login.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="styleguide" element={<Styleguide />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
