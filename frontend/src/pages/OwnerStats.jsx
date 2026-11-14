import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ORDER_STATUSES, STATUS_LABELS } from '../api/orderStatus.js'
import BarList from '../components/BarList.jsx'
import StatCard from '../components/StatCard.jsx'
import { Button, EmptyState, Skeleton } from '../components/ui'
import useOwnRestaurant from '../hooks/useOwnRestaurant.js'
import useRestaurantStats from '../hooks/useRestaurantStats.js'
import { formatMoney } from '../lib/formatMoney.js'
import styles from './OwnerStats.module.css'

function LoadingStats() {
  return (
    <div className={styles.loading} role="status" aria-label="Loading your numbers">
      <Skeleton variant="block" />
      <Skeleton variant="block" />
      <Skeleton variant="block" />
    </div>
  )
}

export default function OwnerStats() {
  const { data, status, error, reload } = useRestaurantStats()
  const { data: restaurant } = useOwnRestaurant()
  const [refreshed, setRefreshed] = useState(false)

  function refresh() {
    setRefreshed(true)
    reload()
  }

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>{restaurant ? `${restaurant.name} stats` : 'Your stats'}</h1>
        <p className={styles.lead}>How the kitchen is doing, counted fresh from your orders.</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={refresh} loading={status === 'loading'}>
            Refresh
          </Button>
          <p className={styles.updated} role="status">
            {refreshed && status === 'success' ? 'Updated' : ''}
          </p>
        </div>
      </header>

      {status === 'loading' && <LoadingStats />}

      {status === 'error' && (
        <div className={styles.error} role="alert">
          <p>{error?.message ?? 'Your stats did not load.'} Give it another go.</p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}

      {status === 'success' && data.total_orders === 0 && (
        <EmptyState
          title="Nothing to count yet"
          description="Once customers start ordering, your numbers will show up here."
          action={
            <Link className={styles.link} to="/owner">
              Go to orders
            </Link>
          }
        />
      )}

      {status === 'success' && data.total_orders > 0 && (
        <>
          <dl className={styles.cards}>
            <StatCard label="Total orders" value={data.total_orders} />
            <StatCard label="Revenue" value={formatMoney(data.revenue)} hint="Cancelled orders not counted" />
            <StatCard label="Orders today" value={data.orders_today} />
            <StatCard label="Waiting for you" value={data.by_status.PLACED} hint="Placed, not yet accepted" />
          </dl>

          <div className={styles.lists}>
            <section className={styles.panel} aria-labelledby="by-status">
              <h2 id="by-status" className={styles.heading}>
                Orders by status
              </h2>
              <BarList
                label="Orders by status"
                rows={ORDER_STATUSES.map((key) => ({ key, label: STATUS_LABELS[key], value: data.by_status[key] }))}
              />
            </section>
            <section className={styles.panel} aria-labelledby="top-sellers">
              <h2 id="top-sellers" className={styles.heading}>
                Top sellers
              </h2>
              {data.top_items.length > 0 ? (
                <BarList
                  label="Top sellers by quantity"
                  rows={data.top_items.map((item) => ({ key: item.menu_item_id, label: item.name, value: item.quantity }))}
                />
              ) : (
                <p>No dishes sold yet.</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
