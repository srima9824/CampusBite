import { useEffect, useId, useRef } from 'react'
import styles from './Modal.module.css'

// Mount it to open it, unmount it to close it. The native dialog traps focus and
// inerts the page behind it; focus is handed back to the opener on unmount.
export default function Modal({ title, onClose, children, actions }) {
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    if (!dialog.open) dialog.showModal()
    return () => {
      dialog.close()
      opener?.focus?.()
    }
  }, [])

  function handleCancel(event) {
    event.preventDefault()
    onClose()
  }

  function handleBackdropClick(event) {
    if (event.target === dialogRef.current) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className={styles.panel}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </dialog>
  )
}
