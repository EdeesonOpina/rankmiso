# Handoff

Date: 2026-10-30

## F1-F current handoff

F1-F preserves the F1-E automatic sidebar behavior and the four earlier F1 fixes. The maintainer manually reports Chrome and Firefox A/B switching after each tab's initial explicit inspection authorization; do not expand that evidence to SPA navigation, multiple windows, restricted pages, or revocation.

This checkpoint fixed the crawler cancellation race described in `progress.md`. Current automated verification passed: Rust fmt/workspace tests/Clippy; Vue/TypeScript; Vitest 94 passed with two opt-in performance cases skipped; ESLint/Prettier; both production builds; and Playwright 9/9 with loopback/Chromium outside the sandbox. The authorized local Site Explorer browser test verifies that its delayed response closes after Stop and report closure. A sandbox-only Playwright attempt failed to bind 127.0.0.1 and launch Chromium; it was rerun successfully after approval.

**F1 remains BLOCKED.** No native permission-denial/revocation result or request-log record has been supplied. Remaining Firefox HTML comparison, JSON/CSV/HTML downloads/cancel, history reload, and installed Chrome popup/report/settings acceptance are also not verified in this checkpoint. Continue from the [F1-D native browser handoff](../testing/f1-d-manual-handoff.md); the profile, fixture, expected outcomes, and evidence checklist remain valid. Record actual outcomes before changing these rows to runtime PASS.

Release review: current checkout remains `chore/rustfmt` at `65753ffe77d5e8dfac079369d44389ab5de04b94`; version remains 0.3.0. Candidate maintenance scope is the F1 source fixes and their tests/docs. Exclude existing UX review screenshots and marketing edits unless the maintainer independently approves them. No tag is available locally, and no release package was published or changed.

## Repository

The project is this repository.

The directory was renamed from `seo-toolkit`. The old directory no longer exists. The git remote is `https://github.com/EdeesonOpina/rankmiso.git` and is private. Current branch is `chore/rustfmt`, HEAD `65753ffe77d5e8dfac079369d44389ab5de04b94`. The user confirms v0.3.0 is published. Commit `0959792` is an ancestor of this checkout; no release tag is present locally, so published artifact equivalence is not established. Do not commit, push, change visibility, bump versions, or submit store packages unless the maintainer asks.

## Product identity

RankMiso, in the Miso ecosystem. Tagline: “Every page. Every detail.”

`apps/extension/src/config/brand.config.ts` is the only brand source. The manifest name, description, and Firefox id `rankmiso@rankmiso.extension` come from it. `packages/design-tokens/src/tokens.css` holds `--miso-color-*` and `--miso-font-*`. Existing Tailwind names alias those tokens.

The toolbar icon and header mark are the supplied fox sticker, saved as a transparent 8-bit PNG. `pnpm icons` would replace it with the geometric M. Replacement steps are in `docs/branding/asset-replacement.md`.

Workspace packages are `rankmiso`, `@rankmiso/extension`, `@rankmiso/design-tokens`, and `@rankmiso/report-formats`.

These names stay technical:

- Rust crates `seo-core`, `seo-rules`, `seo-scoring`, `seo-wasm`
- `ENGINE_NAME` = `seo-toolkit` in audit JSON
- Theme storage key `seoToolkit.theme`
- Page markers `data-seo-toolkit-mark`, `seo-toolkit-highlight`, and `data-seo-toolkit-generation`

## Environment

- Rust 1.99.0 through rustup. Source `$HOME/.cargo/env` before Cargo commands.
- `wasm32-unknown-unknown` and `wasm-bindgen` 0.2.100.
- Node 24 and pnpm 10.27.0.
- ImageMagick `convert` and `identify` are required for `pnpm brand:icons`.
- `esbuild` is listed under `pnpm.onlyBuiltDependencies`.

## What still works

The approved UX-9R interface provides 18 destinations: Overview, Issues, Metadata, Content, Headings, Links, Images, Schema, Social, Technical, Performance, International, Accessibility, Site, Sitemaps, History, Export, and Settings. The popup uses a vertical rail; the sidebar and full report use their approved workbench navigation. Product behavior and unverified features are summarized in `docs/testing/functional-matrix.md`.

## F1 current verification (2026-10-30)

- Four confirmed fixes are preserved: HTTP(S)-only external highlighting, owned-only marker cleanup, measured-rule-ID history comparability, and the dedicated `data-rankmiso-highlight` marker for pages that already own the legacy marker.
- Rust format, 40 Rust tests, Clippy, Vitest (82 passed; two explicit performance benchmarks skipped by default), TypeScript/Vue, ESLint, Prettier, both production builds, and all eight Playwright source tests pass. Scored fixture ran five times; performance values are in `docs/testing/performance-baseline.md`.
- Chrome v0.3.0 production unpacked build was loaded in actual Chrome 156.0.8078.47 via `Extensions.loadUnpacked`; its ID, enabled state and worker target were visible in the manager. The CDP action method could not use the available page target. Do not repeat that unsupported trigger. Native popup/surface/permission steps are in `docs/testing/f1-d-manual-handoff.md`.
- Firefox 158.0.1 temporary add-on evidence covers a scored report, all 18 destinations, local XML import and persisted theme. Sidebar, local HTML comparison, exports and saved-history reload remain manual. This does not establish signed installation or upgrade behavior.
- Native permission denial/revocation, request-log-backed cancellation, redirect boundaries, active-tab switching, and browser settings flows remain unverified. Edge is unavailable. F1 remains blocked; do not begin M6.

## Verified on 2026-10-15 after the move (historical)

- Rust format, Clippy, and 26 tests passed (23 rules, 3 scoring).
- Extension tests: 17 passed. `vue-tsc` and ESLint passed.
- Firefox MV3 production build passed and includes the local WASM file. Gecko id is `rankmiso@rankmiso.extension`.
- Chrome was not rebuilt in this pass.

## Release status

RankMiso v0.3.0 is published, as confirmed by the maintainer. This F1 work is post-release hardening. The verification notes above describe earlier builds and are historical; use the current F1 matrix for current evidence. Do not prepare a new store submission without maintainer approval.

## Remaining F1 work

Use the matrix for detailed status. The remaining browser interactions and how to collect evidence are listed in `docs/testing/f1-d-manual-handoff.md`. Do not represent a blocked or untested action as passing.

Reload the extension after rebuilding. Firefox temporary add-ons disappear when Firefox quits. Load `apps/extension/.output/firefox-mv3/manifest.json` from `about:debugging`.

## Next action

Continue F1 verification and close reproducible P0/P1 gaps before deciding sign-off. The published v0.3.0 baseline remains unchanged. M6 is a later planned milestone; do not begin it during F1.

## Checkpoint M1-1

Date: 2026-10-27

Milestone: M0 baseline, then M1 UI workbench.

Completed: popup navigation is Overview, Issues, and Inspect. The report navigation is Overview, Issues, On-page, Technical, History, and Export. Category bars use the existing score and leave an unmeasured category unlabeled as a number. Issue cards show Rust title, status, description, evidence, and recommendation, plus a guide for supported rule ids. Examples are marked as generic. Deep links still use the old section ids. Saved reports and exports were not given a new format.

