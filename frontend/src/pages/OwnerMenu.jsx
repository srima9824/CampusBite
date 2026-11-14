import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { owner } from '../api'
import AvailabilitySwitch from '../components/AvailabilitySwitch.jsx'
import { Badge, Button, ConfirmDialog, EmptyState, Skeleton, Table, useToast } from '../components/ui'
import useMenu from '../hooks/useMenu.js'
import { useAuth } from '../context/AuthContext.jsx'
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
  const { user } = useAuth()
  const toast = useToast()
  const { data, status, error, reload } = useMenu(user.restaurant_id, {})
  // Availability the owner just chose, shown before the api answers and kept once it agrees.
  const [chosen, setChosen] = useState({})
  const [removing, setRemoving] = useState(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const titleRef = useRef(null)

  async function toggle(item, isAvailable) {
    setChosen((current) => ({ ...current, [item.id]: isAvailable }))
    try {
      await owner.setMenuItemAvailability(item.id, { is_available: isAvailable })
    } catch (failure) {
      setChosen((current) => ({ ...current, [item.id]: !isAvailable }))
      toast.error(failure.message ?? `We could not update ${item.name}. Please try again.`)
    }
  }

  async function confirmRemove() {
    setRemoveBusy(true)
    try {
      await owner.deleteMenuItem(removing.id)
      toast.success(`${removing.name} removed from the menu`)
    } catch (failure) {
      toast.error(failure.message ?? 'We could not remove that dish. Please try again.')
    }
    setRemoveBusy(false)
    setRemoving(null)
    setChosen({})
    reload()
    titleRef.current?.focus()
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
        <span className={styles.actions}>
          <Link className={styles.editLink} to={`/owner/menu/${item.id}/edit`}>
            Edit<span className="visually-hidden"> {item.name}</span>
          </Link>
          <Button variant="secondary" onClick={() => setRemoving(item)} aria-label={`Delete ${item.name}`}>
            Delete
          </Button>
        </span>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>
          {data ? `${data.restaurant.name} menu` : 'Your menu'}
        </h1>
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

      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name} from the menu?`}
          message="Customers will no longer see it. Orders already placed keep their copy of the dish."
          confirmLabel="Remove dish"
          cancelLabel="Keep dish"
          tone="danger"
          loading={removeBusy}
          onConfirm={confirmRemove}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  )
}
