import { useEffect, useState } from 'react'
import Button from './Button.jsx'
import styles from './Toast.module.css'

const AUTO_DISMISS_MS = 4000

export default function Toast({ id, tone, message, onDismiss }) {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return undefined
    const timer = setTimeout(() => onDismiss(id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [paused, id, onDismiss])

  return (
    <div
      className={`${styles.toast} ${styles[tone]}`}
      role={tone === 'error' ? 'alert' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p className={styles.message}>{message}</p>
      <Button variant="ghost" onClick={() => onDismiss(id)}>
        Dismiss
      </Button>
    </div>
  )
}
