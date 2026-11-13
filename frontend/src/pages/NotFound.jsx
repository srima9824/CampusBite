import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui'

export default function NotFound() {
  return (
    <EmptyState
      headingLevel={1}
      title="This page left the table"
      description="We looked everywhere, even under the napkins. Head back home and try another dish."
      action={<Link to="/">Back to the kitchen</Link>}
    />
  )
}
