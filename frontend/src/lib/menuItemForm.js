export const NAME_LIMITS = { min: 1, max: 80 }
export const DESCRIPTION_MAX = 300
export const CATEGORY_MAX = 40
export const PRICE_MAX = 100000

const WHOLE_RUPEES = /^\d+$/

// Returns a map of field name to message; empty when the values are fine. Mirrors the backend limits.
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
  if (!WHOLE_RUPEES.test(text) || Number(text) <= 0 || Number(text) > PRICE_MAX) {
    errors.price = `Enter a price above 0 and up to ${PRICE_MAX}, in whole rupees.`
  }
  return errors
}
