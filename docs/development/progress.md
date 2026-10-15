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

## In progress

- Nothing from the RankMiso migration is left open. The next product work is the carried-forward list below.

## Not started

- Opt-in broken links, header capture, robots.txt, and sitemaps
- Reciprocal hreflang
- Rich-result rule validation
- SERP tools and multi-URL comparison
- PageSpeed Insights
- Playwright browser-install suite
- Performance benchmarks
- Safari signing
- Store listing assets beyond the generated icons

## Test results from this session

- `cargo fmt --all -- --check`: passed
- `cargo clippy --workspace --all-targets -- -D warnings`: passed
- `cargo test --workspace`: 18 passed (15 rule tests, 3 scoring tests)
- `pnpm install --frozen-lockfile`: passed after the package rename
- `@rankmiso/report-formats` vitest: 4 passed
- `@rankmiso/extension` vitest: 14 passed
- `vue-tsc --noEmit`: passed
- Prettier check and ESLint: passed
- `wxt build` Chrome MV3: passed. Manifest name is RankMiso. Local WASM asset is included.
- `wxt build -b firefox --mv3`: passed. Gecko id is `rankmiso@local.dev`. Local WASM asset is included.

These builds were not loaded in Chrome or Firefox after the rename. The earlier Firefox review was of the previous SEO Toolkit package.

## Blockers

- `wasm-bindgen-cli` must stay on 0.2.100. A newer CLI will not match the pinned crate.
