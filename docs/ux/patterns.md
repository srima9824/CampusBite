# UI patterns

Reusable behaviour shared by several screens. Each unit appends its patterns.

## Four states for data views
Every list or detail that loads data shows one of:
- Loading: `Skeleton` placeholders in the shape of the content, wrapped in `role="status"` with a label.
- Empty: `EmptyState` with a playful title, one sentence on why, and the next action (for example Clear search).
- Error: a `role="alert"` message saying what happened plus a Retry button that reloads the data.
- Success: the content.

## Search and pagination
Used on `/restaurants`.
- The search input is debounced by 250 ms and writes `?q=` to the URL, so refresh and the browser Back button restore the search. Changing the search drops `page`.
- The page number lives in `?page=` (1-based, missing means 1). Changing the page keeps `q`.
- `Pagination` (`components/ui`) takes `page`, `pageSize`, `total` and `onChange`. It renders Previous and Next buttons with "Page X of Y" text, disables the buttons at the ends and renders nothing when there is only one page.
- The api returns `{ items, total, page, page_size }`; the page computes the page count from `total`.
- Cards in a grid are single links: the whole card is the link, its accessible name is the item name, and the target is at least 44px tall.

## Filter bar
Used on `/restaurants/:restaurantId`.
- Text and price inputs sit in one `role="search"` form with visible labels and a Clear filters button that resets every filter at once.
- Values are debounced by 250 ms into URL params (`q`, `min_price`, `max_price`), so reload and Back keep the filters. Empty values are left out of the URL.
- The price range is inclusive. If min is above max, the page shows an inline `role="alert"` message and does not call the api (which would answer `422 invalid_price_range`).
- Results are grouped by category with an `h2` per group; the page title is the only `h1`.
- A dish that cannot be ordered stays visible with a "Sold out" text badge and a muted card, so status never relies on colour alone.

## Confirm dialog
Used for destructive or surprising choices (start a new cart, empty the cart).
- `ConfirmDialog` (`components/ui`) wraps `Modal`, a native `<dialog>` opened with `showModal()`. Mounting it opens it and unmounting closes it, so the caller owns one boolean.
- The browser traps focus inside and makes the page behind inert. Escape and a click on the dimmed area both cancel. Focus returns to the control that opened it.
- It is labelled by its title. The safe choice is the secondary button on the left, the action is on the right; `tone="danger"` marks destructive actions. While `loading` both buttons are disabled.
- Titles are a question ("Start a new cart?"); button labels name the outcome ("Start new cart", "Keep my cart"), never a bare Yes or No.

## Toast
Used for success and error feedback after an action that has no inline result.
- `ToastProvider` renders one `aria-live="polite"` region; `useToast()` gives `toast.success(message)` and `toast.error(message)`. Errors carry `role="alert"`.
- A toast never takes focus. It has a Dismiss button, disappears after 4 seconds and pauses while hovered or focused.
- Success text is short and plain ("Added to your cart"). Errors say what happened and what to do next.

## Order status badge
`OrderStatusBadge` always prints the status as text, so colour is never the only signal.

| Status | Label | Tone |
| --- | --- | --- |
| PLACED | Placed | info |
| ACCEPTED | Accepted | info |
| PREPARING | Preparing | warning |
| READY | Ready | warning |
| OUT_FOR_DELIVERY | Out for delivery | info |
| DELIVERED | Delivered | success |
| CANCELLED | Cancelled | danger |

## Checkout and dummy payment
- The address is required (5 to 200 characters) and checked before the api is called; the error sits under the field. The note is optional.
- One button, "Pay now (dummy)", disabled with a spinner while the order is placed, so a double click places one order. The payment panel says plainly that no real money moves.
- Api errors appear in a `role="alert"` box above the button. A sold-out dish names itself and links back to the cart, which stays intact. The cart is emptied only after the api accepts the order.
- Amounts on the confirmation page are the ones the api returned.

## Table
`Table` takes `columns` (`key`, `header`, `render`), `rows`, `caption` and `getRowKey`. The caption names the region (`role="region"`, focusable so keyboard users can scroll it) and can be visually hidden when a page heading already says it.
- From 768px it is a real table with column headers.
- Below 768px each row becomes a stacked card: the header row is hidden and every cell shows its column header from `data-label`, so nothing scrolls sideways.
- Status is always text (`OrderStatusBadge`), never colour alone.

## Cancelling an order
`CancelOrderDialog` is the confirm dialog for order cancellation, used from the history table and the detail page. It says what cannot be undone, offers "Keep order" as the safe choice, and on either outcome closes, shows a toast ("Order cancelled" or the api's message) and lets the page reload so the row shows the real status. Focus moves to the page heading afterwards because the Cancel button is gone.

## Order timeline
`OrderTimeline` is an ordered list of the six forward steps. Each step says "Done", "Now" or "Up next" in text and shows its time from `status_history`; exactly one step has `aria-current="step"`. A cancelled order keeps the steps it reached and ends on a "Cancelled" step. It is vertical below 1024px and horizontal from 1024px. Tracking is manual: the order page has a Refresh button that announces "Updated".
