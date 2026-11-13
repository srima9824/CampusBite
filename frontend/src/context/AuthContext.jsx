import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { auth } from '../api'
import { clearSession, getSession, saveSession } from '../api/session.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => (getSession() ? 'loading' : 'anonymous'))

  useEffect(() => {
    if (!getSession()) return undefined
    let cancelled = false
    auth
      .getCurrentUser()
      .then((current) => {
        if (cancelled) return
        setUser(current)
        setStatus('authenticated')
      })
      .catch(() => {
        if (cancelled) return
        clearSession()
        setStatus('anonymous')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const { access_token: token, user: signedIn } = await auth.login(credentials)
    saveSession({ token, user: signedIn })
    setUser(signedIn)
    setStatus('authenticated')
    return signedIn
  }, [])

  const register = useCallback(
    async ({ name, email, password }) => {
      await auth.register({ name, email, password })
      return login({ email, password })
    },
    [login],
  )

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo(() => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],)
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
