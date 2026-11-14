import { Button } from './ui'
import styles from './FilterActions.module.css'

export const FILTER_HINT = 'Filters apply as you type, or press Apply.'

export default function FilterActions({ onClear }) {
  return (
    <div className={styles.actions}>
      <Button type="submit">Apply</Button>
      <Button variant="secondary" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  )
}
