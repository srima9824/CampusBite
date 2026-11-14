const SESSION_KEY = 'campusbite.session'

export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY))
    return session?.token ? session : null
  } catch {
    return null
  }
}

export function saveSession({ token, user }) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
