import styles from './Skeleton.module.css'

export default function Skeleton({ width, height, variant = 'line' }) {
  return (
    <span
      className={`${styles.skeleton} ${styles[variant]}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}
