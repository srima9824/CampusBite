import styles from './DietChips.module.css'

const OPTIONS = [
  { value: '', label: 'All' },
  { value: 'veg', label: 'Veg' },
  { value: 'non_veg', label: 'Non-veg' },
]

export default function DietChips({ value, onChange }) {
  return (
    <div className={styles.group} role="radiogroup" aria-label="Diet">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`${styles.chip} ${value === option.value ? styles.selected : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
