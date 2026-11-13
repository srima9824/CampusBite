import styles from './StatCard.module.css'

// Render inside a `<dl>`; each card is one term and value pair.
export default function StatCard({ label, value, hint }) {
  return (
    <div className={styles.card}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
      {hint && <dd className={styles.hint}>{hint}</dd>}
    </div>
  )
}
