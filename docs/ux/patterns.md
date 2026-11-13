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
