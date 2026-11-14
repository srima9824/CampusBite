import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import AddToCartButton from '../components/AddToCartButton.jsx'
import DietChips from '../components/DietChips.jsx'
import MenuItemCard from '../components/MenuItemCard.jsx'
import PriceSlider from '../components/PriceSlider.jsx'
import RestaurantLogo from '../components/RestaurantLogo.jsx'
import { Badge, Button, EmptyState, Input, Skeleton } from '../components/ui'
import useMenu from '../hooks/useMenu.js'
import styles from './RestaurantMenu.module.css'

const FILTER_DEBOUNCE_MS = 250
const EMPTY_FILTERS = { q: '', min_price: '', max_price: '', veg: '' }

function readFilters(params) {
  return {
    q: params.get('q') ?? '',
    min_price: params.get('min_price') ?? '',
    max_price: params.get('max_price') ?? '',
    veg: params.get('veg') ?? '',
  }
}

function toParams(filters) {
  return Object.fromEntries(
    Object.entries(filters)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value),
  )
}

function sameFilters(a, b) {
  return Object.keys(EMPTY_FILTERS).every((key) => a[key].trim() === b[key])
}

function groupByCategory(items) {
  const groups = new Map()
  items.forEach((item) => {
    groups.set(item.category, [...(groups.get(item.category) ?? []), item])
  })
  return [...groups]
}

function hasInvalidRange({ min_price: min, max_price: max }) {
  return min !== '' && max !== '' && Number(min) > Number(max)
}

function MenuLoading() {
  return (
    <div className={styles.loading} role="status" aria-label="Loading the menu">
      <Skeleton variant="block" />
      <Skeleton variant="block" />
      <Skeleton variant="block" />
    </div>
  )
}

function RestaurantHeader({ restaurant }) {
  return (
    <header className={styles.header}>
      <RestaurantLogo restaurant={restaurant} size="md" />
      <div className={styles.headerText}>
        <h1 className={styles.title}>{restaurant.name}</h1>
        <Badge tone="info">{restaurant.cuisine}</Badge>
        <p className={styles.description}>{restaurant.description}</p>
      </div>
    </header>
  )
}

export default function RestaurantMenu() {
  const { restaurantId } = useParams()
  const [params, setParams] = useSearchParams()
  const applied = readFilters(params)
  const [filters, setFilters] = useState(applied)
  const rangeInvalid = hasInvalidRange(applied)
  // An inverted range is never sent to the api; the inline error explains it instead.
  const query = rangeInvalid ? { ...applied, min_price: '', max_price: '', veg: '' } : applied
  const { data, status, error, reload, priceCeiling } = useMenu(restaurantId, {
    q: query.q,
    min_price: query.min_price,
    max_price: query.max_price,
    veg: query.veg,
  })

  const { q, min_price: minPrice, max_price: maxPrice, veg } = applied
  const urlKey = [q, minPrice, maxPrice, veg].join('|')
  const [syncedKey, setSyncedKey] = useState(urlKey)
  // Back/forward changes the URL; mirror it into the inputs without an effect.
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey)
    setFilters(applied)
  }

  useEffect(() => {
    if (sameFilters(filters, applied)) return undefined
    const timer = setTimeout(() => setParams(toParams(filters)), FILTER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // `applied` is rebuilt every render; its four values are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, q, minPrice, maxPrice, veg, setParams])

  function updateFilter(key) {
    return (event) => setFilters((previous) => ({ ...previous, [key]: event.target.value }))
  }

  const minValue = filters.min_price === '' ? 0 : Number(filters.min_price)
  const maxValue = filters.max_price === '' ? priceCeiling : Math.min(Number(filters.max_price), priceCeiling)

  // A handle at its end stops filtering, so the default range sends no price.
  function moveMin(value) {
    const next = Math.min(value, maxValue)
    setFilters((previous) => ({ ...previous, min_price: next === 0 ? '' : String(next) }))
  }

  function moveMax(value) {
    const next = Math.max(value, minValue)
    setFilters((previous) => ({ ...previous, max_price: next >= priceCeiling ? '' : String(next) }))
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setParams({})
  }

  const clearButton = <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>

  if (status === 'error' && error?.status === 404) {
    return (
      <EmptyState
        headingLevel={1}
        title="We could not find that kitchen"
        description="It may have closed for the day, or the link took a wrong turn."
        action={<Link to="/restaurants">Back to all kitchens</Link>}
      />
    )
  }

  return (
    <div className={styles.page}>
      <Link className={styles.back} to="/restaurants">
        Back to all kitchens
      </Link>

      {status === 'success' && <RestaurantHeader restaurant={data.restaurant} />}
      {status === 'loading' && <h1 className={styles.title}>Setting the table</h1>}

      <form className={styles.filters} role="search" aria-label="Filter the menu" onSubmit={(event) => event.preventDefault()}>
        <Input label="Search the menu" type="search" value={filters.q} onChange={updateFilter('q')} placeholder="Try dosa or drinks" />
        <PriceSlider label="Min price" value={minValue} max={priceCeiling} onChange={moveMin} />
        <PriceSlider label="Max price" value={maxValue} max={priceCeiling} onChange={moveMax} />
        <DietChips value={filters.veg} onChange={(value) => setFilters((previous) => ({ ...previous, veg: value }))} />
        <Button variant="secondary" onClick={clearFilters}>
          Clear filters
        </Button>
      </form>

      {rangeInvalid && (
        <p className={styles.rangeError} role="alert">
          The minimum price is higher than the maximum. Swap them to see matching dishes.
        </p>
      )}

      {status === 'loading' && <MenuLoading />}

      {status === 'error' && (
        <div className={styles.error} role="alert">
          <p>{error?.message ?? 'The menu did not load.'} Give it another go.</p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}

      {status === 'success' && data.items.length === 0 && (
        <EmptyState
          title="Nothing on the menu matches"
          description="Loosen the search or the price range and the dishes will come back."
          action={clearButton}
        />
      )}

      {status === 'success' &&
        groupByCategory(data.items).map(([category, items]) => (
          <section key={category} className={styles.category}>
            <h2 className={styles.categoryTitle}>{category}</h2>
            <ul className={styles.items}>
              {items.map((item) => (
                <li key={item.id}>
                  <MenuItemCard
                    item={item}
                    action={
                      item.is_available && (
                        <AddToCartButton item={item} restaurant={data.restaurant} />
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}
