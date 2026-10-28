# Handoff

Date: 2026-10-27

## Repository

The project is this repository.

The directory was renamed from `seo-toolkit`. The old directory no longer exists. The git remote is `https://github.com/EdeesonOpina/rankmiso.git` and is private. The v0.2.0 release-preparation branch is `release/v0.2.0`, based on the current `master` branch. Do not commit, push, or change visibility unless the maintainer asks.

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

The analysis slice is unchanged in the engine. Navigation is one flat list: Overview, Issues, Metadata, Content, Headings, Links, Images, Schema, Social, Technical, Performance, International, Accessibility, Sitemaps, then History, Export, and Settings. Wide reports use a left list. The popup, the sidebar, and reports under 760px use one scrolling tab strip. Confirmed exports, copy actions, thousands separators, readable JSON-LD, share cards, horizontal image rows, and light/dark/system theme remain. Dashboard field labels and status badges use `src/locales/en.ts`.

## Verified on 2026-10-15 after the move

- Rust format, Clippy, and 26 tests passed (23 rules, 3 scoring).
- Extension tests: 17 passed. `vue-tsc` and ESLint passed.
- Firefox MV3 production build passed and includes the local WASM file. Gecko id is `rankmiso@rankmiso.extension`.
- Chrome was not rebuilt in this pass.

## Release status

RankMiso is available in both the Chrome Web Store and Firefox Add-ons. Version 0.2.0 is being prepared on `release/v0.2.0`; it has not been submitted or published. Follow `docs/releases/chrome.md` and `docs/releases/firefox.md` for build and store preparation. The verification notes above describe earlier builds and are historical; verify the currently published versions before relying on them for browser-specific behavior.

## Not verified

- Firefox runtime installation and Edge installation automation. Playwright checks the Firefox package metadata and assets but loads only the Chromium extension.
- Highlight and clear on a live page.
- Whether every remote share image loads inside the extension page.

Chrome and Firefox are published. The maintainer previously loaded the unpacked Chrome extension and used its popup and side panel on a live page.

Reload the extension after rebuilding. Firefox temporary add-ons disappear when Firefox quits. Load `apps/extension/.output/firefox-mv3/manifest.json` from `about:debugging`.

## Remaining product work

1. M1 is verified on local scored fixtures in headless Chromium and is accepted. See checkpoint M1-2.
2. M2 Sitemap Explorer is implemented. Chromium discovery and import were checked in Playwright. Firefox runtime import was not loaded. See checkpoint M2.
3. UX-2 replaces the UX-1 navigation. Technical checks passed. Visual design sign-off is still pending. M3 site explorer is next only when the maintainer asks. Do not start it.
4. Decide whether Firefox and Edge need automated install coverage beyond manual checks.
5. Continue SERP work carefully: the current metadata preview is approximate and editable, and does not simulate location or report rankings.
6. Compare local benchmark results on the same machine before drawing performance conclusions.
7. The local schema field list remains informational. The existing Google validator link is the official eligibility handoff.
8. MCP is planned only. Review Phase 7 and M6 in `docs/development/implementation-plan.md`; no MCP server or extension bridge exists yet.

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
- `apps/extension/src/components/AnalysisApp.vue`
- `apps/extension/src/services/site-crawl.ts` — crawl session, scope, and export
- `apps/extension/src/services/site-crawl-network.ts` — Chromium fetch, robots, and sitemaps
- `docs/features/site-explorer.md`
- `apps/extension/src/services/saved-reports.ts` — saved comparisons and history
- `docs/features/history.md`
- `apps/extension/src/services/html-fetch.ts` — Chromium HTML comparison fetch
- `apps/extension/src/services/structured-markup.ts` — Microdata and bounded RDFa
- `docs/features/advanced-technical.md`