Architecture: no scoring change, no new dependency, no new permission. Finding copy lives in `apps/extension/src/locales/findings.en.ts`. Rust remains the rules engine.

Verification in this session: extension Vitest 41 passed, vue-tsc passed, Chrome MV3 build passed, Playwright Chromium popup and dashboard shell passed. Cargo was not rerun because Rust did not change. Firefox was not rebuilt. A normal web page was not audited in the browser.

Known limits: the issues list is not virtualized. Popup filter chips are 36px tall. The browser screenshots show the extension shell on a page the extension cannot read. Site, crawl, history trends, MCP, and Search Console are not built.

Next action at the time: open RankMiso on a normal web page and confirm the score, category bars, issue guides, and exports. That pass is checkpoint M1-2.

## Checkpoint M1-2

Date: 2026-10-27

Milestone: M1 final verification.

Status: accepted for Chromium. Firefox runtime was not loaded, so that part is not marked passed.

The scored check uses `apps/extension/browser-tests/audit.spec.ts` and the HTML fixtures beside it. Headless Chromium 156.0.8078.47 produced a real audit: healthy popup score 91, issues dashboard score 82, Performance left “Not measured”, and a structured-data 0 only where the JSON-LD syntax error is a scored check. Exports, the headings deep link, theme, reduced motion, and a saved comparison that survives reload were checked. Details and screenshot names are in `docs/development/progress.md`.

Fixes: select labels no longer swallow every option; On-page tabs wrap instead of clipping; saved comparisons are stored as plain JSON because `chrome.storage` was turning a reactive empty array into `{}`.

Chrome package remains 1.15 MB. WASM is unchanged at 830.75 KB. Popup chunk 20.61 KB. Report chunk 58.87 KB. Firefox build passed at 1.14 MB with the same permission model: no host permission, no PageSpeed, no site probe, and `data_collection_permissions.required` of `none`.

Next action: M2 — Advanced Sitemap Explorer, only when the maintainer asks.

## Checkpoint M2

Date: 2026-10-27

Milestone: M2 Sitemap Explorer.

Status: accepted for Chromium. Firefox package boundaries passed. Firefox was not loaded as a temporary add-on, so that runtime is not marked passed.

The report section is Sitemaps. Chromium discovery reads robots.txt directives, `/sitemap.xml`, and `/sitemap_index.xml` after an origin permission. Another host is shown and not requested. A nested index is a finding and is not followed. Rust owns the findings. The browser extracts XML and rejects a DOCTYPE. Local import and confirmed CSV export are in the same section. Budgets are 8 files, 500 URLs, and 512 KB. Details, sizes, and test counts are in `docs/development/progress.md` and `docs/features/sitemaps.md`.

Settings reads the manifest version.

Next action: M3 — Site Explorer, only when the maintainer asks.

## Checkpoint UX-1

Date: 2026-10-27

Milestone: UX-1 premium workbench refinement.

Status: accepted for Chromium. Firefox was not loaded as a temporary add-on.

The popup opens on the score, categories under 100, and up to three real findings. The full category list is a disclosure. Open full report is the only primary button. The wide report uses one left navigation list. The narrow report and the sidebar use one Current view select. Deep links such as `?section=headings` and `?section=sitemaps` still work. Issue descriptions stay visible. Evidence and examples open from the finding. Scoring and sitemap rules were not changed.

Verification used the existing scored fixtures in headless Chromium 156.0.8078.47 at 320, 360, 420, 768, and 1280. Screenshots are written under `apps/extension/test-results/` when the browser tests run. Popup init was 176 ms and the report 181 ms on the last run. Chrome package 1.24 MB. Popup chunk 21.68 KB. Report chunk 78.67 KB. WASM unchanged at 888.28 KB. Firefox package 1.22 MB.

Next action: M3 — Site Explorer, only when the maintainer asks. UX-2 later replaced this navigation. The checkpoint text below is the UX-1 record and is kept.

## Checkpoint UX-2

Date: 2026-10-27

Milestone: UX-2 premium SEO workbench.

Status: technical checks passed for Chromium. Visual design sign-off is pending product-owner approval. Firefox was not loaded as a temporary add-on.

The product owner rejected UX-1 after its technical checkpoint. The Current view select hid Metadata through Social, the popup overview was thin, and tab labels had wrapped in the earlier Inspect row. UX-2 makes those sections direct destinations. The wide report uses one left list. The popup, sidebar, and narrow report use one non-wrapping tab strip with scroll buttons. Deep links such as `?section=headings` and `?section=sitemaps` still work. Scoring and sitemap rules were not changed.

Verification used the scored fixtures in headless Chromium 156.0.8078.47 at 320, 350, 360×640, 420×650, 420×720, 768×1024, and 1280×800. Screenshots under `apps/extension/test-results/` were inspected, including popup Overview, Issues, Metadata, Headings, Images, and Social, sidebar Overview, Metadata, Headings, and a scrolled Social tab, plus the report Overview, Issues, Sitemaps, light, and dark views. The second popup finding was inside the 650px viewport. At 420×650 the overview shows the page title, the tab strip, score 91, the status meter, and at least two findings. Unavailable categories still say Not measured.

Last comparable timings on this machine: popup 186 ms, report 182 ms. Chrome package 1.24 MB. Popup chunk 20.79 KB. Report chunk 76.92 KB. WASM 888.28 KB. Firefox package 1.22 MB. No new dependency. The competitive matrix is `docs/features/competitive.md`.

Next action: M3 — Site Explorer, only when the maintainer asks. Do not start it. UX-3 later changed the presentation. The checkpoint text below is the UX-2 record and is kept.

## Checkpoint UX-3

Date: 2026-10-27

Milestone: UX-3 premium visual refinement.

Status: technical checks passed for Chromium. Visual design sign-off is pending product-owner approval. Firefox was not loaded as a temporary add-on.

The product owner rejected the UX-2 visuals after that checkpoint. The flat destination list stays. UX-3 adds 16px gutters and white light-theme cards, restores an 80px SVG score ring, and replaces the tab arrows with mouse drag plus native touch and trackpad scrolling. Arrow, Home, and End keys still move the selection. Scoring and sitemap rules were not changed.

Verification used the scored fixtures in headless Chromium 156.0.8078.47. Screenshots under `apps/extension/test-results/` were inspected, including popup Overview at 420×650 and 420×720, Issues, Metadata, a dragged tab strip, and the strip scrolled to the end, plus sidebar Overview and Metadata at 350px, the report Overview, Issues, and Sitemaps, and light and dark views. A mouse drag scrolled the strip and left Overview selected. A later click selected Social. The second popup finding stayed inside the 650px viewport.

Last comparable timings on this machine: popup 189 ms, report 174 ms. An earlier sample on the same build was 228 ms and 185 ms. Chrome package 1.24 MB. Popup chunk 21.02 KB. Report chunk 77.10 KB. WASM 888.28 KB. Firefox package 1.22 MB. No new dependency.

