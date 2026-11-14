const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  currencyDisplay: 'code',
  minimumFractionDigits: 2,
})

export function formatMoney(amount) {
  return rupees.format(amount).replace(/INR\s?/, 'Rs. ')
}
