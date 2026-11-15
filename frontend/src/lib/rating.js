// "4.3 (12 reviews)", or null while a restaurant has no reviews yet.
export function ratingText(restaurant) {
  if (!restaurant.review_count || restaurant.average_rating == null) return null
  const reviews = restaurant.review_count === 1 ? 'review' : 'reviews'
  return `${restaurant.average_rating.toFixed(1)} (${restaurant.review_count} ${reviews})`
}