Next action: M3 — Site Explorer, only when the maintainer asks. Do not start it. UX-4 later removed the white cards. The checkpoint text below is the UX-3 record and is kept.

## Checkpoint UX-4

Date: 2026-10-27

Milestone: UX-4 professional SEO inspector overhaul.

Status: technical checks passed for Chromium. Visual design sign-off is pending product-owner approval. Firefox was not loaded as a temporary add-on.

The product owner rejected the UX-3 white cards. The ring, gutters, flat destinations, and drag-to-scroll tabs stay. Inspectors use separators and purpose-built layouts. Headings are an outline. Links are stacked rows under 640px of content width and a wrapping table above that. Scoring and sitemap rules were not changed.

Verification used the scored fixtures in headless Chromium 156.0.8078.47 at 320, 350, 360×640, 420×650, 420×720, 768×1024, and 1280×800. Screenshots under `apps/extension/test-results/` were inspected for popup Overview, Headings, Links, Metadata, Images, Schema, and Social, sidebar Headings, Links, and Metadata, and the report Headings, Links, Overview, and Sitemaps, in light and dark. A mouse drag still scrolls the strip and leaves Overview selected.

Last comparable timings on this machine: popup 181 ms, report 186 ms. UX-3 samples were 189 ms and 174 ms. Chrome package 1.24 MB. Popup chunk 17.94 KB. Report chunk 77.11 KB. WASM 888.28 KB. Firefox package 1.22 MB. No new dependency.

Next action: M3 — Site Explorer, only when the maintainer asks. Do not start it. UX-5 later added the ivory card treatment. The checkpoint text below is the UX-4 record and is kept.

## Checkpoint UX-5

Date: 2026-10-27

Milestone: UX-5 premium card and social preview experience.

Status: technical checks passed for Chromium. Visual design sign-off is pending product-owner approval. Firefox was not loaded as a temporary add-on.

The product owner found UX-4 too plain and pointed at the Save and compare card. UX-5 uses that card for meaningful groups. Open Graph and X previews are inner platform frames. The tab strip keeps drag and keyboard access and adds a scroll meter, edge fades, and a dismissible hint. Scoring and sitemap rules were not changed.

Verification used the scored fixtures in headless Chromium 156.0.8078.47 at 320, 350, 360×640, 420×650, 420×720, 768×1024, and 1280×800. Screenshots under `apps/extension/test-results/` were inspected for popup Overview, Issues, Headings, Links, Social, a large-image fixture, the tab strip in the middle and at the end, light and dark, sidebar Overview and Social, and the report Overview, Social, and Sitemaps.

Last comparable timings on this machine: popup 189 ms, report 190 ms. An earlier sample on this build was 195 ms and 196 ms. UX-4 samples were 181–186 ms and 186–207 ms. Chrome package 1.25 MB. Popup chunk 13.25 KB. Report chunk 77.24 KB. WASM 888.28 KB. Firefox package 1.23 MB. No new dependency.

Next action at the time: UX-6 inspector interaction. That checkpoint follows.

## Checkpoint UX-6

Date: 2026-10-28

Milestone: UX-6 inspector interaction refinement.

Status: technical checks passed for Chromium. Visual design sign-off is pending product-owner approval. Firefox was not loaded as a temporary add-on.

UX-5 remains the visual foundation. Schema gained a structured property tree and a raw JSON view. Links open as Internal, External, and Other groups instead of filter chips. Social spacing separates the preview, Full values, and the notes. Scoring, permissions, and the navigation list were not changed.

Verification used the scored fixtures in headless Chromium 156.0.8078.47 at 320, 350, 360×640, 420×650, 420×720, 768×1024, and 1280×800. Screenshots under `apps/extension/test-results/` were inspected for the JSON tree, raw JSON, invalid JSON, link groups, an expanded link, an empty search, and social cards in light and dark.

Last comparable timings on this machine: popup 188 ms, report 179 ms. UX-5 samples were 189 ms and 190 ms. Chrome package 1.25 MB. Popup chunk 11.85 KB. Report chunk 74.47 KB. Shared chunk 173.07 KB. WASM 888.28 KB. Firefox package 1.24 MB. No new dependency.

Next action at the time: M3 Site Explorer. That checkpoint follows.

## Checkpoint M3

Date: 2026-10-28

Milestone: M3 Site Explorer.

Status: technical checks passed for Chromium. Visual design sign-off is still pending. Firefox was not loaded as a temporary add-on. UX-5 and UX-6 were not redesigned.

Chromium can start and stop a bounded crawl of the current origin from the report. The popup only opens that section. Firefox does not request other pages. robots.txt, sitemaps, page findings, link notes, duplicate titles and descriptions, and CSV/JSON export are in `docs/features/site-explorer.md`. There is no site score and no background crawl.

Verification used a local fixture in headless Chromium. Playwright 5 passed. Vitest 67 passed, including 127 ms for 100 fixture pages and 474 ms for 500. Memory and CPU were not sampled. Cargo tests were 38 passed and Clippy passed with warnings denied. `vue-tsc` passed.

Last comparable timings on this machine: popup 190 ms, report 180 ms. UX-6 samples were 188 ms and 179 ms. Chrome package 1.28 MB. Popup chunk 12.25 KB. Report chunk 92.87 KB. Shared chunk 175.82 KB. Crawl network chunk 3.62 KB. WASM 888.93 KB. Firefox package 1.25 MB, without the crawl network chunk. No new dependency.

Next action at the time: M4 historical analytics. That checkpoint follows.

## Checkpoint M4

Date: 2026-10-28

Milestone: M4 historical SEO analytics.

Status: technical checks passed for Chromium. Visual design sign-off is still pending. Firefox was not loaded as a temporary add-on. UX-5 and UX-6 were not redesigned. M3 permission denial, Firefox runtime, and phone checks remain open.

Explicit page saves now keep enough metadata to chart a score, errors, warnings, and one category at a time, and to compare two saves. Legacy saves stay readable. There is no site score and no crawl history. Behavior is in `docs/features/history.md`.

Verification used local fixtures in headless Chromium. Playwright 6 passed. Vitest 71 passed. Cargo tests were 38 passed and Clippy passed with warnings denied. `vue-tsc` passed.

Last comparable timings on this machine: popup 186 ms, report 181 ms. M3 samples were 190 ms and 180 ms. Chrome package 1.31 MB. Popup chunk 12.69 KB. Report chunk 103.85 KB. Shared chunk 181.81 KB. WASM 888.93 KB. Firefox package 1.28 MB. No new dependency.

Next action at the time: M5 advanced technical SEO. That checkpoint follows.

## Checkpoint M5

Date: 2026-10-28

Milestone: M5 advanced technical SEO.

Status: technical checks passed for Chromium. Visual design sign-off is still pending. Firefox was not loaded as a temporary add-on. UX-5 and UX-6 were not redesigned. M3 permission denial, Firefox runtime, phone checks, and the M4 comparison-precision note remain open.

Technical can compare fetched HTML, or a chosen HTML file, with the rendered snapshot. Schema extracts bounded Microdata and RDFa without replacing JSON-LD. Indexability, hreflang, and image rows state what was measured. Behavior is in `docs/features/advanced-technical.md`.

