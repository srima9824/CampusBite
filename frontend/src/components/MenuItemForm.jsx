import { useEffect, useId, useRef, useState } from 'react'
import { validateMenuItem, DESCRIPTION_MAX } from '../lib/menuItemForm.js'
import { Button, Input } from './ui'
import styles from './MenuItemForm.module.css'

const EMPTY_VALUES = { name: '', description: '', category: '', price: '', is_available: true, is_veg: true }

// `onSubmit(payload)` rejects with an ApiError; `fields` of a 422 or 409 land under the matching inputs.
export default function MenuItemForm({ initialValues = EMPTY_VALUES, categories = [], submitLabel, onSubmit, onCancel }) {
  const [values, setValues] = useState({ ...EMPTY_VALUES, ...initialValues, price: String(initialValues.price ?? '') })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const formRef = useRef(null)
  const listId = useId()
  const descriptionId = useId()
  const descriptionErrorId = `${descriptionId}-error`

  useEffect(() => {
    formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [errors])

  function update(field) {
    return (event) => setValues((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    const found = validateMenuItem(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    try {
      await onSubmit({ ...values, price: Number(values.price) })
    } catch (error) {
      if (error.fields) setErrors(error.fields)
      else setFormError(error.message ?? 'We could not save the dish. Please try again.')
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
      <Input label="Name" value={values.name} onChange={update('name')} error={errors.name} autoComplete="off" />
      <div className={styles.field}>
        <label className={styles.label} htmlFor={descriptionId}>
          Description
        </label>
        <textarea
          id={descriptionId}
          className={`${styles.textarea} ${errors.description ? styles.invalid : ''}`}
          rows={3}
          value={values.description}
          onChange={update('description')}
          aria-describedby={errors.description ? descriptionErrorId : undefined}
          aria-invalid={errors.description ? true : undefined}
        />
        <p className={styles.hint}>Optional, up to {DESCRIPTION_MAX} characters.</p>
        {errors.description && (
          <p id={descriptionErrorId} className={styles.error}>
            {errors.description}
          </p>
        )}
      </div>
      <Input
        label="Category"
        value={values.category}
        onChange={update('category')}
        error={errors.category}
        list={listId}
        autoComplete="off"
      />
      <datalist id={listId}>
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <Input
        label="Price (Rs.)"
        inputMode="decimal"
        value={values.price}
        onChange={update('price')}
        error={errors.price}
        autoComplete="off"
      />
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={values.is_available}
          onChange={(event) => setValues((current) => ({ ...current, is_available: event.target.checked }))}
        />
        Available for ordering
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={values.is_veg}
          onChange={(event) => setValues((current) => ({ ...current, is_veg: event.target.checked }))}
        />
        Vegetarian
      </label>
      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
