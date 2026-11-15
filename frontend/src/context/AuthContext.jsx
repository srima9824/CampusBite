import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { auth } from '../api'
import { SESSION_EXPIRED_EVENT } from '../api/http.js'
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

  useEffect(() => {
    const handleExpired = () => {
      setUser(null)
      setStatus('anonymous')
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired)
  }, [])

  const startSession = useCallback(({ access_token: token, user: signedIn }) => {
    saveSession({ token, user: signedIn })
    setUser(signedIn)
    setStatus('authenticated')
    return signedIn
  }, [])

  const login = useCallback(
    async (credentials) => startSession(await auth.login(credentials)),
    [startSession],
  )

  const register = useCallback(
    async ({ name, email, password }) => startSession(await auth.register({ name, email, password })),
    [startSession],
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
