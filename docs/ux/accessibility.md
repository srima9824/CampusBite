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

## Breakpoints
Mobile first: 375 (base), 768, 1024, 1440. Media queries use literal px because custom properties do not work in them. No horizontal scroll at 375px.

## Component checklist
- Button: native `<button>`, default `type="button"`, loading sets `aria-busy` and disables.
- Input: label, hint, error wired by id, forwards native attributes.
- Badge: text always present, tone changes style only.
- Skeleton: `aria-hidden`, reserves space, no motion when reduced.
- EmptyState: real heading with configurable level, optional action, no image.
