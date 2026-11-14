export function roundMoney(amount) {
  return Math.round(amount * 100) / 100
}

export function subtotal(lines) {
  return roundMoney(lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0))
}
