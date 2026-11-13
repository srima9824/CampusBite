import styles from './AvailabilitySwitch.module.css'

export default function AvailabilitySwitch({ itemName, checked, onChange }) {
  return (
    <label className={styles.switch}>
      <input type="checkbox" className={styles.input} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className={styles.track} aria-hidden="true" />
      <span>
        Available<span className="visually-hidden"> for {itemName}</span>
      </span>
    </label>
  )
}
