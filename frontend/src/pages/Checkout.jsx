import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import OrderSummary from '../components/OrderSummary.jsx'
import { Button, Input } from '../components/ui'
import { useCart } from '../context/CartContext.jsx'
import usePlaceOrder from '../hooks/usePlaceOrder.js'
import { DELIVERY_FEE } from '../lib/constants.js'
import { roundMoney } from '../lib/cartTotals.js'
import styles from './Checkout.module.css'

const MIN_ADDRESS = 5
const MAX_ADDRESS = 200

function validateAddress(address) {
  const length = address.trim().length
  if (length === 0) return 'Tell us where to bring the food.'
  if (length < MIN_ADDRESS) return `Add a little more detail, at least ${MIN_ADDRESS} characters.`
  if (length > MAX_ADDRESS) return `Keep it under ${MAX_ADDRESS} characters.`
  return ''
}

function errorMessage(error) {
  return error.message || 'We could not place your order. Please try again.'
}

export default function Checkout() {
  const cart = useCart()
  const navigate = useNavigate()
  const { submit, status, error } = usePlaceOrder()
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [addressError, setAddressError] = useState('')

  // Placing the order empties the cart; the success status keeps that from bouncing us to /cart.
  if (cart.lines.length === 0 && status !== 'success') return <Navigate to="/cart" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    const problem = validateAddress(address)
    setAddressError(problem)
    if (problem) return
    const order = await submit({
      restaurant_id: cart.restaurantId,
      items: cart.lines.map(({ menu_item_id: id, quantity }) => ({ menu_item_id: id, quantity })),
      delivery_address: address,
      note,
    })
    if (order) navigate(`/order-confirmation/${order.id}`, { replace: true })
  }

  const lines = cart.lines.map((line) => ({
    ...line,
    line_total: roundMoney(line.unit_price * line.quantity),
  }))

  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.title}>Almost there</h1>
        <p className={styles.lead}>Tell us where to bring it, then press pay.</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <section className={styles.card} aria-labelledby="delivery-title">
          <h2 id="delivery-title" className={styles.cardTitle}>
            Delivery
          </h2>
          <Input
            label="Delivery address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            error={addressError}
            autoComplete="street-address"
            placeholder="Block B, Room 204, Hostel Road, near the main gate"
            required
          />
          <div className={styles.field}>
            <label className={styles.label} htmlFor="order-note">
              Note for the kitchen (optional)
            </label>
            <textarea
              id="order-note"
              className={styles.textarea}
              rows={3}
              maxLength={200}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Extra crispy, no onions, ring the bell"
            />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="summary-title">
          <h2 id="summary-title" className={styles.cardTitle}>
            Your order from {cart.restaurantName}
          </h2>
          <OrderSummary
            lines={lines}
            subtotal={cart.subtotal}
            deliveryFee={DELIVERY_FEE}
            total={roundMoney(cart.subtotal + DELIVERY_FEE)}
          />
        </section>

        <section className={styles.card} aria-labelledby="payment-title">
          <h2 id="payment-title" className={styles.cardTitle}>
            Payment
          </h2>
          <p className={styles.payment}>
            Dummy payment: no real money moves. Your card is safe, your wallet is too.
          </p>
        </section>

        {error && (
          <div className={styles.error} role="alert">
            <p>{errorMessage(error)}</p>
            {error.code === 'item_unavailable' && <Link to="/cart">Back to your cart</Link>}
          </div>
        )}

        <Button type="submit" size="lg" loading={status === 'loading'}>
          Pay now
        </Button>
      </form>
    </div>
  )
}