Verification used a local fixture in headless Chromium. Playwright 7 passed. Vitest 82 passed. Cargo tests were 40 passed and Clippy passed with warnings denied. `vue-tsc` and ESLint passed. The Firefox package omits the HTML-fetch chunk.

Chrome package 1.35 MB. Popup chunk 12.69 KB. Report chunk 115.76 KB. Shared chunk 191.51 KB. HTML-fetch chunk 2.14 KB. WASM 904.31 KB. Firefox package 1.32 MB. Audit timings on this run: popup 192 ms, report 193 ms. M4 samples were 186 ms and 181 ms. No new dependency.

Next action at the time: UX-7 official brand alignment. That checkpoint follows.

## Checkpoint UX-7

Date: 2026-10-28

Milestone: UX-7 official Miso brand alignment.

Status: technical checks are recorded below. Visual design sign-off is still pending. Firefox was not loaded as a temporary add-on. Scoring was not changed.

The website repository `~/Projects/Next/misoecosystem.com` was read and not modified. Light tokens match its public palette. Dark tokens match its dashboard. The extension does not load that repository. The fox icon replaces the older header artwork. A noren stripe sits on the popup and the report. Empty history shows the RankMiso fox at 192px. Font files are not bundled. Behavior and the color table are in `docs/branding/design-tokens.md`.

Verification: Playwright 7 passed. Vitest 82 passed. `vue-tsc` passed. Cargo tests and Clippy passed with warnings denied. Chrome package 1.42 MB. Firefox package 1.39 MB, without the HTML-fetch chunk. Popup chunk 12.77 KB. Report chunk 116.04 KB. WASM 904.31 KB. Audit timings: popup 195 ms, report 184 ms. M5 samples were 192 ms and 193 ms.

Next action at the time: UX-8 white workbench. That checkpoint follows.

## Checkpoint UX-8

Date: 2026-10-28

Milestone: UX-8 modern white workbench.

Status: technical checks passed for Chromium. Visual design sign-off is still pending. Firefox was not loaded as a temporary add-on. Scoring was not changed. UX-7's cream canvas is no longer the interface.

The light theme is a white canvas with neutral cards. Miso red is the accent. The platform font stack replaces the named website fonts. Dark mode keeps the navy surfaces. The fox icon stays. Details are in `docs/branding/design-tokens.md`.

Verification: Playwright 7 passed. Vitest 82 passed. `vue-tsc` passed. Chrome package 1.42 MB. Firefox package 1.39 MB, without the HTML-fetch chunk. Popup chunk 12.69 KB. Report chunk 115.97 KB. WASM 904.31 KB. Audit timings: popup 189 ms, report 186 ms. UX-7 samples were 195 ms and 184 ms.

Next action at the time: UX-9 presentation redesign. That checkpoint follows.

## Checkpoint UX-9

Date: 2026-10-28

Milestone: UX-9 premium presentation. Incomplete.

Status: technical sign-off is blocked. Visual design sign-off is pending. Scoring was not changed. The white palette from UX-8 stayed.

`docs/design/references/ux9/` is not in the repository, so the six reference screenshots were not inspected.

The popup score is now a ring beside error, warning, and passed counts, with a distribution bar. Category health is a two-column set of short meters. Findings sit on the canvas instead of inside a second card. Headings use count chips and a guided outline. Link rows stack the name above the URL. Structured values sit under their keys. Site Explorer opens with a four-count crawl board and a progress meter. History, sitemaps, images, metadata, content, social, and the desktop column were not rebuilt. A saved UX-8 screenshot set was not kept, so this pass has no paired before-and-after files.

Verification: Playwright 7 passed. Vitest 82 passed. `vue-tsc` passed. Rust was not re-run. Chrome package 1.43 MB. Firefox package 1.39 MB, without the HTML-fetch chunk. Popup chunk 12.69 KB. Report chunk 116.40 KB. CSS 51.83 KB. WASM 904.31 KB. Audit timings: popup 196 ms, report 193 ms. UX-8 samples were 189 ms and 186 ms.

Next action at the time: finish the remaining UX-9 inspectors. That checkpoint follows.

## Checkpoint UX-9 completion

Date: 2026-10-28

Milestone: UX-9 presentation, continued.

Status: technical checks passed for Chromium. Visual design sign-off is still pending. Scoring was not changed. The white palette stayed. The earlier incomplete UX-9 checkpoint is kept.

The six reference images in `/home/ed/docs/design/references/ux9/RankMiso-UX9-References-NEW/` were opened, including the contact sheet and README. They are not in the repository. UX-8 screenshots were not reconstructed. The partial UX-9 build was copied to `docs/design/reviews/ux9-continuation/baseline/` before these edits. Final shots are in `docs/design/reviews/ux9-continuation/final/`, including `site-board.png`.

From 1100px the report overview is two columns: score and page essentials on the left, findings and limits on the right. Below that width it stacks. Metadata leads with the page identity and keeps the snippet as a separate preview. Content uses four measurements and a ranked term list. Images lead with counts, then a filename, alt state, and dimensions. Social adds a provenance strip and places the two previews side by side on a wide report. Technical values are label-and-value rows, and observed redirects are a numbered sequence. International adds a return-link column that stays “Not checked” unless the syntax is invalid. Sitemaps open with file, URL, and finding counts, then the indented tree and a full-width URL table. History opens with saved count, latest score, and whether two saves can be compared, then the score and issue charts sit side by side, and the comparison is two columns. Site Explorer keeps the crawl board; the selected page sits beside the result table on a wide report. Headings, links, and structured values from the first UX-9 pass remain.

Verification: Playwright 7 passed, then sitemap and audit were run again after the sitemap table was returned to full width. Vitest 82 passed. `vue-tsc` passed. ESLint passed. Cargo tests: 37 seo-rules and 3 scoring. Clippy passed with warnings denied. Chrome package 1.43 MB. Firefox package 1.40 MB, without the HTML-fetch chunk. Popup chunk 12.69 KB. Report chunk 119.66 KB. CSS 54.67 KB. WASM 904.31 KB. Audit timings on the last full run: popup 191 ms, report 200 ms. The partial UX-9 samples were 196 ms and 193 ms. Firefox was not loaded as a temporary add-on.

Next action at the time: replace the popup shell. That checkpoint follows.

## Checkpoint UX-9R

Date: 2026-10-28

Milestone: approved popup visual concept.

Status: technical checks passed for Chromium. Visual design sign-off is pending. Scoring was not changed. The desktop report and the sidebar were not redesigned.

The approved HTML prototype at `/home/ed/Downloads/rankmiso_radical_concept.html` was read. It is a 420px shell with a 71px vertical tool rail, a dark health hero, compact finding rows, three category tiles, and a footer action. The two attached raster images show a different horizontal-tab layout. The popup follows the HTML and the written architecture.

The previous popup shots are in `docs/design/reviews/ux9r/baseline/`. The new shots are in `docs/design/reviews/ux9r/final/`.

