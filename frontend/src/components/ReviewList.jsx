import { useState } from 'react'
import { reviews } from '../api'
import useAsync from '../hooks/useAsync.js'
import { formatDateTime } from '../lib/formatDate.js'
import { Button, Pagination, Select, Skeleton } from './ui'
import styles from './ReviewList.module.css'

const PAGE_SIZE = 5
const RATING_OPTIONS = [
  { value: '', label: 'All ratings' },
  ...[5, 4, 3, 2, 1].map((stars) => ({ value: String(stars), label: `${stars} ${stars === 1 ? 'star' : 'stars'}` })),
]

function Stars({ rating }) {
  return (
    <span aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  )
}

// `kind` is 'restaurant' or 'dish'; `id` is that restaurant's or dish's id. Newest first from the api.
export default function ReviewList({ kind, id }) {
  const [rating, setRating] = useState('')
  const [page, setPage] = useState(1)
  const load = kind === 'dish' ? reviews.listDishReviews : reviews.listRestaurantReviews
  const { data, status, error, reload } = useAsync(
    () => load(id, { rating, page, page_size: PAGE_SIZE }),
    [kind, id, rating, page],
  )

  function changeRating(event) {
    setRating(event.target.value)
    setPage(1)
  }

  return (
    <div className={styles.list}>
      <Select label="Show" options={RATING_OPTIONS} value={rating} onChange={changeRating} />

      {status === 'loading' && (
        <div role="status" aria-label="Loading reviews">
          <Skeleton variant="block" />
        </div>
      )}

      {status === 'error' && (
        <div className={styles.error} role="alert">
          <p>{error?.message ?? 'The reviews did not load.'}</p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}

      {status === 'success' && data.items.length === 0 && (
        <p className={styles.empty}>{rating ? 'No reviews with that rating yet.' : 'No reviews yet.'}</p>
      )}

      {status === 'success' && data.items.length > 0 && (
        <>
          <ul className={styles.items}>
            {data.items.map((review, index) => (
              <li key={`${review.created_at}-${index}`} className={styles.review}>
                <p className={styles.head}>
                  <Stars rating={review.rating} /> <strong>{review.reviewer}</strong>
                  <time className={styles.time} dateTime={review.created_at}>
                    {formatDateTime(review.created_at)}
                  </time>
                </p>
                {review.comment && <p>{review.comment}</p>}
                {kind === 'restaurant' && review.dishes.length > 0 && (
                  <p className={styles.dishes}>Ordered: {review.dishes.join(', ')}</p>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
        </>
      )}
    </div>
  )
}
