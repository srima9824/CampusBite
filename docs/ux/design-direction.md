# Design direction

## Product context
CampusBite is a restaurant ordering and delivery app for students. People use it on phones, often in a hurry, so the identity should feel appetising, quick and friendly. It is an app, not a landing page.

## Research (ui-ux-pro-max)
- `--design-system "campus food ordering delivery restaurant marketplace students"` suggested red with Karla and Playfair and a block-based landing pattern. The landing pattern does not apply, and a serif is too formal for students.
- `--domain color "food delivery restaurant"` returned "Food Delivery / On-Demand" (orange `#EA580C`, blue `#2563EB`, bg `#FFF7ED`) and "Restaurant/Food Service" (red `#DC2626`, gold `#A16207`, bg `#FEF2F2`).
- `--domain typography "friendly modern readable"` led to Plus Jakarta Sans.
- `--domain color "fresh healthy organic"` returned "Calorie & Nutrition Counter" (green `#059669`, bg `#ECFDF5`, accent `#EA580C`), used for Option C.

## Chosen: Option A "Warm Orange" (approved by the owner)
Orange signals appetite and speed. White on `#EA580C` is only about 3.6:1, so text on primary is black (5.9:1). Do not switch it to white.

| Role | Token | Value |
| --- | --- | --- |
| Primary / on primary | `--color-primary` / `--color-on-primary` | `#EA580C` / `#000000` |
| Primary hover | `--color-primary-hover` | `#F97316` (lighter, so black text still passes) |
| Orange as text on light | `--color-primary-text` | `#C2410C` |
| Accent / on accent | `--color-accent` / `--color-on-accent` | `#2563EB` / `#FFFFFF` |
| Background / surface | `--color-bg` / `--color-surface` | `#FFF7ED` / `#FFFFFF` |
| Text / muted text | `--color-fg` / `--color-muted-fg` | `#0F172A` / `#475569` |
| Input border | `--color-border-strong` | `#64748B` |
| Danger / on danger | `--color-danger` / `--color-on-danger` | `#DC2626` / `#FFFFFF` |

Status tones (success, warning, danger, info) each have `-bg` and `-fg` tokens. All values are in `frontend/src/styles/tokens.css`.

- Type: Plus Jakarta Sans (400/500/600/700), system fallback stack, body 16px, line height 1.5.
- Shape: soft radius (6, 12, 20px and full), flat surfaces with a light shadow.
- Copy tone: playful and food-themed, light-hearted but always clear. Errors and empty states say what happened and what to do next. No emoji.
- Dark mode: light only for now. Tokens are semantic, so a dark block can be added later.

## Swapping the identity
Edit the values in `frontend/src/styles/tokens.css` and the Google Fonts `<link>` in `frontend/index.html`. Components and pages only use `var(--token)`, so nothing else changes. Check the pairings in `accessibility.md` after a swap.

## Option B "Appetite Red"
Query: `--domain color "food delivery restaurant"` (Restaurant/Food Service).

| Token | Value |
| --- | --- |
| `--color-primary` / `--color-on-primary` | `#DC2626` / `#FFFFFF` (4.83:1) |
| `--color-primary-hover` | `#F87171` with `#000000` text (7.59:1), or `#B91C1C` with white |
| `--color-accent` (gold) | `#A16207` (4.50:1 on bg, borderline; use `#92400E` for small text) |
| `--color-bg` / `--color-fg` / `--color-border` | `#FEF2F2` / `#450A0A` (14.76:1) / `#FECACA` |
| Fonts | Karla body, Playfair Display SC headings |

Rationale: classic restaurant feel. Trade-off: more formal, and red reads as an error, so danger needs a distinct treatment.

## Option C "Fresh Green"
Query: `--domain color "fresh healthy organic"` (Calorie & Nutrition Counter).

| Token | Value |
| --- | --- |
| `--color-primary` / `--color-on-primary` | `#059669` / `#000000` (5.57:1) |
| `--color-primary-text` | `#047857` (5.21:1 on bg; plain `#059669` is only 3.58:1) |
| `--color-accent` (orange) | `#EA580C` with `#000000` text (5.90:1) |
| `--color-bg` / `--color-fg` / `--color-border` | `#ECFDF5` / `#0F172A` (16.95:1) / `#E1F2ED` |
| Fonts | Plus Jakarta Sans |

Rationale: calm, healthy and campus-friendly. Trade-off: less appetite-driven and less urgent for order actions.
