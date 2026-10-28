# Design tokens

Tokens are CSS variables in `packages/design-tokens/src/tokens.css`. Tailwind maps them to color utilities such as `bg-surface` and `text-muted`. Components use those utilities.

Light and dark sets cover background, surface, elevated surface, primary, secondary, text, muted text, border, success, warning, error, information, and focus. The light canvas is white. Cards are white with a neutral border. Miso red is the accent, not the card outline. Dark values keep the navy dashboard surfaces. Light primary is `#c42a20` with white text. Dark primary is `#ef5340` with `#0f1424` text. The value table is in `docs/branding/design-tokens.md`.

Typography uses the platform UI stack in both themes. Monospace uses the platform mono stack. The extension does not download webfonts and does not name Nunito or M PLUS Rounded 1c. Sizes in the popup stay at 12–15px. The score number is larger. Category values use tabular numbers.

Spacing uses a 4px scale. Panels use the `--radius` token. Borders use the `--border` hairline in both themes, so outlines do not pick up the text color. Motion is removed under `prefers-reduced-motion`. Focus uses a 2px outline on `:focus-visible`. Disabled controls use reduced opacity. There is no separate disabled color token.

The popup is 420px wide. Gutters and section gaps use `--gutter` and `--section-gap`, which alias the 16px space step. Report padding uses the 24px step. Information groups use `--card-fill`, `--card-line`, `--card-radius` (18px), and `--card-wash`. The fill is the ivory surface in light mode and the elevated surface in dark mode. The line mixes the theme primary into the border, so light cards have a coral edge and dark cards use the dark accent. `--card` is the same fill. It is not white. Inputs, the snippet draft, and platform previews stay visually separate from that card. Open Graph and X previews use `--preview-*` surfaces inside the Miso card. The score is an 80px SVG ring with the number centered. A missing score draws the track only. Categories under 100 use a 6px bar and a number. The dashboard sidebar is 232px. Below 760px, and in the sidebar panel, destinations use one non-wrapping tab strip. The strip drags with the mouse, scrolls natively with touch and a trackpad, and keeps arrow, Home, and End keys. A thin meter shows the scroll position, edge fades mark the sides that still have tabs, and a dismissible hint is stored locally. Its scrollbar is hidden. The page scrollbar is not.

Theme preference is `light`, `dark`, or `system`, stored locally. The default is light. `system` follows `prefers-color-scheme`.

Button text on a primary fill uses `--primary-contrast`. Category bars use the success, warning, and error tokens and always show a number or "Not measured" beside the bar.
