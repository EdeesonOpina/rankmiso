# Implementation plan

## Phase 0 — Research

Status: documented in this repository.

- Competitor notes: `docs/research/competitor-feature-matrix.md`
- Browser limits: `docs/browser-support/compatibility.md`
- Risks and decisions: `docs/development/decisions.md`

## Phase 1 — Foundation

Status: in place for the vertical slice.

- pnpm workspace and Cargo workspace
- WXT extension with Vue 3, TypeScript, and Tailwind tokens
- Rust crates `seo-core`, `seo-rules`, `seo-scoring`, and `seo-wasm`
- Theme preference in extension storage
- GitHub Actions workflow for format, Clippy, tests, and browser builds

## Phase 2 — Core inspection

Status: first working path is implemented.

Page tool extracts a snapshot, Rust returns an audit, and the popup plus dashboard render it. Export writes JSON, CSV, and HTML.

Still incomplete inside this phase:

- Playwright extension installation is not automated
- Large-page timing has not been benchmarked

Dashboard field labels now go through `src/locales/en.ts`. The product identity is RankMiso. See `docs/branding/overview.md`.

## Phase 3 — Advanced inspection

Not started, except JSON-LD syntax and the social fields already shown.

Next: optional header and redirect capture, hreflang fetch with explicit consent, and a clearer raw-versus-rendered comparison.

## Phase 4 — Research tools

Not started. SERP reading, URL comparison, and selector helpers need their own adapters and tests. Do not add proprietary metric substitutes.

## Phase 5 — Performance and hardening

The report shows the resource count for the current page load. Largest Contentful Paint, Cumulative Layout Shift, and Interaction to Next Paint stay Unavailable. PageSpeed Insights is not integrated. Security review beyond the current export and permission choices is still open.

## Phase 6 — Public release

Firefox listing text is drafted in `docs/releases/firefox.md`. The add-on has not been uploaded. A public privacy URL is still required. Signed Safari packaging and a stable tag are not started.

## Acceptance for the current slice

- `cargo test --workspace` passes
- Extension unit tests pass
- `vue-tsc` passes
- Chrome MV3 and Firefox MV3 builds emit a local `.wasm` asset
- The report distinguishes measured issues from checks that did not run
