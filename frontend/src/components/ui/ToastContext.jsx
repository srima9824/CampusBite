import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import Toast from './Toast.jsx'
import styles from './Toast.module.css'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback(
    (id) => setToasts((current) => current.filter((toast) => toast.id !== id)),
    [],
  )

  const show = useCallback((tone, message) => {
    nextId.current += 1
    setToasts((current) => [...current, { id: nextId.current, tone, message }])
  }, [])

  const api = useMemo(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} aria-live="polite">
        {toasts.map(({ id, tone, message }) => (
          <Toast key={id} id={id} tone={tone} message={message} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside ToastProvider')
  return value
}
