import { useState } from 'react'
import { Link } from 'react-router-dom'
import { owner } from '../api'
import AvailabilitySwitch from '../components/AvailabilitySwitch.jsx'
import { Badge, Button, EmptyState, Skeleton, Table, useToast } from '../components/ui'
import { useOwnerMenu } from '../hooks/useOwnerData.js'
import { formatMoney } from '../lib/formatMoney.js'
import styles from './OwnerMenu.module.css'

const SKELETON_ROWS = 4

function LoadingRows() {
  return (
    <div className={styles.loading} role="status" aria-label="Loading your menu">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton key={index} variant="block" />
      ))}
    </div>
  )
}

export default function OwnerMenu() {
  const toast = useToast()
  const { data, status, error, reload } = useOwnerMenu()
  // Availability the owner just chose, shown before the api answers and kept once it agrees.
  const [chosen, setChosen] = useState({})

  async function toggle(item, isAvailable) {
    setChosen((current) => ({ ...current, [item.id]: isAvailable }))
    try {
      await owner.setMenuItemAvailability(item.id, { is_available: isAvailable })
    } catch (failure) {
      setChosen((current) => ({ ...current, [item.id]: !isAvailable }))
      toast.error(failure.message ?? `We could not update ${item.name}. Please try again.`)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Dish',
      render: (item) => {
        const available = chosen[item.id] ?? item.is_available
        return (
          <span className={styles.name}>
            {item.name}
            {!available && <Badge tone="warning">Sold out</Badge>}
          </span>
        )
      },
    },
    { key: 'category', header: 'Category', render: (item) => item.category },
    { key: 'price', header: 'Price', render: (item) => formatMoney(item.price) },
    {
      key: 'available',
      header: 'Availability',
      render: (item) => (
        <AvailabilitySwitch
          itemName={item.name}
          checked={chosen[item.id] ?? item.is_available}
          onChange={(isAvailable) => toggle(item, isAvailable)}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <Link className={styles.editLink} to={`/owner/menu/${item.id}/edit`}>
          Edit<span className="visually-hidden"> {item.name}</span>
        </Link>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Your menu</h1>
        <p className={styles.lead}>Add dishes, fix prices and flag what has sold out. Customers see changes right away.</p>
        <Link className={styles.addLink} to="/owner/menu/new">
          Add item
        </Link>
      </header>

      {status === 'loading' && <LoadingRows />}

      {status === 'error' && (
        <div className={styles.error} role="alert">
          <p>{error?.message ?? 'Your menu did not load.'} Give it another go.</p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}

      {status === 'success' && data.items.length === 0 && (
        <EmptyState
          title="Your menu is a blank plate"
          description="Add your first dish and hungry students can start ordering."
          action={
            <Link className={styles.addLink} to="/owner/menu/new">
              Add item
            </Link>
          }
        />
      )}

      {status === 'success' && data.items.length > 0 && (
        <Table caption="Your menu" hideCaption columns={columns} rows={data.items} getRowKey={(item) => item.id} />
      )}
    </div>
  )
}
