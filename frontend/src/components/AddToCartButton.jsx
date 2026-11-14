import { useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { Button, ConfirmDialog, useToast } from './ui'
import QuantityStepper from './QuantityStepper.jsx'

export default function AddToCartButton({ item, restaurant }) {
  const cart = useCart()
  const toast = useToast()
  const [askingToReplace, setAskingToReplace] = useState(false)
  const line = cart.lines.find((candidate) => candidate.menu_item_id === item.id)

  function handleAdd() {
    const { conflict } = cart.addItem(item, restaurant)
    if (conflict) setAskingToReplace(true)
    else toast.success('Added to your cart')
  }

  function handleReplace() {
    cart.replaceWith(item, restaurant)
    setAskingToReplace(false)
    toast.success('Fresh cart started with your pick')
  }

  return (
    <>
      {line ? (
        <QuantityStepper
          name={item.name}
          quantity={line.quantity}
          onChange={(quantity) => cart.setQuantity(item.id, quantity)}
        />
      ) : (
        <Button aria-label={`Add ${item.name} to cart`} onClick={handleAdd}>
          Add
        </Button>
      )}
      {askingToReplace && (
        <ConfirmDialog
          title="Start a new cart?"
          message={`Your cart has items from ${cart.restaurantName}. Starting a new one clears them.`}
          confirmLabel="Start new cart"
          cancelLabel="Keep my cart"
          onConfirm={handleReplace}
          onCancel={() => setAskingToReplace(false)}
        />
      )}
    </>
  )
}
