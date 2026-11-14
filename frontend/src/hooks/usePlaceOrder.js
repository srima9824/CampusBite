import { useRef, useState } from 'react'
import { orders } from '../api'
import { useCart } from '../context/CartContext.jsx'

// Resolves with the placed order, or null when the api refused it (see `error`).
export default function usePlaceOrder() {
  const { clear } = useCart()
  const [state, setState] = useState({ status: 'idle', error: null })
  const inFlight = useRef(false)

  async function submit(request) {
    if (inFlight.current) return null
    inFlight.current = true
    setState({ status: 'loading', error: null })
    try {
      const order = await orders.placeOrder(request)
      clear()
      setState({ status: 'success', error: null })
      return order
    } catch (error) {
      setState({ status: 'error', error })
      return null
    } finally {
      inFlight.current = false
    }
  }

  return { submit, status: state.status, error: state.error }
}
