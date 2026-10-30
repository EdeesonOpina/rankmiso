# Implementation plan

## F1-E status note — 2026-10-30

F1 continues from the preceding checkpoint; it is not restarted. The P1 stale-sidebar defect is fixed and automated tests pass. The repeatable local performance baseline remains in `docs/testing/performance-baseline.md`; outstanding native interactions are listed in `docs/testing/manual-checklist.md`. F1-H.1 adds opt-in Automatic website checks and fresh local Smart Refresh; implementation and automated verification pass, while native Chrome/Firefox permission prompts remain pending. F1 technical sign-off remains blocked on the native security and remaining browser acceptance cases. Do not begin M6 until F1 closes and the maintainer authorizes it. v0.3.0 is already published; no versioning or release state changed.

## F1-F status note — 2026-10-30

F1-E sidebar A/B switching is now manually reported by the product owner in Chrome and Firefox with the existing initial inspection authorization requirement. A P1 abort race was fixed and covered in Vitest; the current automated suite and both builds pass. Native optional-permission denial/revocation, request-log-backed crawl Stop/closure, and remaining Chrome/Firefox runtime checks are still open. F1 remains blocked; M6 is not authorized. No permission, dependency, version, or release metadata changed.

## v0.3.0 — published baseline; post-release hardening

Version 0.3.0 collects M1–M5 and the approved UX-9R popup, sidebar, and full-report interface. The maintainer confirms it is published. The current checkout is `chore/rustfmt` at `65753ffe`; release-preparation commit `0959792` is an ancestor, but no release tag or byte-for-byte published artifact is present here. Do not increment versions or prepare another store submission without maintainer approval. F1 is post-release reliability work; the ruleset version stays 1.0.0 unless a confirmed scoring defect and maintainer approval justify a change.

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
- Chrome MV3 and Firefox MV3 package versions are 0.3.0
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

Implemented in the original M3 release for Chromium; Firefox parity was added in F1-I. In both browsers a crawl starts only from the report, stays on the exact origin, can be stopped, and marks a page cap as partial. Fetched HTML is source text scored by the existing page engine. It is not the rendered snapshot. The crawl does not run in the background. See `docs/features/site-explorer.md` and the F1-I checkpoint below.

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

### F1-G — Firefox permissions, history branding, and sidebar navigation

Implemented as a post-release maintenance correction without changing v0.3.0 metadata. Firefox uses toolbar-action `activeTab` authorization; a sidebar cannot request optional `tabs` permission. The History empty state uses the configured head-only brand icon. A report launched from the sidebar opens the Site destination and closes only that window's RankMiso side panel where supported; failure to close does not block the report. Native Chrome and Firefox interaction checks remain separate from unit/build evidence.

### F1-H — Unified cross-browser website permissions

Implementation and automated verification are complete as a post-release maintenance correction. Firefox and Chromium builds declare HTTP/HTTPS site access as optional host eligibility only; runtime permission requests are scoped to the selected scheme and hostname. Firefox's sidebar asks only after the user activates **Allow this website**, then revalidates permission and active-tab identity before local extraction. Denial and revocation clear current/cached authorization state. Firefox network-dependent features remain disabled independently of site grants. Native Firefox grant, denial, and revocation checks remain pending for runtime sign-off. Privacy-policy publication and store release are separate maintainer-authorized tasks; do not change v0.3.0 metadata or begin M6.

### F1-H.1 — Unified website access and Smart Refresh

Implementation and automated verification are complete; native browser permission-dialog verification remains pending. Automatic checks are opt-in and request optional broad HTTP/HTTPS access directly from the user's action. Individual website access remains supported and broad grants do not authorize Individual mode. The visible sidebar inspects only the active page in its owning window. Manual Refresh bypasses cache and reruns extraction and the existing Rust/WASM engine without reloading the website. Permission denial/revocation, request revisions, bounded cache invalidation, and Firefox's network-feature restrictions are preserved. No required host permission, API permission, dependency, version, or release artifact changed. Before release, obtain native Chrome and Firefox approval/denial/revocation evidence and coordinate privacy-policy/store disclosures. M6 remains unauthorized.

### M6 — MCP

A local read-only companion over an audit the user chose to share. Write the threat model before any browser bridge. Do not expose arbitrary tabs, API keys, unrestricted URLs, or saved history. No hosted MCP service.

### M7 — Search Console

Optional OAuth for a verified owner, using real API data. The extension must still work with no account.
## F1-I — Firefox Site Explorer parity (2026-10-30)

The Firefox Site Explorer guard was in the report view and the shared sitemap collector separately suppressed all Firefox network access. The report now enables only the existing shared crawler, and `networkPurpose: "site-crawl"` opts the crawl into the existing robots/sitemap parser without enabling standalone Sitemap Explorer or other Firefox remote checks. Site crawling requests the selected origin from the Start gesture, verifies the grant, and rechecks permission before each request. Existing limits, manual redirect handling, same-origin scope, cancellation, and Rust/WASM evaluation remain shared. Automated checks/builds pass; native Firefox crawl and Chrome runtime regression remain pending and F1-I is not release-ready until those are recorded.
## R0.4.0 release candidate (2026-10-30)

Consolidate completed F1 corrections, Automatic Checks/Individual Website Access, Smart Refresh, and Firefox Site Explorer in v0.4.0. Version updates are limited to the root and extension package metadata; Rust crate versions remain independent. Product owner has confirmed basic Firefox Site Explorer runtime. Store acceptance remains pending on native Chrome regression and Firefox denial/revocation, robots/request logs, redirects, limits, cancellation, privacy-policy alignment, and the documented hostname/DNS-rebinding limitation. Do not submit or publish from this checkpoint.
# R0.4.0 release preparation status (2026-10-30)

Implementation is frozen for candidate preparation. Chrome/Firefox production packages and a complete Firefox source archive have been built from an isolated snapshot, with source reproduction matching the Firefox extension files byte-for-byte. Automated regression is green (40 Rust tests, 118 Vitest passed / 2 opt-in skipped, 10 Playwright passed; lint, typecheck, and both builds pass). Do not start further feature work under this plan. Native installed Chrome, native permission and crawler security checks, DNS-rebinding boundary review, and public Privacy Policy v6 alignment are submission gates. The product-owner Firefox confirmation applies only to basic crawling.

## R0.4.0-G1 (2026-10-30)

Targeted fixes only: shared robots timeout/redirect limits, total crawl deadline, no retry after cancellation, and stronger literal IPv6/private-address classification. Rebuild artifacts from the corrected isolated source, rerun source reproduction and checksums. Native browser security scenarios and DNS connection enforcement remain unresolved; do not submit or begin MCP.
