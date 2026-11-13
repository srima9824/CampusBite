import { useState } from 'react'
import { Badge, Button, ConfirmDialog, EmptyState, Input, Pagination, Skeleton } from '../components/ui'
import styles from './Styleguide.module.css'

const COLOR_TOKENS = [
  'primary', 'on-primary', 'primary-hover', 'primary-text', 'accent', 'on-accent',
  'bg', 'fg', 'surface', 'muted', 'muted-fg', 'border', 'border-strong', 'ring',
  'danger', 'on-danger', 'danger-bg', 'danger-fg', 'danger-text',
  'success', 'success-bg', 'success-fg', 'warning', 'warning-bg', 'warning-fg',
  'info', 'info-bg', 'info-fg',
]
const TEXT_SIZES = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl']
const WEIGHTS = ['regular', 'medium', 'semibold', 'bold']
const SPACES = [1, 2, 3, 4, 5, 6, 7, 8]
const RADII = ['sm', 'md', 'lg', 'full']
const SHADOWS = ['sm', 'md']
const BADGE_TONES = ['neutral', 'success', 'warning', 'danger', 'info']
const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'danger']

function readColorValues() {
  const rootStyle = getComputedStyle(document.documentElement)
  return Object.fromEntries(
    COLOR_TOKENS.map((name) => [name, rootStyle.getPropertyValue(`--color-${name}`).trim()]),
  )
}

function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

function PaginationExample() {
  const [page, setPage] = useState(2)
  return <Pagination page={page} pageSize={6} total={20} onChange={setPage} />
}

function ConfirmExample() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open a confirm dialog
      </Button>
      {open && (
        <ConfirmDialog
          title="Start a new cart?"
          message="Your cart has items from Dosa Dash. Starting a new one clears them."
          confirmLabel="Start new cart"
          onConfirm={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  )
}

export default function Styleguide() {
  const [colorValues] = useState(readColorValues)

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Styleguide</h1>
        <p className={styles.lead}>
          The full menu of colours, type and building blocks. Every value below comes from
          tokens.css, so one edit re-flavours the whole app.
        </p>
      </header>

      <Section title="Colors">
        <div className={styles.grid}>
          {COLOR_TOKENS.map((name) => (
            <div key={name} className={styles.swatch}>
              <div className={`${styles.swatchColor} ${styles[`c-${name}`]}`} />
              <div className={styles.swatchInfo}>
                <span className={styles.swatchName}>--color-{name}</span>
                <span className={styles.swatchValue}>{colorValues[name]}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className={styles.stack}>
          {TEXT_SIZES.map((size) => (
            <div key={size} className={styles.typeRow}>
              <span className={styles.typeLabel}>--text-{size}</span>
              <span className={styles[`t-${size}`]}>Fresh off the grill</span>
            </div>
          ))}
          {WEIGHTS.map((weight) => (
            <div key={weight} className={styles.typeRow}>
              <span className={styles.typeLabel}>--weight-{weight}</span>
              <span className={styles[`w-${weight}`]}>Extra crispy, extra friendly</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Spacing">
        <div className={styles.stack}>
          {SPACES.map((step) => (
            <div key={step} className={styles.spaceRow}>
              <span className={styles.spaceLabel}>--space-{step}</span>
              <span className={`${styles.spaceBar} ${styles[`s-${step}`]}`} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radius and shadow">
        <div className={styles.grid}>
          {RADII.map((radius) => (
            <div key={radius} className={`${styles.sample} ${styles[`r-${radius}`]}`}>
              --radius-{radius}
            </div>
          ))}
          {SHADOWS.map((shadow) => (
            <div key={shadow} className={`${styles.sample} ${styles[`sh-${shadow}`]}`}>
              --shadow-{shadow}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Button">
        <h3 className={styles.subTitle}>Variants (press Tab to see the focus ring)</h3>
        <div className={styles.row}>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
        <h3 className={styles.subTitle}>Sizes</h3>
        <div className={styles.row}>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
        <h3 className={styles.subTitle}>Disabled</h3>
        <div className={styles.row}>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} disabled>
              {variant}
            </Button>
          ))}
        </div>
        <h3 className={styles.subTitle}>Loading</h3>
        <div className={styles.row}>
          <Button loading>Toasting your order</Button>
          <Button variant="secondary" loading>
            Simmering
          </Button>
        </div>
      </Section>

      <Section title="Input">
        <div className={styles.stack}>
          <Input label="Your name" placeholder="Hungry Student" />
          <Input label="Campus email" type="email" hint="We only use it to send your receipts." />
          <Input
            label="Delivery room"
            defaultValue="???"
            error="That room is not on our map. Try something like B-204."
          />
          <Input label="Dish of the day" value="Sold out" disabled readOnly />
        </div>
      </Section>

      <Section title="Badge">
        <div className={styles.row}>
          {BADGE_TONES.map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Pagination">
        <PaginationExample />
      </Section>

      <Section title="Modal and confirm dialog">
        <ConfirmExample />
      </Section>

      <Section title="Skeleton">
        <div className={styles.card}>
          <div className={styles.row}>
            <Skeleton variant="circle" />
            <Skeleton width="10rem" />
          </div>
          <Skeleton variant="block" />
          <Skeleton width="60%" />
        </div>
      </Section>

      <Section title="Empty state">
        <EmptyState
          title="Your tray is empty"
          description="Nothing here yet. Add a snack and we will keep it warm for you."
          action={<Button>Find a snack</Button>}
        />
      </Section>
    </div>
  )
}
