# Progress

Updated: 2026-10-24

Release target: v0.2.0. Branch `release/v0.2.0` is being prepared; Chrome and Firefox store packages for this version have not been submitted.

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
- The project directory was renamed from seo-toolkit
- Central brand config, temporary Miso palette, geometric placeholder mark, and `pnpm brand:icons`
- Dashboard labels moved into `src/locales/en.ts`
- Optional site check for headers, robots.txt, the first listed sitemap, redirect hops, hreflang return links, and a continuable sample of 20 public links
- Local JSON-LD field list, an explicit PageSpeed Insights unavailable check, Firefox id `rankmiso@rankmiso.extension`, and a sidebar button for both `sidePanel` and `sidebarAction`
- Chrome unpacked extension used by the maintainer on a live page, including the side panel
- Firefox listing text and upload steps in `docs/releases/firefox.md`
- Chrome Web Store and Firefox add-on releases are now available
- Local comparison summaries with explicit save/delete actions and a 20-report cap
- Editable desktop/mobile search snippet preview using local draft title and description values
- Optional mobile PageSpeed Insights request with a user-provided API key and separate lab results
- Browser-observed LCP/CLS and a session INP estimate when the browser exposes entries
- Playwright Chromium popup smoke test and Firefox package-integrity check
- Rust rule-engine benchmark for small, medium, and large snapshots
- Refined report spacing, responsive controls, empty states, and action styling across the dashboard and popup
- Page-scoped INP capture with explicit start/stop controls; capture persists while the popup is closed and is read into the next report refresh
- Google Rich Results Test is presented as a prominent external validation action; RankMiso does not claim eligibility itself
- Firefox builds disable PageSpeed Insights and optional site requests, omit optional host permissions, and retain the no-data-collection manifest declaration; Chromium keeps the explicit opt-in requests

## In progress

- Firefox runtime-install and Edge install automation; Firefox package metadata and assets are checked automatically

## Not started

- Official rich-result eligibility. RankMiso links to Google's test; its local schema view is not an eligibility verdict
- Search-location simulation and robust SERP data extraction
- Comparative benchmark history across machines and releases; current Rust results are a local baseline only
- MCP server or browser bridge. Phase 7 in `implementation-plan.md` documents a read-only local MCP direction and the architecture/security decisions required first

## v0.2.0 preparation verification (2026-10-24)

- `pnpm build:wasm`: passed with the pinned `wasm-bindgen` toolchain.
- `cargo test --workspace`: passed (30 tests); `cargo clippy --workspace --all-targets -- -D warnings` and `cargo fmt --all -- --check`: passed.
- Extension Vitest: passed (31 tests); typecheck, ESLint, and Prettier: passed.
- Playwright: passed (built Chromium popup and Firefox package-integrity checks, 2 tests).
- Chrome MV3 and Firefox MV3 production builds: passed and include the local WASM asset. Both manifests report version 0.2.0.
- The Rust benchmark baseline below is a previously recorded local result, not rerun as part of this release verification: 0.22 ms small, 2.09 ms medium, and 5.58 ms large per audit.

The Chrome and Firefox 0.1.x store releases remain available. The v0.2.0 packages are prepared for review and have not been submitted. Firefox runtime behavior still requires the manual checklist.

## Blockers

- `wasm-bindgen-cli` must stay on 0.2.100. A newer CLI will not match the pinned crate.
- v0.2.0 store submissions and publication are pending; this branch is for build and review preparation.
