import { useEffect, useId, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import FilterActions, { FILTER_HINT } from '../components/FilterActions.jsx'
import RestaurantCard from '../components/RestaurantCard.jsx'
import { Button, EmptyState, Input, Pagination, Skeleton } from '../components/ui'
import useRestaurants from '../hooks/useRestaurants.js'
import styles from './Restaurants.module.css'

const PAGE_SIZE = 6
const SEARCH_DEBOUNCE_MS = 250
const SKELETON_COUNT = 6

function LoadingGrid() {
  return (
    <div className={styles.grid} role="status" aria-label="Loading kitchens">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div key={index} className={styles.skeletonCard}>
          <Skeleton variant="block" />
          <Skeleton width="60%" />
          <Skeleton />
        </div>
      ))}
    </div>
  )
}

export default function Restaurants() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [text, setText] = useState(q)
  const hintId = useId()
  const { data, status, error, reload } = useRestaurants({ q, page })

  const [syncedQ, setSyncedQ] = useState(q)
  // Back/forward changes the URL; mirror it into the box without an effect.
  if (syncedQ !== q) {
    setSyncedQ(q)
    setText(q)
  }

  useEffect(() => {
    const wanted = text.trim()
    if (wanted === q) return undefined
    const timer = setTimeout(() => {
      setParams(wanted ? { q: wanted } : {})
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, q, setParams])

  function goToPage(next) {
    setParams({ ...(q && { q }), page: String(next) })
  }

  function applySearch(event) {
    event.preventDefault()
    const wanted = text.trim()
    setParams(wanted ? { q: wanted } : {})
  }

  function clearSearch() {
    setText('')
    setParams({})
  }

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Pick your kitchen</h1>
        <p className={styles.lead}>Eight campus favourites, all one tap from your table.</p>
      </header>

      <form
        className={styles.filters}
        role="search"
        aria-label="Search kitchens"
        aria-describedby={hintId}
        onSubmit={applySearch}
      >
        <p id={hintId} className={styles.hint}>
          {FILTER_HINT}
        </p>
        <Input
          label="Search kitchens"
          type="search"
          placeholder="Try dosa, pizza or Mexican"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <FilterActions onClear={clearSearch} />
      </form>

      {status === 'loading' && <LoadingGrid />}

      {status === 'error' && (
        <div className={styles.error} role="alert">
          <p>{error?.message ?? 'The kitchens did not answer.'} Give it another go.</p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}

      {status === 'success' && data.items.length === 0 && (
        <EmptyState
          title="No kitchens match that"
          description="Try a different dish or cuisine, or clear the search to see everyone."
          action={<Button onClick={clearSearch}>Clear search</Button>}
        />
      )}

      {status === 'success' && data.items.length > 0 && (
        <>
          <ul className={styles.grid}>
            {data.items.map((restaurant) => (
              <li key={restaurant.id}>
                <RestaurantCard restaurant={restaurant} />
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={goToPage} />
        </>
      )}
    </div>
  )
}
