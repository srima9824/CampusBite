import Button from './Button.jsx'
import styles from './Pagination.module.css'

export default function Pagination({ page, pageSize, total, onChange }) {
  const pageCount = Math.ceil(total / pageSize)
  if (pageCount <= 1) return null

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <span className={styles.status} aria-current="page">
        Page {page} of {pageCount}
      </span>
      <Button variant="secondary" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </nav>
  )
}