The popup no longer uses the horizontal tab strip. Destinations come from `flatNav`, including Export and Settings. The rail scrolls on its own. The workspace scrolls on its own. The header and the Open full report button stay put. All tools opens the full destination list and Open sidebar. The hero uses the Rust score, measured and not-measured counts, and error, warning, and passed counts. A missing score is an en dash, not zero. Findings are the existing error and warning rows. Focus tiles are the three lowest measured categories under 100.

Verification: Playwright 7 passed, then the audit spec was run again after the hero spacing change. Vitest 82 passed. `vue-tsc` passed. ESLint passed. Rust was not re-run. Chrome package 1.46 MB. Firefox package 1.43 MB, without the HTML-fetch chunk. Popup chunk 24.95 KB on Chrome and 26.04 KB on Firefox. Report chunk 124.68 KB on Chrome. CSS 64.88 KB. WASM 904.31 KB. Audit timings on the last run: popup 206 ms, report 186 ms. The previous popup sample was 191 ms. No new dependency. Firefox was not loaded as a temporary add-on.

Next action: wait for visual approval of the popup. Do not start the desktop or sidebar redesign. Do not start M6.

## Checkpoint UX-9R.2

Date: 2026-10-28

Milestone: complete the premium popup inspectors.

Status: technical checks passed for Chromium. Visual design sign-off is pending. Scoring, permissions, and the Overview composition were not changed. The desktop report and the sidebar were not redesigned.

All 18 HTML files in `/home/ed/docs/design/references/RankMiso-18-Self-Contained-HTML-Files/` were opened. Reference shots and the working popup are in `docs/design/reviews/ux9r2/`. The earlier UX-9R shots stay in `docs/design/reviews/ux9r/`.

Issues, metadata, content, headings, links, images, schema, social, technical, performance, international, and accessibility keep the existing checks and measurements. They add the reference summary, tiles, and rows around that data. Site explains that the crawl starts in the report. Sitemaps does not discover files when the popup opens. History shows saved audits only. Export keeps the confirm step. Settings keeps light, dark, and system, and reads the version from the manifest.

Deviations are listed in `docs/design/reviews/ux9r2/NOTES.md`. The prototypes’ sample scores, crawl counts, and Start/Stop controls were not copied.

Verification: Playwright 7 passed, then audit, history, and technical passed again. Vitest 82 passed. `vue-tsc` passed. ESLint passed. Cargo tests: 37 seo-rules and 3 scoring. Clippy passed with warnings denied. Chrome package 1.48 MB. Firefox package 1.44 MB, without the HTML-fetch chunk. Popup chunk 35.55 KB on Chrome and 36.63 KB on Firefox. CSS 69.37 KB. WASM 904.31 KB. Last audit timing: popup 225 ms, report 186 ms. UX-9R samples were 206 ms and 186 ms. No new dependency. Firefox was not loaded as a temporary add-on.

Next action: wait for visual approval of the popup inspectors. Do not start the sidebar or full-report redesign. Do not start M6.

## Checkpoint UX-9R.2 fidelity

Date: 2026-10-28

The updated prototype package adds a labeled Sidebar button in the footer and a corrected dark theme. The popup footer now shows Open full report and Sidebar. Sidebar calls the existing browser sidebar API. It does not open the prototype preview. Dark text uses `#f4f7fc` and muted text uses `#c1ccdc`. Evidence is in `docs/design/reviews/ux9r2-fidelity/`.

This pass ran `vue-tsc`, the Chromium build, the Firefox build, and the audit, history, technical, and install Playwright tests. Popup audit was 216 ms. Rust, Vitest, ESLint, and the full Playwright suite were not re-run. Firefox was not clicked through. Headings, images, links, technical, accessibility, export, and settings now follow the prototype composition. Schema still uses the structured-data explorer. Sitemaps and history stay empty until the user starts those actions in the report. Visual fidelity is not signed off.

## Checkpoint UX-9R.2 exact

Date: 2026-10-28

The maintainer asked for an exact copy of `/home/ed/docs/design/references/RankMiso-Complete-UI-Prototypes-Sidebar-Dark-FIXED/RankMiso-Popup-Tab-Prototypes/`. All 18 destinations were rendered next to the prototype at 420px wide, in light and dark, on a local fixture that mirrors the sample content. Shots are in `docs/design/reviews/ux9r2-exact/`. The status table in `docs/design/reviews/ux9r2-fidelity/FIDELITY-REPORT.md` was replaced.

Maintainer choices: Site and Sitemaps copy the layout, but Start and Discover still open the report. Export lists JSON, CSV, and HTML report. Settings drops the Rules row and Clear saved settings; both stay in the report.

Fixes: Chrome's extension-page font size and font are reset in `popup.css`. Microdata and RDFa items show their type. Images that fail show Preview unavailable. Headings has two actions. Issues, Overview, and Accessibility rows follow the prototype's spacing. Browser tests that still pointed at the old popup were updated.

Verification: Playwright 7 passed. Vitest 82 passed. `vue-tsc` and ESLint passed. Cargo tests 40 passed and Clippy passed with warnings denied. Chrome and Firefox builds passed. Chrome package 1.57 MB. Popup audit 249 ms, report 193 ms; the previous popup sample was 216 ms. Firefox was not loaded as a temporary add-on.

Next action: visual approval of the popup. Do not start the sidebar or full-report redesign. Do not start M6.

## F1-C continuation handoff (2026-10-30)

F1-C was continued from the preceding F1 work. Keep these prior corrections: external-link highlights are HTTP(S)-only, Clear Highlights removes only RankMiso-owned markers, and score/category comparisons compare measured rule IDs.

The current work adds a dedicated `data-rankmiso-highlight` marker. An actual Chromium fixture showed a page-owned legacy marker prevented RankMiso from highlighting its heading. The new marker avoids that collision. `apps/extension/browser-tests/f1-interactions.spec.ts` passes repeated highlight/clear cycles, preserves the page marker and inline styles, and verifies clipboard values for title, headings, link, image, and JSON-LD.

Chrome 156.0.8078.47 did not honor the old `--load-extension` flags. Chrome's `Extensions.loadUnpacked` CDP method successfully installed the production unpacked build in an isolated profile; manager UI confirmed enabled RankMiso 0.3.0, an extension ID, and an MV3 worker target. This shows the prior worker search was not a valid installation check. An attempted `Extensions.triggerAction` call failed because Chrome did not treat the target as a tab target, so actual installed-Chrome popup, audit, full report, permission prompt, and settings persistence still need a supported user-action workflow.

Latest checks passed: Rust format check, 40 Rust workspace tests, Clippy, 83 Vitest tests, TypeScript/Vue typecheck, ESLint, Prettier, Chromium and Firefox production builds, and seven Playwright tests. The seven comprise every Playwright case except `audit.spec.ts` (it writes screenshot files into review directories that were already modified); all seven original test sources remain present. Build outputs report Chromium 1.53 MB / Firefox 1.49 MB, with WASM 904.31 KB each.

