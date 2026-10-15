# Progress

Updated: 2026-10-15

## Completed

- Phase 0 research notes and the competitor matrix
- Cargo workspace with rule, scoring, and WASM crates
- 18 Rust tests passing, Clippy clean with warnings denied
- WXT Vue extension: popup, dashboard, options, side panel entry, background worker
- In-page extraction, highlight, and clear
- Local audit rendering and JSON, CSV, and HTML export
- Report-format tests and extension unit tests
- Chrome MV3 build and Firefox MV3 build script
- Design tokens for light, dark, and system appearance
- Privacy, security, and agent handoff documents
- Popup tabs: Overview, JSON-LD, Headings, Links, Images, and Social
- Readable JSON-LD fields, share-card previews, horizontal image rows, copy actions, and confirmed exports
- Light and dark color pairing: white text on the light-mode primary button, hairline borders in both themes
- Firefox temporary add-on used on live pages by the maintainer before the RankMiso move
- Repository moved to `/home/lenovo/Projects/Rust/rankmiso`
- Central brand config, temporary Miso palette, geometric placeholder mark, and `pnpm brand:icons`
- Dashboard labels moved into `src/locales/en.ts`
- Optional site check for headers, robots.txt, the first listed sitemap, redirect hops, hreflang return links, and a continuable sample of 20 public links
- Local JSON-LD field list, an explicit PageSpeed Insights unavailable check, Firefox id `rankmiso@rankmiso.extension`, and a sidebar button for both `sidePanel` and `sidebarAction`
- Chrome unpacked extension used by the maintainer on a live page, including the side panel
- Firefox listing text and upload steps in `docs/releases/firefox.md`

## In progress

- Firefox submission. The package has not been uploaded. The privacy policy is not on a public URL yet, and the GitHub repository is private.

## Not started

- Official rich-result eligibility. The current row is a local field list only
- Numeric Largest Contentful Paint, Cumulative Layout Shift, and Interaction to Next Paint. This version shows those cards as Unavailable. The resource count is shown
- SERP tools and multi-URL comparison
- PageSpeed Insights. The report says it was not requested
- Playwright browser-install suite
- Performance benchmarks
- Safari signing
- Chrome Web Store upload

## Test results from this session

- `cargo fmt --all` and `cargo clippy --workspace --all-targets -- -D warnings`: passed
- `cargo test --workspace`: 30 passed (27 rule tests, 3 scoring tests)
- `@rankmiso/extension` vitest: 19 passed
- `vue-tsc --noEmit` and ESLint: passed
- `pnpm build:wasm` and `wxt build -b firefox --mv3`: passed. Manifest name is RankMiso. Gecko id is `rankmiso@rankmiso.extension`. Local WASM asset is included.

The Firefox bundle for this version has not been loaded in a Firefox window. **Check this site** and the Firefox sidebar button are still untested there. Chrome popup and side panel were used by the maintainer on a live page.

## Blockers

- `wasm-bindgen-cli` must stay on 0.2.100. A newer CLI will not match the pinned crate.
