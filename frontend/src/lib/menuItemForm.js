export const NAME_LIMITS = { min: 2, max: 80 }
export const DESCRIPTION_MAX = 300
export const CATEGORY_MAX = 40
export const PRICE_MAX = 10000

const TWO_DECIMALS = /^\d+(\.\d{1,2})?$/

// Returns a map of field name to message; empty when the values are fine. The form and the mock api both use it.
export function validateMenuItem({ name, description, category, price }) {
  const errors = {}
  const trimmedName = String(name ?? '').trim()
  if (trimmedName.length < NAME_LIMITS.min || trimmedName.length > NAME_LIMITS.max) {
    errors.name = `Give the dish a name of ${NAME_LIMITS.min} to ${NAME_LIMITS.max} characters.`
  }
  if (String(description ?? '').trim().length > DESCRIPTION_MAX) {
    errors.description = `Keep the description to ${DESCRIPTION_MAX} characters or fewer.`
  }
  const trimmedCategory = String(category ?? '').trim()
  if (!trimmedCategory) {
    errors.category = 'Pick a category so customers can find the dish.'
  } else if (trimmedCategory.length > CATEGORY_MAX) {
    errors.category = `Keep the category to ${CATEGORY_MAX} characters or fewer.`
  }
  const text = String(price ?? '').trim()
  if (!TWO_DECIMALS.test(text) || Number(text) <= 0 || Number(text) > PRICE_MAX) {
    errors.price = `Enter a price above 0 and up to ${PRICE_MAX}, with at most two decimals.`
  }
  return errors
}
