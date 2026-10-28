# Implementation plan

## v0.2.0 — release preparation

The current release branch consolidates the completed report improvements, saved comparisons, editable snippet drafts, Chromium-only optional PageSpeed Insights lab results and technical probes, browser performance observations, and explicit page-scoped INP capture. Firefox builds omit those external requests and retain the no-data-collection declaration. Version 0.2.0 is being prepared for Chrome and Firefox builds; store submission and publication remain separate release actions.

## Phase 0 — Research

Status: documented in this repository.

- Competitor notes: `docs/research/competitor-feature-matrix.md`
- Browser limits: `docs/browser-support/compatibility.md`
- Risks and decisions: `docs/development/decisions.md`

## Phase 1 — Foundation

Status: in place for the vertical slice.

- pnpm workspace and Cargo workspace
- WXT extension with Vue 3, TypeScript, and plain CSS per surface (`popup.css`, `workbench.css`)
- Rust crates `seo-core`, `seo-rules`, `seo-scoring`, and `seo-wasm`
- Theme preference in extension storage
- GitHub Actions workflow for format, Clippy, tests, and browser builds

## Phase 2 — Core inspection

Status: first working path is implemented.

Page tool extracts a snapshot, Rust returns an audit, and the popup plus dashboard render it. Export writes JSON, CSV, and HTML.

Still incomplete inside this phase:

- Firefox and Edge extension installation automation
- Browser-based performance benchmarking

Dashboard field labels now go through `src/locales/en.ts`. The product identity is RankMiso. See `docs/branding/overview.md`.

## Phase 3 — Advanced inspection

Implemented in part: JSON-LD syntax and a local field list, social metadata, and Chromium-only opt-in technical probes for headers, redirects, robots.txt, the first listed sitemap, hreflang return links, and public link responses.

Still unbuilt: official rich-result eligibility and a full crawl. Microdata, a bounded RDFa subset, and a fetched-HTML comparison are implemented; see `docs/features/advanced-technical.md`. Google Rich Results Test remains an external, user-initiated validation tool.

## Phase 4 — Research tools

Partially implemented. Reports save local comparison summaries, and the metadata section has an editable approximate desktop/mobile snippet preview. SERP location simulation, result-page extraction, and selector helpers remain unbuilt. Do not add proprietary metric substitutes.

## Phase 5 — Performance and hardening

Implemented in part: browser-observed LCP/CLS and an INP estimate where Event Timing data is exposed. Users can explicitly start page-scoped INP capture; capture runs in the inspected page while the popup is closed and ends when the page reloads or closes. Chromium-only mobile PageSpeed Insights results require a user-provided API key and explicit Google access; they remain outside the local audit score. Firefox omits PageSpeed Insights and external technical probes.

Still unbuilt: broader cross-browser interaction measurement validation, automated runtime installation in Firefox and Edge, and a dedicated security review beyond the current export and permission choices.

## Phase 6 — Public release

Chrome Web Store and Firefox Add-ons releases are available. See `docs/releases` for listing and package maintenance notes.

## Phase 7 — MCP integration (planned; not implemented)

Goal: let a user-approved MCP client read RankMiso's real audit results without adding a hosted service, account, telemetry, or a second implementation of SEO rules.

The transport and browser bridge are undecided. Investigate a local stdio MCP companion and the least-privilege way to receive an explicitly requested audit from the extension. Do not assume an MCP process can inspect a browser tab or page DOM by itself. Keep page extraction and browser permissions in TypeScript; keep SEO rules and scoring in Rust. Do not add default host permissions or let an MCP request silently start a site probe, navigate a tab, or transmit page data remotely.

Proposed first read-only surface, subject to the architecture spike:

- `rankmiso.get_current_audit`: return the latest audit the user explicitly generated in the browser, with measured, unavailable, and not-applicable states preserved.
- `rankmiso.get_page_summary`: return a bounded summary of URL, score disclaimer, key metadata, findings, and measurement limitations.
- An optional resource for the stable audit schema and check definitions, versioned with the engine.

Do not expose arbitrary page text, saved report history, API keys, or unrestricted URLs in the first version. If fetching a fresh audit needs browser access, require an explicit browser action and origin permission before making the result available to MCP. MCP must not invent rankings, traffic, backlinks, search volume, index status, field data, or rich-result eligibility.

Acceptance before implementation:

- Choose and document the local transport, browser-to-MCP handoff, supported MCP clients, and disconnect/revocation behavior.
- Define typed tool inputs/outputs from schema-version-1 audit contracts and return actionable errors for no active audit, stale page, unsupported browser, and denied permission.
- Add tests for redaction, size limits, unavailable-check preservation, malformed messages, and origin/permission boundaries.
- Verify no page content leaves the machine unless the user separately configures the MCP client or another external service to receive it.
- Keep the core extension fully usable with MCP absent or disabled.