Firefox 158.0.1 temporary add-on previous checks remain: real extension load, a scored local audit, all 18 popup/report destinations, local XML import, and dark theme persistence. The newer attempt at HTML import, downloads, and actual sidebar is not yet verified. Do not claim signed installation or upgrade behavior. Preserve Firefox's no-host-permissions and no-network-probes restrictions.

Remaining F1-C blockers: real installed Chrome interaction; Firefox sidebar, local HTML import, confirmed JSON/CSV/HTML downloads; actual Chromium optional permission denial and revocation; cancellation on closing a report; repeatable multi-sample performance measurements. Edge unavailable remains explicitly untested. These blockers keep F1 sign-off **BLOCKED**. No versions, tags, store packages, or release state changed. Do not start M6.

## Checkpoint UX-9R.3 and UX-9R.4

Date: 2026-10-28

Milestone: sidebar workbench and full-page dashboard from the approved HTML prototypes in `/home/ed/docs/design/references/RankMiso-Sidebar-Fullpage-HTML-Prototypes/`.

Status: technical checks passed for Chromium. HTML fidelity matched with recorded deviations. Product-owner visual sign-off is pending. Firefox was built but not loaded as a temporary add-on.

The sidebar, the full report, and the options page now render `src/components/workbench/WorkbenchApp.vue` with `surface="sidebar"` or `surface="report"`. Styles are `src/styles/workbench.css`, a port of the prototype stylesheet. The 18 destinations are views in `src/components/workbench/`. Site, Sitemaps, History, and HTML compare kept their scripts; only templates changed. `AnalysisApp.vue`, 22 other old report components, `services/tablist.ts`, `styles/main.css`, and 175 unused locale strings were removed. The popup is unchanged.

The sidebar does not crawl; its Site view shows the last saved crawl and opens the report. Sitemaps still run in both surfaces. Deep links (`?section=`) still work.

Verification: Playwright 7 passed. Vitest 81 passed (component tests moved to the workbench views). `vue-tsc`, ESLint, and Prettier passed. Cargo tests 40 passed, Clippy passed with warnings denied. `cargo fmt --check` fails on `seo-rules` and `seo-wasm` files from the earlier M5 commit; Rust was not changed here. Chrome package 1.52 MB (was 1.57 MB). Firefox 1.49 MB (was 1.54 MB). Workbench script 150.15 KB and CSS 41.68 KB, replacing the 157.49 KB report script and 82.71 KB CSS. Popup chunk 81.12 KB, popup CSS 26.30 KB, WASM 904.31 KB. Start-up on the same fixture, best of five: sidebar 125 ms, report 122 ms, popup 123 ms. Audit spec: popup 231 ms, report 175 ms (UX-9R.2: 216 and 193 ms).

Fidelity matrix: `docs/design/reviews/ux9r3-4/FIDELITY-REPORT.md`. Screenshots are local only in `docs/design/reviews/local/` (git-ignored).

Popup fix found in manual Chrome testing: `popup.css` carried the prototype's `@media (max-width: 400px) { body { width: 100% } }`. Chrome sizes a toolbar popup from a tiny first window, so the popup collapsed to its rail. The rule was removed and the body has `min-width: 420px`. `extension-install.spec.ts` now checks the popup at a 120px window. This bug dated from UX-9R.

Next action: product-owner review. Do not start M6.

## Do not

- Add host permissions to the default manifest to make development easier.
- Mark unavailable checks as passes.
- Copy visual layouts or text from reference extensions.
- Upgrade `wasm-bindgen` without upgrading the CLI in the same change.
- Put `color: inherit` on `button` outside `@layer`.
- Leave bare `border` or `border-b` on `currentColor`. Default border color is the `--border` token.
- Hardcode the product name or hex colors in Vue components.
- Treat the geometric M or the current palette as the final Miso identity.

## Useful entry points

- `apps/extension/src/config/brand.config.ts`
- `packages/design-tokens/src/tokens.css`
- `scripts/brand-icons.sh`
- `docs/branding/asset-replacement.md`
- `crates/seo-rules/src/lib.rs` — `analyze`
- `apps/extension/src/extraction/page-tool.ts` — `runPageTool`
- `apps/extension/src/composables/useAudit.ts`
- `apps/extension/entrypoints/popup/App.vue`
- `apps/extension/src/components/workbench/WorkbenchApp.vue` — sidebar, report, and options shell
- `apps/extension/src/services/site-crawl.ts` — crawl session, scope, and export
- `apps/extension/src/services/site-crawl-network.ts` — Chromium fetch, robots, and sitemaps
- `docs/features/site-explorer.md`
- `apps/extension/src/services/saved-reports.ts` — saved comparisons and history
- `docs/features/history.md`
- `apps/extension/src/services/html-fetch.ts` — Chromium HTML comparison fetch
- `apps/extension/src/services/structured-markup.ts` — Microdata and bounded RDFa
- `docs/features/advanced-technical.md`

## F1-D current handoff (2026-10-30)

The latest branch remains `chore/rustfmt` at `65753ffe77d5e8dfac079369d44389ab5de04b94`; v0.3.0 is published and unchanged. Preserve all four F1/F1-C fixes. Full Playwright: 8/8 passed in Chromium 156.0.8078.4. Vitest: 82 passed, with the two repeatable performance cases opt-in/skipped by default; Rust: 40 passed, fmt and Clippy clean. Vue/TypeScript, ESLint, Prettier and both builds pass.

The installed Chrome unpacked build loads via `Extensions.loadUnpacked`; manager status, ID, and worker are verified. The current CDP session exposes page targets and rejects its page ID for `Extensions.triggerAction`. Do not retry that same unsupported automation path. Use [`docs/testing/f1-d-manual-handoff.md`](../testing/f1-d-manual-handoff.md) for installed Chrome UI and native permission actions, plus Firefox sidebar, local HTML, export and history checks. The same document provides a request-logged local fixture for denial, revocation, cancellation and redirect checks.

Repeatable deterministic baseline: [`docs/testing/performance-baseline.md`](../testing/performance-baseline.md). It records five UI/history/crawl/parser samples and memory where available. It is not installed-Chrome/Firefox or public-network performance evidence.

Screenshot handling note: the scored-fixture test had a second pre-existing `ux9r2/final` output path. Early F1-D runs wrote there before it was redirected; the previously clean `international.png` was restored from HEAD. The other images in that directory were already dirty at task start and remain so, but their exact byte identity to the pre-run working tree cannot be independently confirmed. The test now redirects both screenshot groups, and the final full Playwright run used that setting.

**F1-D / F1 sign-off stays BLOCKED** pending maintainer browser results. Edge is unavailable. Signed Firefox install/upgrade is not verified. Do not change version/release state, commit/push, or begin M6.

## F1-E current handoff (2026-10-30)

The P1 bug root cause was confirmed in `src/composables/useAudit.ts`: `tabs.onActivated` only marked the pinned result stale. It neither resolved the newly active tab nor ran extraction again. The sidepanel entry also accepted a tab ID from its URL. The sidebar now uses an active-following audit mode scoped to its owning window; reports and popups retain pinned behavior. Existing explicit `sidepanel.html?tabId=...` URLs still work for focused fixtures/legacy links, while the browser's actual sidebar URL follows active context.

