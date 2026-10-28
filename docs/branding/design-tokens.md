# Design tokens

RankMiso uses its own white-first application design. The Miso website at `~/Projects/Next/misoecosystem.com` supplies the fox icon and the RankMiso illustration. It does not set the canvas, cards, type, or layout. The extension does not import that repository.

Values live in `packages/design-tokens/src/tokens.css`. The popup (`popup.css`) and the sidebar and report (`workbench.css`) carry the approved prototype palettes, which use the same Miso red, navy, and white. Do not put hex colors in Vue files.

## Light

| Token | Value | Role |
| --- | --- | --- |
| `--miso-color-background` | `#ffffff` | Application canvas |
| `--miso-color-surface` | `#f8f9fb` | Sidebar, secondary controls |
| `--miso-color-surface-muted` | `#f3f4f6` | Grouped neutral fill |
| `--miso-color-elevated` | `#ffffff` | Cards |
| `--miso-color-text` | `#17191f` | Main text |
| `--miso-color-text-muted` | `#667085` | Secondary text |
| `--miso-color-border` | `#e5e7eb` | Card and control borders |
| `--miso-color-primary` | `#c42a20` | Brand accent and primary actions |
| `--miso-color-primary-foreground` | `#ffffff` | Text on a primary fill |

Cards use a 1px neutral border, a 14px radius, and a 1px shadow. They do not use a coral outline or a tinted wash. Success, warning, and error stay separate from the brand red.

## Dark

Dark keeps the navy surfaces from the website dashboard: canvas `#0f1424`, surface `#171e33`, elevated `#222a43`, text `#f1e9da`, muted `#aab1c5`, border `#2c3552`. Primary is `#ef5340` with `#0f1424` text. Card borders stay neutral. This is not an inversion of the white theme.

## Type

`--miso-font-sans` is `ui-sans-serif`, `system-ui`, `-apple-system`, Segoe UI, Roboto, Helvetica Neue, Arial. `--miso-font-mono` is `ui-monospace`, then SF Mono, Cascadia Code, Segoe UI Mono, Menlo, and Consolas. No webfont is downloaded. Popup text stays at 12–15px. The score number is larger. Category values use tabular numbers.

## Mark

`apps/extension/public/brand/icon.png` is a copy of the website's `public/brand/miso-icon.png`. Light and dark headers use that file. Empty history shows a 192px copy of `public/brand/rankmiso-fox.webp`. The header does not use the website noren stripe.