Initial spike deliverable: a threat model and a small transport prototype over fixture audits. Do not ship a browser bridge until its permission and trust boundaries are reviewed.

## Acceptance for the current slice

- `cargo test --workspace` passes
- Extension unit tests pass
- `vue-tsc` passes
- Chrome MV3 and Firefox MV3 builds emit a local `.wasm` asset
- The report distinguishes measured issues from checks that did not run
- Chrome MV3 and Firefox MV3 package versions are 0.2.0
- Firefox MV3 declares no optional host permissions and cannot invoke PageSpeed Insights or optional site probes; Chromium retains those explicit opt-in features
- INP capture is explicit, remains page-scoped, and has start, running, unsupported, stop, and no-interactions states
- MCP remains documented as planned and is not represented as an available feature

## Later milestones (not started)

These are constraints for later work. They are not part of the current UI milestone.

### M2 — Sitemap explorer

Implemented. Chromium discovery is user-started and origin-scoped. Firefox imports a local XML file and does not request sitemaps. Parsing is bounded: 8 files, 500 URL entries, 512 KB each. A nested sitemap index is reported and not followed. Sitemap inclusion is not indexing. Details are in `docs/features/sitemaps.md`.

### Capability gaps recorded at UX-2

Compared with public SEOquake, MozBar, Ahrefs SEO Toolbar, and Detailed SEO Extension behavior. The matrix is `docs/features/competitive.md`. These gaps are not part of UX-2.

- Site crawling is M3 and is implemented as a bounded same-origin crawl. Sitemap discovery by itself is still not a crawl of every listed URL.
- Trend charts are M4 and use explicit page saves. A site crawl is not turned into that history.
- Fetched HTML comparison, Microdata, and bounded RDFa are implemented in M5. They are not a complete document diff or a complete RDFa processor.
- MCP stays M6 and is not built.
- SERP overlays, keyword metrics, backlinks, Domain Authority, Page Authority, Domain Rating, and URL Rating are out of scope. RankMiso does not invent them.
- People Also Ask and a user-agent switch are out of scope.
- Keyword n-gram density is not implemented. Repeated-term counts remain the content view.

### M3 — Site explorer

Implemented. A crawl starts only from the report, stays on the exact origin, can be stopped, and marks a page cap as partial. Fetched HTML is source text scored by the existing page engine. It is not the rendered snapshot. The crawl does not run in the background. Firefox does not crawl. See `docs/features/site-explorer.md`.

### M4 — Historical analytics

Implemented. New saves add a versioned summary beside the existing fields. Older saves stay readable. The History screen charts saved scores for one page and compares two saves. Missing values stay “Not recorded”. A site crawl is not added. See `docs/features/history.md`.

### M5 — Advanced technical SEO

Implemented. Technical compares a separately fetched response, or a chosen HTML file, with the rendered snapshot. Schema adds bounded Microdata and RDFa beside JSON-LD. New observations stay informational. See `docs/features/advanced-technical.md`. Do not claim official rich-result eligibility.

### UX-7 — Official brand alignment

Recorded. The fox icon came from the website. The cream canvas from that pass is no longer the RankMiso interface. See UX-8.

### UX-8 — White workbench

RankMiso uses a white application canvas, neutral cards, and the platform UI font. The website remains the logo and mascot reference. Do not restore the cream canvas unless the maintainer asks. Details are in `docs/branding/design-tokens.md`.

### UX-9 — Purpose-built presentation

Recorded. A layout change has to change how a screen presents its data. From 1100px the report overview, history charts, and a selected crawl page use two columns. Narrow reports stack. The sitemap URL table stays full width. Details are in the UX-9 completion checkpoint. Do not start M6 unless the maintainer asks.

### UX-9R.2 — Popup inspectors

Recorded. The popup rail and Overview stay. The other 17 destinations use the approved HTML compositions with live audit data. Site and Sitemaps in the popup open the report; they do not run the crawl or discover files. The next visual pass is the sidebar and the full report, and it has not started.

### UX-9R.3 / UX-9R.4 — Sidebar and full report

Recorded. The sidebar and report follow the approved HTML prototypes through one workbench shell. Visual sign-off is pending. Do not start M6 unless the maintainer asks.

### M6 — MCP

A local read-only companion over an audit the user chose to share. Write the threat model before any browser bridge. Do not expose arbitrary tabs, API keys, unrestricted URLs, or saved history. No hosted MCP service.

### M7 — Search Console

Optional OAuth for a verified owner, using real API data. The extension must still work with no account.