The sidebar clears old results on a tab change, attempts a local snapshot + Rust/WASM audit without requesting permissions, and displays the existing explicit Refresh path when the active tab cannot be inspected. Full navigations invalidate cache and refresh after completion. For SPA routes, the existing page-tool history hook emits a lightweight custom event; a dynamically installed isolated-world listener sends a runtime message. The sidebar verifies both the sender tab and its owning window/current-active tab before it refreshes. No `webNavigation`, host permission, timer, or new dependency was added. The in-memory five-tab cache is URL + route-generation checked and removed on navigation/close. Per-composable request revisions discard stale async completions.

Verification for the final F1-E code: Rust fmt, 40 workspace tests, Clippy, Vitest 91 passed/2 skipped, Vue/TypeScript, ESLint, Prettier, Chrome and Firefox builds passed. Full Playwright passed 9/9, including `f1-tab-sync.spec.ts` against built Chromium with granted fixture-origin access. It covers A→B→A, SPA `pushState`, full navigation, manual Refresh and request logs showing only fixture navigations. `use-audit.test.ts` covers late response rejection, cache reuse/invalidation, window filtering, access denied without permission request, tab closure, listener disposal and pinned report stale status.

**Runtime limitation:** the maintainer-reported defect was reproduced before this change in both browsers. This turn did not exercise the fixed sidebar in installed Chrome or the Firefox temporary add-on. Mark Chrome and Firefox post-fix runtime as **BLOCKED**, not PASS, until the short checks in `docs/testing/manual-checklist.md` are performed. Browser restrictions remain: no auto permission prompt; access-denied tabs show the Refresh action; explicit crawl/sitemap/network operations remain user initiated. F1-D's native permission denial/revocation and cancellation cases also remain open. Do not change version, release state or begin M6.

## F1-G current handoff (2026-10-30)

Three targeted fixes are implemented in the existing F1 working tree. Firefox sidebar inspection no longer calls `permissions.request` for `tabs`; although `tabs` is already an optional manifest permission, a sidebar Refresh call is outside an eligible user-action context and that grant does not provide page inspection access. It instructs the user to invoke the toolbar action, whose popup retains Firefox `activeTab` access, then signals the authorized tab to the sidebar. Chrome's origin permission request remains unchanged. The History empty state now references `brandConfig.assets.icon` (`/brand/icon.png`) instead of the full-body fox. Opening the Site report from the sidebar now opens `dashboard.html?tabId=…&section=site` and closes only the originating native panel (Chrome global panel by `windowId`, Firefox `sidebarAction.close()`); panel-close failure is surfaced while report launch continues. The crawl is not started.

Automated checks: typecheck, ESLint, Prettier and Vitest passed (101 passed, 2 opt-in performance tests skipped); Rust formatting, 40 workspace tests and Clippy passed; Chrome and Firefox production builds passed. The in-sandbox Playwright run could not bind loopback or launch Chromium; the approved outside-sandbox run passed 9/9. The generated Firefox manifest remains at v0.3.0 with existing `storage`, `activeTab`, `scripting`, optional `tabs`, and `data_collection_permissions.required=["none"]`; no permission was added. The History screenshot assertions passed and the 1280px light and dark screenshots were reviewed; generated screenshots are ignored by git and did not overwrite tracked design-review images.

Native Chrome/Firefox UI behavior is not yet independently exercised in this checkpoint. The product owner's earlier F1-E A/B tab-switch observation is retained as evidence only for that sequence; it does not cover this Firefox toolbar-authorized refresh or report-triggered panel close. Follow the F1-G steps in `docs/testing/manual-checklist.md` before claiming native runtime PASS. Version remains 0.3.0; do not commit, publish, or start M6.

## F1-H current handoff (2026-10-30)

Firefox and Chrome now declare optional HTTP/HTTPS host eligibility; runtime access requests are scoped to the selected scheme and hostname. Firefox's sidebar **Allow this website** handler calls `permissions.request` before any await, then validates the active tab, requested pattern, permission grant, and request revision before auditing locally. Denial, errors, unsupported URLs, permission revocation, and stale cross-tab results have explicit handling. Existing permission grants permit event-driven local sidebar inspection. Firefox's optional network features remain disabled regardless of host grants. Required permissions, extension identity, `data_collection_permissions.required=["none"]`, and version 0.3.0 are unchanged.

Current automated verification: Rust fmt, workspace tests (40), and Clippy passed. Vitest passed 108 with 2 opt-in cases skipped; TypeScript/Vue, ESLint, and Prettier passed. Both production builds succeeded; generated manifests were inspected. The full Chromium Playwright suite passed 10/10, including the F1-E tab synchronization test after correcting its copied test manifest to use a hostname-level permission pattern instead of an ephemeral port-specific pattern. This automation uses a temporary pre-authorized test origin and does not exercise the native permission prompt. Native Firefox grant, denial, and revocation interactions remain unverified; follow `docs/testing/manual-checklist.md`.

**Privacy-policy release handoff:** the website repo at `~/Projects/Next/misoecosystem.com` was not modified. Its public policy v4 remains accurate for published v0.3.0, which has no optional Firefox host requests. Before releasing this code, publish a new policy revision explaining that Firefox may request access to one selected HTTP(S) site only after explicit approval; access supports local inspection of active pages while using the sidebar; users can deny or revoke it in Firefox add-on settings; the toolbar action remains a one-page fallback; and local processing, no account, no telemetry, and Firefox network-feature restrictions remain unchanged. Coordinate policy publication and store packaging as separate maintainer-authorized actions.

## F1-H.1 current handoff (2026-10-30)

Automatic website checks are opt-in through the sidebar/Settings action. The native request is made synchronously from that click for `http://*/*` and `https://*/*`, which are optional eligibility patterns only; the user is authorizing broad HTTP/HTTPS host access. There is no installation-time host permission. Individual mode remains available and does not use the broad grant to authorize automatic inspection. Neither mode starts a crawler, sitemap discovery, remote probe, or PageSpeed call automatically.

The sidebar's automatic refresh still follows only its owning window while the sidebar document is visible. Its current-page local snapshot and Rust/WASM audit use the existing bounded cache/revision mechanism. Manual Refresh bypasses that cache and runs fresh extraction for the selected page without reloading it. Permission removal causes access to be rechecked; surviving explicit individual grants remain valid. No saved History is written automatically.

Verified in this checkpoint: seven new `useAudit` cases cover direct opt-in request scope, denial, Individual-mode isolation, fresh manual Refresh, authorized multi-site cache reuse, broad revocation, and failed permission removal; popup Settings copy/actions are covered too. Full Vitest is 116 passed / 2 opt-in performance tests skipped. Typecheck, lint, Prettier, Rust fmt/test/Clippy, Chromium and Firefox builds pass. Both built manifests were inspected: optional HTTP/HTTPS patterns, no required host permissions, no new API permission; Firefox identity and `data_collection_permissions.required=["none"]` remain intact. Full Playwright is 10/10 in Playwright Chromium after approval to use loopback and browser launch. This does not test native Chrome or Firefox prompts.

