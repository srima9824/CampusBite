import { Route, Routes } from 'react-router-dom'
import AppShell from './layouts/AppShell.jsx'
import Home from './pages/Home.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
