import { Link, useNavigate, useParams } from 'react-router-dom'
import { owner } from '../api'
import MenuItemForm from '../components/MenuItemForm.jsx'
import { Button, EmptyState, Skeleton, useToast } from '../components/ui'
import { useAuth } from '../context/AuthContext.jsx'
import useMenu from '../hooks/useMenu.js'
import styles from './OwnerMenuItemEdit.module.css'

// One page for /owner/menu/new and /owner/menu/:itemId/edit.
export default function OwnerMenuItemEdit() {
  const { itemId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, status, error, reload } = useMenu(user.restaurant_id, {})
  const isEdit = itemId !== undefined
  const item = isEdit ? data?.items.find((candidate) => String(candidate.id) === itemId) : null

  async function save(values) {
    if (isEdit) await owner.updateMenuItem(item.id, values)
    else await owner.createMenuItem(values)
    toast.success(isEdit ? `${values.name} updated` : `${values.name} added to the menu`)
    navigate('/owner/menu')
  }

  const categories = data ? [...new Set(data.items.map((candidate) => candidate.category))] : []

  return (
    <div className={styles.page}>
      <Link className={styles.back} to="/owner/menu">
        Back to menu
      </Link>
      <h1 className={styles.title}>{isEdit ? 'Edit dish' : 'Add a dish'}</h1>

      {status === 'loading' && (
        <div className={styles.loading} role="status" aria-label="Loading the dish">
          <Skeleton variant="block" />
          <Skeleton variant="block" />
        </div>
      )}

      {status === 'error' && (
        <div className={styles.error} role="alert">
          <p>{error?.message ?? 'Your menu did not load.'} Give it another go.</p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}

      {status === 'success' && isEdit && !item && (
        <EmptyState
          title="That dish is not on your menu"
          description="It may have been removed. Head back to the list to pick another one."
          action={
            <Link className={styles.link} to="/owner/menu">
              Back to menu
            </Link>
          }
        />
      )}

      {status === 'success' && (!isEdit || item) && (
        <MenuItemForm
          initialValues={item ?? undefined}
          categories={categories}
          submitLabel={isEdit ? 'Save changes' : 'Add to menu'}
          onSubmit={save}
          onCancel={() => navigate('/owner/menu')}
        />
      )}
    </div>
  )
}
