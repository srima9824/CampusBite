import { useState } from 'react'
import { Link } from 'react-router-dom'
import QuantityStepper from '../components/QuantityStepper.jsx'
import { Button, ConfirmDialog, EmptyState, useToast } from '../components/ui'
import { useCart } from '../context/CartContext.jsx'
import { roundMoney } from '../lib/cartTotals.js'
import { DELIVERY_FEE } from '../lib/constants.js'
import { formatMoney } from '../lib/formatMoney.js'
import styles from './Cart.module.css'

export default function Cart() {
  const cart = useCart()
  const toast = useToast()
  const [askingToClear, setAskingToClear] = useState(false)

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        headingLevel={1}
        title="Your cart is on a diet"
        description="Nothing in here yet. Pick a kitchen and add something tasty."
        action={
          <Link className={styles.link} to="/restaurants">
            Browse restaurants
          </Link>
        }
      />
    )
  }

  function handleClear() {
    cart.clear()
    setAskingToClear(false)
    toast.success('Cart emptied')
  }

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Your cart</h1>
        <p className={styles.lead}>
          From <Link to={`/restaurants/${cart.restaurantId}`}>{cart.restaurantName}</Link>
        </p>
      </header>

      <ul className={styles.lines}>
        {cart.lines.map((line) => (
          <li key={line.menu_item_id} className={styles.line}>
            <div className={styles.lineInfo}>
              <h2 className={styles.lineName}>{line.name}</h2>
              <p className={styles.unitPrice}>{formatMoney(line.unit_price)} each</p>
            </div>
            <QuantityStepper
              name={line.name}
              quantity={line.quantity}
              onChange={(quantity) => cart.setQuantity(line.menu_item_id, quantity)}
            />
            <p className={styles.lineTotal}>{formatMoney(line.unit_price * line.quantity)}</p>
            <Button
              variant="ghost"
              aria-label={`Remove ${line.name} from cart`}
              onClick={() => cart.removeItem(line.menu_item_id)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <section className={styles.summary} aria-labelledby="cart-summary-title">
        <h2 id="cart-summary-title" className={styles.summaryTitle}>
          Summary
        </h2>
        <dl className={styles.totals}>
          <div className={styles.totalRow}>
            <dt>Subtotal</dt>
            <dd>{formatMoney(cart.subtotal)}</dd>
          </div>
          <div className={styles.totalRow}>
            <dt>Delivery fee</dt>
            <dd>{formatMoney(DELIVERY_FEE)}</dd>
          </div>
          <div className={`${styles.totalRow} ${styles.grandTotal}`}>
            <dt>Total</dt>
            <dd>{formatMoney(roundMoney(cart.subtotal + DELIVERY_FEE))}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <Link className={styles.link} to="/checkout">
            Checkout
          </Link>
          <Button variant="secondary" onClick={() => setAskingToClear(true)}>
            Clear cart
          </Button>
        </div>
      </section>

      {askingToClear && (
        <ConfirmDialog
          title="Empty your cart?"
          message="Every dish in it goes back on the shelf."
          confirmLabel="Empty cart"
          cancelLabel="Keep my cart"
          tone="danger"
          onConfirm={handleClear}
          onCancel={() => setAskingToClear(false)}
        />
      )}
    </div>
  )
}
