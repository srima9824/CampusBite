import { useState } from 'react'
import { orders } from '../api'
import { Button, Select } from './ui'
import styles from './OrderForms.module.css'

const RATING_OPTIONS = [
  { value: '', label: 'Choose a rating' },
  ...[5, 4, 3, 2, 1].map((stars) => ({ value: String(stars), label: `${stars} ${stars === 1 ? 'star' : 'stars'}` })),
]

// Reviews cannot be edited, so on success the parent reloads and shows the saved review.
export default function ReviewForm({ orderId, onDone }) {
  const [rating, setRating] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!rating) {
      setError('Choose a rating from 1 to 5 stars.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await orders.submitReview(orderId, { rating: Number(rating), comment })
      onDone()
    } catch (failure) {
      setError(failure.message)
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-label="Review this order">
      <Select label="Rating" options={RATING_OPTIONS} value={rating} onChange={(event) => setRating(event.target.value)} />
      <div className={styles.field}>
        <label htmlFor="review-comment">Comment (optional)</label>
        <textarea
          id="review-comment"
          className={styles.textarea}
          rows={3}
          maxLength={500}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" loading={loading}>
        Submit review
      </Button>
    </form>
  )
}
