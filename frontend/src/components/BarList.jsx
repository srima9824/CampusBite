import styles from './BarList.module.css'

// Every number is visible text; the bar is decoration, scaled so the largest value fills the track.
export default function BarList({ label, rows }) {
  const largest = Math.max(0, ...rows.map((row) => row.value))
  return (
    <ul className={styles.list} aria-label={label}>
      {rows.map((row) => (
        <li key={row.key} className={styles.row}>
          <span className={styles.name}>{row.label}</span>
          <span className={styles.value}>{row.value}</span>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.bar} style={{ width: `${largest ? (row.value / largest) * 100 : 0}%` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}
