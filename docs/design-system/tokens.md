# Design tokens

Tokens are CSS variables in `packages/design-tokens/src/tokens.css`. Tailwind maps them to color utilities such as `bg-surface` and `text-muted`. Components use those utilities.

Light and dark sets cover background, surface, elevated surface, primary, secondary, text, muted text, border, success, warning, error, information, and focus. The dark muted text is `#c4bdb2` on `#1e1c19` so it stays readable.

Typography uses the system sans and monospace stacks. Sizes in the popup stay at 12–15px. The score number is larger.

Spacing uses a 4px scale. Panels use a 10px radius. Borders use the `--border` hairline in both themes, a warm gray in light mode and a low-contrast brown in dark mode, so outlines do not pick up the text color. Motion is removed under `prefers-reduced-motion`. Focus uses a 2px outline on `:focus-visible`.

The popup is 420px wide. The dashboard sidebar is 232px.

Theme preference is `system`, `light`, or `dark`, stored locally. `system` follows `prefers-color-scheme`.

In light mode the primary button is deep green with white text. In dark mode it is a lighter green with near-black text. Those pairings come from `--primary` and `--primary-contrast`. Button text color is left to those utilities so a later rule does not force the page text color onto the fill.