**Manual runtime still required:** in isolated Chrome and Firefox profiles, test the actual native prompt for Automatic checks (approve and deny), then revoke broad access through browser controls. Also check first audit after grant, A/B/A authorized switching, individual mode with broad access granted but preference disabled, current-page Refresh after DOM metadata changes, and restricted browser pages. Do not mark these as verified until recorded. Native runtime remains partial; release readiness is pending.

Environment note: Google Chrome 156.0.8078.47 is installed but this turn did not interact with its native extension UI. `firefox --version` was blocked by the system snap launcher reporting an AppArmor confinement error, so no F1-H.1 native Firefox test could be run here. This is a verification limitation, not evidence of a product defect.

**Privacy/store release handoff (draft, do not publish from this repository):** “RankMiso can optionally request access to HTTP and HTTPS websites. If you enable Automatic checks, your browser grants broad website access. RankMiso uses it to inspect the active page locally while the RankMiso sidebar is open and Automatic checks are enabled. You may instead allow websites individually, decline access, or revoke access in your browser's extension settings. Core SEO analysis runs on your device. RankMiso does not collect browsing history or send audit results to RankMiso servers. Automatic checks do not start crawls or save History. Site Explorer, sitemap discovery, and other optional network checks remain separate actions that you start yourself.” Keep existing disclosures for Chromium PageSpeed, which sends the selected URL and user-provided API key to Google only after a separate user action. Confirm precise platform wording against the implementation and legal/privacy owner before publication. Update Chrome Web Store and AMO permission purpose/disclosure fields to describe optional broad HTTP/HTTPS host access and active-page local inspection; do not describe this as per-site-only grant. The public policy for the already-published v0.3.0 must remain truthful until the updated extension is released.
# F1-I handoff — Firefox Site Explorer parity (2026-10-30)

The current working tree enables Firefox Site Explorer through the existing shared crawler. `SiteView.vue` requests the selected origin from Start, checks the grant, checks it again before each request, and aborts on revocation or report disposal. `site-crawl-network.ts` remains the single crawl network adapter. `sitemap-explore.ts` accepts a narrow `networkPurpose: "site-crawl"` option so Firefox's existing robots/sitemap logic is used only inside a user-started crawl. General Firefox optional external checks remain disabled. No manifest permissions, dependencies, version metadata, or source limits changed.

Automated evidence: Vitest 118 passed / 2 opt-in benchmarks skipped; TypeScript/Vue, ESLint, Prettier passed; Playwright 10/10 passed with the approved local-loopback run; Chrome and Firefox production builds succeeded. Build sizes were 1.55 MB and 1.53 MB. These results do not establish native permission dialogs or Firefox network runtime behavior.

Before F1-I runtime acceptance, use the dedicated fixture procedure in `docs/testing/manual-checklist.md` to test Firefox grant/deny, basic crawl, robots, Stop, report closure, revocation, limits, redirects, and request logs. Run the same fixture crawl in Chrome as a regression. Record browser versions and actual server logs. Firefox Site Explorer is not available in published v0.3.0; target consolidation is v0.4.0. The website policy repository was not changed. Coordinate policy v5 wording before release, including user-started Firefox crawling, origin scope, permission, limits, robots, redirects, cancellation, local processing, and storage. Suggested policy addition for legal/privacy review: “When you start a Site Explorer crawl, RankMiso requests browser permission for the selected website if needed. RankMiso sends direct, credential-free requests from the extension to pages on that origin, honors its crawl limits and robots.txt policy, blocks redirects outside the selected origin, and stops scheduling requests when you stop or close the report. Results are processed locally; RankMiso does not send crawl results to its servers. Crawl results may be retained locally as the most recent session for that origin; crawls do not resume automatically.” Confirm exact retention and redirect wording against final runtime evidence before publication. Do not bump version, package for store submission, commit, push, publish, or start M6.
# R0.4.0 initial release-candidate handoff (superseded by the final QA section below)

At the initial preparation checkpoint, the clean source candidate was still being assembled. The later R0.4.0-G1 checkpoint records the completed candidate snapshot, the G1 corrections, rebuilt artifacts, and remaining acceptance gates. The published v0.3.0 release remains unchanged. The working tree still contains unrelated marketing edits and design-review screenshots; these are excluded from the isolated candidate.

The owner confirms the latest Firefox development build completed a basic Site Explorer crawl. Treat only the basic operation as runtime confirmed. Permission denial/revocation, server request logs, robots, redirects, cancellation, limits, and native Chrome regression remain separate checks.

The live Privacy Policy Version 6 currently labels v0.4.0 features as coming, but Site Explorer still identifies crawling as Chrome-only. `docs/releases/v0.4.0.md` contains proposed replacement wording. Do not update the website from this repository. Release submission remains blocked on privacy coordination and supported security acceptance; DNS rebinding cannot be ruled out by current hostname checks.
# R0.4.0 release-candidate handoff (2026-10-30)

The v0.4.0 candidate is built in the isolated `/tmp/rankmiso-v0.4.0-rc-final` source snapshot and copied to the ignored `apps/extension/.output/release-candidate/` directory. Candidate packages are not store submissions. The source archive rebuild matched all 24 Firefox extension files byte-for-byte. QA details, artifacts, and checksums are in `docs/releases/v0.4.0-qa.md` and the candidate output directory.

Do not submit yet. Outstanding acceptance includes installed Chrome runtime; native optional permission grant/denial/revocation; fixture request-log confirmation for Firefox redirects, robots exclusions, cancellation/report closure, and limits; and security review of private-network redirects/DNS rebinding. The product owner confirmed basic Firefox Site Explorer runtime on the latest development build, but supplied no browser/build/request-log details. Public Privacy Policy v6 is live but still describes Site Explorer as Chrome-only and labels v0.4.0 features upcoming. Coordinate policy and store disclosure updates before submission. No website changes, version other than the authorized candidate version, commit, tag, push, or upload were made.

## R0.4.0-G1 final acceptance handoff (2026-10-30)

G1 corrected unbounded/un-timed `robots.txt` redirects, included robots/sitemap preflight in the 120-second total crawl deadline, blocked retry dispatch after Stop, and improved literal IPv6 private/link-local classification. Focused tests cover these cases and configured limits. Rebuild candidate packages and Firefox sources from the corrected isolated snapshot, rerun source reproduction, and regenerate checksums.

Do not submit. DNS rebinding cannot be resolved with a DNS preflight because extension fetch cannot pin the checked answer to its connection. Chrome 156 loaded the pre-G1 candidate, but CDP toolbar action automation rejected its target and did not verify popup/sidebar/report behavior. Firefox launch is blocked by Snap confinement; only the owner's earlier basic-crawl confirmation is available. Permission denial/revocation and request-log checks for redirects, robots, Stop/report closure, and limits remain unverified. Public Privacy Policy v6 is live and still identifies crawling as Chrome-only/upcoming. Proposed Version 7 text is in `docs/releases/v0.4.0.md`; do not edit the website repository.
