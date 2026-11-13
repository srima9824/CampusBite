import styles from './EmptyState.module.css'

export default function EmptyState({ title, description, action, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`
  return (
    <div className={styles.empty}>
      <Heading className={styles.title}>{title}</Heading>
      {description && <p className={styles.description}>{description}</p>}
      {action}
    </div>
  )
}
