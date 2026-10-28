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

Next action: M6 — local MCP integration, only when the maintainer asks. Do not start it.

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
