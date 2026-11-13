import styles from './Button.module.css'

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  children,
  ...rest
}) {
  const className = [styles.button, styles[variant], styles[size]].join(' ')
  return (
    <button
      {...rest}
      type={type}
      className={className}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  )
}
