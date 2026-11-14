import { useId } from 'react'
import styles from './PriceSlider.module.css'

export default function PriceSlider({ label, value, max, onChange }) {
  const id = useId()
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label} ₹{value}
      </label>
      <input
        id={id}
        className={styles.slider}
        type="range"
        min={0}
        max={max}
        step={10}
        value={value}
        disabled={max === 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}
