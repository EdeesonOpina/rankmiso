# Design tokens

The temporary palette and type stacks live in `packages/design-tokens/src/tokens.css`. Components use Tailwind utilities such as `bg-primary`, `text-muted`, and `border-border`. Those utilities read the existing CSS variables, and those variables alias the `--miso-*` tokens. Change the `--miso-*` values to retheme the interface. Do not put hex colors in Vue files.

## Color

Light:

| Token | Value |
| --- | --- |
| `--miso-color-background` | `#ffffff` |
| `--miso-color-surface` | `#f7f9f8` |
| `--miso-color-primary` | `#166534` |
| `--miso-color-primary-foreground` | `#ffffff` |
| `--miso-color-text` | `#17211c` |
| `--miso-color-text-muted` | `#64746b` |
| `--miso-color-border` | `#e4ebe6` |
| `--miso-color-warning` | `#b7791f` |
| `--miso-color-error` | `#b42318` |

Dark, on `[data-theme="dark"]`:

| Token | Value |
| --- | --- |
| `--miso-color-background` | `#101614` |
| `--miso-color-surface` | `#19211e` |
| `--miso-color-primary` | `#6ee7a0` |
| `--miso-color-primary-foreground` | `#102016` |
| `--miso-color-text` | `#eaf2ec` |
| `--miso-color-text-muted` | `#9aaca1` |
| `--miso-color-border` | `#2d3a32` |
| `--miso-color-warning` | `#f6c76a` |
| `--miso-color-error` | `#ff8f86` |

Success, info, elevated, focus, and badge backgrounds remain because the current screens use them. They sit next to the palette above and can be replaced when the final identity arrives.

Primary buttons use `text-primary-contrast`. That is white on `#166534` in light mode and `#102016` on `#6ee7a0` in dark mode.

Theme preference is still `system`, `light`, or `dark`, stored at `seoToolkit.theme`. The resolved theme is applied on `documentElement.dataset.theme` before the logo chooses a PNG.

## Type

`--miso-font-sans` is `Inter`, then the system UI stack. `--miso-font-mono` is `JetBrains Mono`, then the system monospace stack. The extension does not request remote font files. Technical values such as heading levels use the mono stack through the existing `font-mono` utility.
