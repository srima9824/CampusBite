import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext.jsx'
import { roleHome } from './roleHome.js'

export default function ProtectedRoute({ roles }) {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div role="status" aria-label="Checking your table reservation">
        <Skeleton width="60%" height="2rem" />
      </div>
    )
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <Navigate
        to={roleHome(user.role)}
        replace
        state={{ notice: 'That table is reserved for someone else, so we brought you back home.' }}
      />
    )
  }
  return <Outlet />
}
