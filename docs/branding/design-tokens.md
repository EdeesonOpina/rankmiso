# Design tokens

Light colors follow the Miso site. Dark colors stay on the previous palette. Both live in `packages/design-tokens/src/tokens.css`. Components use Tailwind utilities such as `bg-primary`, `text-muted`, and `border-border`. Those utilities read the existing CSS variables, and those variables alias the `--miso-*` tokens. Change the `--miso-*` values to retheme the interface. Do not put hex colors in Vue files.

## Color

Light, matching the Miso site:

| Token | Value |
| --- | --- |
| `--miso-color-background` | `#fbf3e6` |
| `--miso-color-surface` | `#fffaf2` |
| `--miso-color-primary` | `#c42a20` |
| `--miso-color-primary-foreground` | `#fffaf2` |
| `--miso-color-text` | `#13213f` |
| `--miso-color-text-muted` | `#4a536b` |
| `--miso-color-border` | `#e6d5ba` |
| `--miso-color-warning` | `#9a4d00` |
| `--miso-color-error` | `#b4231b` |

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

Primary buttons use `text-primary-contrast`. That is cream on `#c42a20` in light mode and `#102016` on `#6ee7a0` in dark mode.

Theme preference is `light`, `dark`, or `system`, stored at `seoToolkit.theme`. The default is light. The resolved theme is applied on `documentElement.dataset.theme` before the logo chooses a PNG.

## Type

Light type names Nunito, then M PLUS Rounded 1c, then a rounded system face. Dark type stays Inter. `--miso-font-mono` is JetBrains Mono, then the system monospace stack. The extension does not request remote font files. Technical values such as heading levels use the mono stack through the existing `font-mono` utility.
