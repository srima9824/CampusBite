import { ORDER_STATUSES, STATUS_LABELS } from '../api/orderStatus.js'
import { Button, Input, Select } from './ui'
import styles from './OrderFilters.module.css'

const ALL_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
]

// `hideStatus` drops the status select; `statusOptions` replaces its list.
export default function OrderFilters({
  values,
  onChange,
  onClear,
  rangeError,
  hideStatus = false,
  statusOptions = ALL_STATUS_OPTIONS,
}) {
  function update(field) {
    return (event) => onChange({ ...values, [field]: event.target.value })
  }

  return (
    <form className={`${styles.filters} ${hideStatus ? styles.withoutStatus : ''}`} aria-label="Filter orders" onSubmit={(event) => event.preventDefault()}>
      {!hideStatus && (
        <Select label="Status" options={statusOptions} value={values.status} onChange={update('status')} />
      )}
      <Input label="From" type="date" value={values.date_from} max={values.date_to || undefined} onChange={update('date_from')} />
      <Input
        label="To"
        type="date"
        value={values.date_to}
        min={values.date_from || undefined}
        error={rangeError}
        onChange={update('date_to')}
      />
      <Button variant="secondary" onClick={onClear}>
        Clear filters
      </Button>
    </form>
  )
}
