# Accessibility

Target: WCAG 2.2 AA. Axe in the tests cannot check colour contrast in jsdom, so contrast is guaranteed by the pairings below. Re-check them whenever `tokens.css` changes.

## Contrast pairings (Option A)
| Text | Background | Ratio |
| --- | --- | --- |
| `--color-on-primary` `#000000` | `--color-primary` `#EA580C` | 5.90 |
| `--color-on-primary` `#000000` | `--color-primary-hover` `#F97316` | 7.49 |
| `--color-primary-text` `#C2410C` | `--color-bg` / `--color-surface` / `--color-muted` | 4.88 / 5.18 / 4.78 |
| `--color-on-accent` `#FFFFFF` | `--color-accent` `#2563EB` | 5.17 |
| `--color-fg` `#0F172A` | `--color-bg` / `--color-surface` | 16.81 / 17.85 |
| `--color-muted-fg` `#475569` | `--color-bg` / `--color-muted` / `--color-surface` | 7.14 / 6.99 / 7.58 |
| `--color-on-danger` `#FFFFFF` | `--color-danger` `#DC2626` | 4.83 |
| `--color-danger-text` `#B91C1C` | `--color-surface` / `--color-bg` | 6.47 / 6.09 |
| `--color-success-fg` / `-bg` | `#166534` on `#DCFCE7` | 6.49 |
| `--color-warning-fg` / `-bg` | `#92400E` on `#FEF3C7` | 6.37 |
| `--color-info-fg` / `-bg` | `#1E40AF` on `#DBEAFE` | 7.15 |
| `--color-danger-fg` / `-bg` | `#991B1B` on `#FEE2E2` | 6.80 |
| `--color-on-scrim` `#FFFFFF` | `--color-scrim` `rgb(15 23 42 / 78%)` over the lightest possible photo (white) | 8.9 |
| `--color-muted-fg` `#475569` | `--color-surface` (footer text and profile role label) | 7.58 |
| `--color-fg` `#0F172A` | `--color-surface` (profile name) | 17.85 |

Carousel text is white on the scrim. The scrim is a gradient that is fully 78% dark from the bottom up to 60% of the slide height, and all slide text sits in that area, so 8.9 is the worst case over any photo. The cuisine badge and the "See the menu" label keep their own pairings above.

Non-text (3:1 minimum): `--color-border-strong` `#64748B` on surface / bg is 4.76 / 4.48. The focus ring `--color-ring` `#EA580C` on bg / surface is 3.35 / 3.56. `--color-border` is decorative only. White text is never placed on `--color-primary`.

## Rules
- Focus: every interactive element shows a 2px `:focus-visible` outline with a 2px offset (global.css). Never remove it.
- Targets: buttons, inputs and nav links are at least 44px high (`--tap-min`).
- Keyboard: Tab order is skip link, nav, page content. No traps. The skip link jumps to `#main`.
- Forms: every input has a visible label. Hints and errors are linked with `aria-describedby`, and `aria-invalid` is set only when there is an error.
- Status is never colour alone: badges always carry text, errors always carry a message.
- Motion: under `prefers-reduced-motion: reduce` the duration tokens become 0ms, transitions stop and the skeleton shimmer is off.
- Text: body is 16px with line height 1.5. Page language is set on `<html lang="en">`.
- Icons: no emoji as icons. Decorative elements use `aria-hidden="true"`.
- Carousel: a visible Pause/Play button is always present (WCAG 2.2.2) and auto-advance also stops on hover and while focus is inside. With `prefers-reduced-motion: reduce` it starts paused and never advances by itself. The live region is `aria-live="off"` while cycling and `polite` when paused, hovered, focused or after a manual change, so screen readers hear slide changes only when the user caused them. Inactive slides are `aria-hidden` and `inert`, so only one link is ever focusable. Previous, Next, dots (`aria-current` on the active one) and the Left/Right arrow keys all work, and every control is at least 44px.
- Profile chip: plain text with an `aria-hidden` initial; its text reads "Signed in as NAME, ROLE". It has no hover state and is not focusable, so it is not mistaken for a control.
- Footer: its own `<nav aria-label="Footer">` with the same role-aware links as the header.

## Breakpoints
Mobile first: 375 (base), 768, 1024, 1440. Media queries use literal px because custom properties do not work in them. No horizontal scroll at 375px.

## Component checklist
- Button: native `<button>`, default `type="button"`, loading sets `aria-busy` and disables.
- Input: label, hint, error wired by id, forwards native attributes.
- Badge: text always present, tone changes style only.
- Skeleton: `aria-hidden`, reserves space, no motion when reduced.
- EmptyState: real heading with configurable level, optional action, no image.
