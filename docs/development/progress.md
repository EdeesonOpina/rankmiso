# Progress

Updated: 2026-10-28

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
- M1 workbench verified on local HTML fixtures in headless Chromium: scored popup and dashboard, issue guidance, exports, and saved comparisons. Checkpoint M1-2 below.
- M2 Sitemap Explorer. Chromium discovery, index reading, validation, import, and export are in the report. Firefox imports XML and does not request sitemaps. Checkpoint M2 below.
- UX-1 presentation pass. The popup leads with the score and real findings. Wide reports use one navigation list. Narrow reports and the sidebar use one menu. Checkpoint UX-1 in the handoff. The product owner later rejected that visual design. UX-2 replaces it.
- UX-2 flat workbench. Metadata through Social are direct destinations. The Current view select is gone. Checkpoint UX-2 below. The product owner later rejected that visual presentation. UX-3 replaces the spacing, cards, score ring, and tab scrolling.
- UX-3 visual refinement. White light-theme cards, an SVG score ring, and a draggable tab strip. Checkpoint UX-3 below. The product owner later rejected the white-card direction. UX-4 keeps the ring, gutters, and drag navigation.
- UX-4 inspector presentation. Page sections sit on the cream canvas with separators, a heading outline, and a link list that becomes a table on wide reports. Checkpoint UX-4 below. The product owner later found that presentation too plain. UX-5 adds the ivory card treatment.
- UX-5 card system, social previews, and tab discoverability. Checkpoint UX-5 below. Visual sign-off is pending.
- UX-6 inspector interaction. Schema tree, link groups, and social spacing. Checkpoint UX-6 below. Visual sign-off remains pending. The UX-5 card system was not redesigned.
- M3 Site Explorer. Chromium can start and stop a bounded same-origin crawl from the report. Firefox does not crawl. Checkpoint M3 below.
- M4 History. Explicit page saves, a score timeline, and a two-save comparison. Checkpoint M4 below. Visual sign-off remains pending.
- M5 advanced technical SEO. Fetched HTML compared with the rendered page, bounded Microdata and RDFa, indexability signals, and image measurements the browser already exposed. Checkpoint M5 below. Visual sign-off remains pending.

## In progress

- Firefox runtime-install and Edge install automation. Firefox 158.0.1 is installed on this machine, but this session did not load the unsigned package as a temporary add-on. Package metadata and assets are checked automatically.
- v0.2.0 store submissions and publication. Chrome and Firefox packages for this version have not been submitted.

## Not started

- M6 MCP and M7 Search Console. Constraints are in `implementation-plan.md`. Do not treat these as available. M5 is implemented; see the checkpoint below. M3 permission denial, Firefox runtime, and phone checks remain open.

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

## M1 checkpoint (2026-10-27)

- Extension Vitest: passed, 41 tests. Typecheck passed.
- Rust was not modified. Cargo was not rerun. The 2026-10-24 engine baseline still applies.
- `pnpm build:wasm` and the Chrome MV3 build passed. Chrome package size is 1.15 MB, of which the WASM asset is 831 KB. The popup chunk is 20.51 KB and the report chunk is 58.49 KB. No earlier package size was measured in this session, so this is a baseline, not a delta.
- Playwright Chromium: passed. Popup keyboard moves from Overview to Issues. Inspect shows Metadata, Headings, Links, Images, Structured data, and Social, wrapping the last label instead of clipping it. Dashboard navigation is visible at 360×640, 768×1024, and 1280×800. Light and dark popup screenshots were taken. The page under test was the extension page itself, so the screenshots show the blocked-page message, not a scored audit.
- Firefox was not rebuilt in this session.

## M1-2 final verification (2026-10-27)

M1 is complete for Chromium. Firefox runtime was not loaded.

Scored pages were three local fixtures served on `127.0.0.1` and opened as normal tabs: `apps/extension/browser-tests/fixtures/healthy.html`, `issues.html`, and `sparse.html`. Playwright loaded a temporary copy of the Chrome build with `host_permissions` for that origin only. The product manifest at `.output/chrome-mv3/manifest.json` still has no required `host_permissions`. The popup reads an optional `tabId` query so the test can target the fixture; a toolbar popup with no query still uses the active tab.

Browser: headless Chromium 156.0.8078.47. Node 22.23.3. Firefox 158.0.1 is installed and was not used as a runtime.

Results:

- Rust: `cargo test --workspace` passed, 27 rule tests and 3 scoring tests. Rust sources were not changed.
- Vitest: 41 passed. `vue-tsc`, ESLint, and Prettier passed.
- Playwright: 3 passed. The scored-fixture test, the extension-shell test, and the Firefox package check.
- Chrome MV3 build passed. Firefox MV3 build passed.
- Healthy page popup score was 91, with 38 measured checks. Performance stayed “Not measured”. Passed checks and category bars rendered. Inspect showed metadata, headings, links, the image alt, Article JSON-LD, and the social approximation note.
- Issues page dashboard score was 82. Rust findings shown: missing meta description, missing image alt, multiple H1s, an empty heading, and invalid JSON-LD. Status filters, the category select, search, severity sort, and title sort behaved as the engine ranked them. Guidance and generic examples rendered as text. The page title `Issues <script>alert(1)</script>` stayed text.
- Structured data on that page showed 0. That is the scored JSON-LD syntax error (`RULE_JSONLD_SYNTAX` is an error). The rich-result check stays unavailable and is excluded. Social and Performance on that page stayed “Not measured”, with a zero-width bar and no 100.
- Technical opens Performance, International, and Accessibility. PageSpeed remains the unavailable check and is not listed as passed.
- `?section=headings` opened the headings section, including the legacy deep link from the popup.
- JSON export contained the fixture URL and `RULE_IMAGE_ALT_MISSING`. Headings CSV prefixed the `=1+1` cell. HTML export escaped the title script. Each download asked for confirmation.
- A saved comparison survived reload and appeared as “Saved comparisons: 1”.
- Dark theme, system theme under a dark color scheme, and reduced motion were checked on the dashboard. Reduced motion computed `animation-name: none`.
- Screenshots, gitignored under `apps/extension/test-results/`: `audit-popup-overview.png`, `audit-popup-light.png`, `audit-popup-dark.png`, `audit-issues.png`, `audit-dashboard-overview.png`, `audit-dashboard-360.png`, `audit-dashboard-768.png`, `audit-dashboard-dark.png`.

Bugs fixed in this pass:

- The category and sort selects were named with every option, so “Category” also collided with the category list. Each select now has its own label.
- On-page section tabs were clipped at 768px and the later tabs sat off-screen at 360px. The row wraps.
- Saved comparisons vanished after reload. `chrome.storage` structured-clones Vue proxies, and an empty reactive `canonicals` array was stored as `{}`. The reader then rejected the record. New saves are plain JSON. A previously stored string map is read back as a list.

Sizes, compared with the M1-1 baseline of 1.15 MB, WASM 831 KB, popup 20.51 KB, report 58.49 KB:

- Chrome package remains 1.15 MB. WASM is the same file, `seo_wasm_bg-C2mt3Mha.wasm`, reported as 830.75 KB.
- Popup chunk is 20.61 KB. The extra tenth is the optional `tabId` query.
- Report chunk is 58.87 KB. The extra size is the comparison-storage fix and the select labels.
- Firefox package is 1.14 MB. Its popup chunk is 20.61 KB and its report chunk is 57.34 KB, because PageSpeed and site probes are omitted. WASM is the same file. Permissions are `storage`, `activeTab`, and `scripting`, plus optional `tabs`. There is no host permission and no `sidePanel`. `data_collection_permissions.required` is `none`.
- Last measured popup initialization was 178 ms and dashboard render was 175 ms, against the local fixtures in headless Chromium. Earlier passes in this session were about 170–190 ms. These are not a lab benchmark.

Security notes: no new product permission, no remote script, and no telemetry. Issue examples stay text. Export escaping and the CSV formula prefix still hold. Scoring still comes from Rust.

Limits that remain: Firefox and Edge were not installed and exercised in this session. The scored test is headless Chromium against localhost, not a maintainer session on a public page. HTTP fixtures still produce the HTTPS warning, which is why the healthy score is 91 rather than a perfect result. The issues list is not virtualized. Popup filter chips stay 36px tall. Settings now reads the manifest version instead of a separate 0.1.1 constant.

## M2 checkpoint (2026-10-27)

Chromium sitemap discovery, index reading, validation, local import, and CSV export passed in headless Chromium 156.0.8078.47. The fixture server served robots.txt with two sitemap lines, a urlset containing the open page, a sitemap index, a nested index, malformed XML, and duplicate URLs with a bad lastmod. The product manifest still has no required host permission. The test copy allows `http://127.0.0.1/*` only.

Rust sitemap tests passed with the workspace suite. Vitest is 52 passed, including sitemap discovery, DTD rejection, gzip, cancellation, limits, cross-origin refusal, and CSV formula prefixing. `vue-tsc` passed. Playwright is 4 passed, including the M1 scored audit and the sitemap explorer. Firefox MV3 build passed. Its chunks do not contain `/robots.txt`, it has no optional host permission, and `data_collection_permissions.required` is `none`. Firefox was not loaded as a temporary add-on, so import-in-Firefox is not a runtime result.

Budgets: 8 files, 500 URL entries, 512 KB per file, 5 redirects, 8 second timeout. A nested index is reported and not followed. Gzip uses `DecompressionStream` when the browser has it.

Sizes after M2, compared with M1-2: Chrome package 1.23 MB (was 1.15 MB). WASM `seo_wasm_bg-EZRNPfdu.wasm` 888.28 KB (was 830.75 KB) because sitemap findings live in the same engine. Popup chunk 20.93 KB (was 20.61 KB) from the Open sitemaps button. Report chunk 79.78 KB (was 58.87 KB) from the explorer. The M1 scored popup still initialized in 170 ms and the report in 190 ms on the last run. Firefox package 1.22 MB. The robots address is a separate Chromium chunk and is absent from the Firefox build.

Settings shows `browser.runtime.getManifest().version`, which is 0.2.0. No second version constant.

## UX-1 checkpoint (2026-10-27)

Presentation only. Rust scores and sitemap findings are unchanged. The popup leads with the score, categories under 100, and up to three real findings. Wide reports use one left navigation list. Below 760px, and in the sidebar, one Current view select replaces the two tab rows. `?section=headings` and `?section=sitemaps` still work. Evidence and examples open from the finding instead of being clamped.

Headless Chromium 156.0.8078.47 rendered the healthy fixture, the issues fixture, the sparse fixture, and the sitemap fixtures. Checks covered 320, 360, 420×650, 420×720, 768, and 1280. Light and dark screenshots were reviewed. The second popup finding was inside the 650px viewport. Unavailable categories still say Not measured and use a zero-width bar. Playwright 4 passed on the prior full run, and the scored audit passed again after the final Chrome build. Firefox MV3 built. It was not loaded as a temporary add-on.

Last comparable timings: popup 176 ms, report 181 ms. Chrome package 1.24 MB. Popup chunk 21.68 KB. Report chunk 78.67 KB. WASM 888.28 KB. Firefox package 1.22 MB. No new dependency.

## UX-2 checkpoint (2026-10-27)

Presentation only. Rust scores and sitemap findings are unchanged. UX-1 was technically verified and then visually rejected because SEO tools sat behind Inspect or a Current view select. UX-2 uses one destination list. A wide report shows it on the left. The popup, the sidebar, and widths under 760px use one scrolling tab strip. `?section=headings` and `?section=sitemaps` still work.

Headless Chromium 156.0.8078.47 rendered the healthy, issues, sparse, and sitemap fixtures. Checks covered 320, 350, 360×640, 420×650, 420×720, 768×1024, and 1280×800. The screenshots listed in the handoff were inspected. The second popup finding was inside the 650px viewport. Page overflow was false on the popup and the report. Playwright 4 passed. Vitest 52 passed. `vue-tsc`, ESLint, and Prettier passed. Cargo tests were 37 passed and Clippy passed with warnings denied. Firefox MV3 built at 1.22 MB, keeps the add-on id, has no optional host permission, and does not contain `/robots.txt`. Firefox was not loaded as a temporary add-on.

Last timings: popup 186 ms, report 182 ms. Chrome package 1.24 MB. Popup chunk 20.79 KB. Report chunk 76.92 KB. WASM 888.28 KB. Compared with UX-1, the package size is unchanged and the popup and report chunks are slightly smaller. The popup timing is about 10 ms slower than the UX-1 176 ms run and within the earlier 170–186 ms range. No new dependency.

Visual review did not find a wrapped tab row, a Current view select, or a second click before Metadata, Images, or Social. Short popup panes still end above empty popup space. The social card keeps a tall image area when the image is missing. Those are recorded limitations, not navigation failures. Product-owner visual approval is still open.

## UX-3 checkpoint (2026-10-27)

Presentation only. The UX-2 destination list is unchanged. Rust scores and sitemap findings are unchanged. Light cards are white on the cream canvas. Dark cards use the elevated surface. The score ring uses the Rust value. An unavailable score does not draw a full ring. The tab strip has no previous or next buttons. Mouse drag scrolls it after a 6px threshold. Touch and trackpad use native scrolling. Keyboard selection remains.

Headless Chromium 156.0.8078.47 rendered the healthy, issues, sparse, and sitemap fixtures. Playwright 4 passed, including a drag that scrolls the strip without changing the selected tab. Vitest 52 passed on the full run after this checkpoint's unit check. `vue-tsc`, ESLint, and Prettier passed. Cargo tests were 37 passed and Clippy passed with warnings denied. Firefox MV3 built at 1.22 MB and the package test passed. Firefox was not loaded as a temporary add-on.

Last timings: popup 189 ms, report 174 ms. An earlier sample was 228 ms and 185 ms. Chrome package 1.24 MB. Popup chunk 21.02 KB. Report chunk 77.10 KB. WASM 888.28 KB. Compared with UX-2, the package size is unchanged. The popup chunk grew by about 0.2 KB. The latest popup timing is 189 ms against the UX-2 186 ms sample. No new dependency.

Inspected screenshots show the ring, white cards, and gutters on the popup, sidebar, and report. The metadata popup no longer wraps its rows in a second card. Product-owner visual approval is still open. The product owner later rejected the white cards. UX-4 replaces that surface treatment.

## UX-4 checkpoint (2026-10-27)

Presentation only. Rust scores and sitemap findings are unchanged. The product owner rejected the UX-3 white cards. Sections stay on the cream canvas. Hierarchy comes from type, 16px section gaps, and hairline separators. Inputs, snippet previews, and the approximation note keep a border. The score ring, 16px popup and sidebar gutters, 24px report padding, and the draggable tab strip stay. There is no Current view select and no tab arrows.

Headings are a document outline in page order. Indent stops at three steps. Empty headings say "(empty)". Search, level filters, and copy-outline use the collected headings. Highlight still marks every heading or every H1. There is no per-heading locate control, because the page tool does not take an element id.

Links show the collected totals for all links, internal, external, and nofollow. Search matches the accessible name and the URL. Sponsored and UGC appear when the snapshot has those flags. Below a 640px content width the list is stacked rows. Wider reports use a wrapping table. Both include copy. Unsafe URL schemes stay plain text. A visible cap states when the list is longer than the rendered sample. The popup shows 40 matches. The report shows 200.

Images use a 40px thumbnail, lazy loading, and a short fallback when the address is missing or the preview does not load. The report can filter to missing alt, non-empty alt, or images the audit marked broken. A failed thumbnail is not treated as a broken source. Social previews omit the large empty image well and say when the image is missing or did not load. Metadata rows and the editable snippet preview stay on the canvas. The snippet is still a local draft.

Headless Chromium 156.0.8078.47 rendered the healthy, issues, sparse, and sitemap fixtures. Playwright 4 passed, including the drag that scrolls the strip without changing the selected tab. Vitest 53 passed. `vue-tsc`, ESLint, and Prettier passed. Cargo tests were 37 passed and Clippy passed with warnings denied. Firefox MV3 built at 1.23 MB, keeps the add-on id, has no optional host permission, and does not contain `/robots.txt`. Firefox was not loaded as a temporary add-on.

Screenshots inspected: popup Overview, Headings, Links, Metadata, Images, Schema, Social, light, and dark; sidebar Headings, Links, and Metadata at 350px; report Headings at 768px, Links at 1280px, Overview, and Sitemaps. Overflow checks at 320, 350, 360, 420, 768, and 1280 stayed false. The sidebar link list wraps the URL. Sitemap counts, content counts, and performance timings are inline measurements. The JSON-LD block is a separator under the formatted value. Search fields and the snippet draft keep their own borders. Product-owner visual approval is still open.

Last timings on this build: popup 181 ms, report 186 ms. A later audit-only sample on the same build was 186 ms and 207 ms. An earlier sample, before the inline measurements, was 175 ms and 178 ms. UX-3 samples on this machine were 189 ms and 174 ms. Chrome package 1.24 MB. Popup chunk 17.94 KB, down from the UX-3 21.02 KB. Report chunk 77.11 KB, against the UX-3 77.10 KB. WASM 888.28 KB. Firefox package 1.22 MB. No new dependency.

## UX-5 checkpoint (2026-10-27)

Presentation only. Rust scores and sitemap findings are unchanged. The product owner accepted the Save and compare card as the visual reference and rejected the plain UX-4 canvas. Meaningful groups use that card: ivory fill, a border mixed from the theme primary, 18px radius, and a light wash. Headings, links, and findings stay rows inside the card. The snippet draft stays a dashed inset. Open Graph uses a landscape link attachment. X uses a square summary, a landscape large image, or a text fallback when the card type is missing or unsupported. Provenance lines say when a value came from the page, Open Graph, or the X field. A share image is drawn only after it loads. A missing or failed image is one line. The tab strip still drags after 6px, scrolls natively, and moves with the keyboard. A meter shows the scroll position, fades mark a side that still has tabs, and the hint "Drag or swipe to see more" can be dismissed in local storage. There is no All tools menu and no tab arrows.

Headless Chromium 156.0.8078.47 rendered the healthy, issues, sparse, sitemap, and social-large fixtures. Playwright 4 passed, including drag-without-selection, the meter moving when the strip reaches the end, and the sitemap explorer. Vitest 55 passed. `vue-tsc`, ESLint, and Prettier passed. Cargo tests were 37 passed and Clippy passed with warnings denied. Firefox MV3 built at 1.23 MB and the package test passed. Firefox was not loaded as a temporary add-on. A phone was not used.

Screenshots inspected: popup Overview, Issues, Headings, Links, Social, the large-image fixture, tab middle, tab end, light, and dark; sidebar Overview and Social; report Overview, Social, and Sitemaps. The second popup finding stayed inside the 650px viewport. Overflow checks stayed false.

Last timings: popup 189 ms, report 190 ms. An earlier sample on this build was 195 ms and 196 ms. UX-4 samples were 181–186 ms and 186–207 ms. Chrome package 1.25 MB. Popup chunk 13.25 KB. Report chunk 77.24 KB. The shared chunk grew because the previews and tab hint live there. WASM 888.28 KB. Firefox package 1.23 MB. No new dependency.

The snapshot has no `og:site_name`, `twitter:site`, or `twitter:creator`, so those fields are not shown. Highlight still marks a kind, not one row.

## UX-6 checkpoint (2026-10-28)

Interaction only. The UX-5 card, score ring, and tab strip stay. Schema is still the navigation label. Each JSON-LD script is its own block, with the parsed type, `@id`, and `@graph` when those keys exist. Structured mode expands objects and arrays on demand. Closed branches are not mounted. The tree stops at depth 8 and 40 values per node. Raw mode shows the formatted parse, and Copy source keeps the captured text. A note says when the formatted parse differs in spacing. Invalid JSON shows the parser error and the source, and does not draw a tree. Rust findings stay in the check list. The Rich Results test link stays. The local field list is not a rich-result claim.

Links use three groups from the existing classification: internal, external, and everything else. A link is in one group. nofollow, sponsored, and ugc stay badges. Internal starts open when it has rows. Other groups stay closed until opened, and more than one can be open. Search matches the accessible name and the URL, opens groups that have matches, and says when nothing matches. Clearing search restores the earlier open groups. Each group shows 40 rows, then Show more. `LINKS_TRUNCATED` is stated when the snapshot says so. Copy and highlight stay. http and https are the only opened schemes.

Social cards use a 16px stack gap. Full values has a top border so it sits apart from the preview. Notes follow at the same gap. The Facebook and X frames are unchanged.

Headless Chromium 156.0.8078.47 rendered the healthy, issues, sparse, sitemap, and social-large fixtures. Playwright 4 passed. Vitest 59 passed. `vue-tsc`, ESLint, and Prettier passed. Cargo tests were 37 passed and Clippy passed with warnings denied. Firefox MV3 built at 1.24 MB and the package test passed. Firefox was not loaded as a temporary add-on. A phone was not used.

Screenshots inspected: popup Schema collapsed, `@graph` expanded, and raw JSON; invalid Schema in the sidebar and the report; popup Links collapsed, internal open, external open, one row expanded, and an empty search; sidebar Links at 350px; report Links and Schema at 1280px; Social collapsed, expanded, large image, and dark. Overflow checks stayed false. The check filter keeps its icon padding.

Last timings: popup 188 ms, report 179 ms. UX-5 samples were 189 ms and 190 ms. Chrome package 1.25 MB. Popup chunk 11.85 KB. Report chunk 74.47 KB. Shared chunk 173.07 KB. WASM 888.28 KB. Firefox package 1.24 MB. No new dependency.

The healthy fixture now includes a second JSON-LD block with `@graph`, plus an external link and mailto, tel, and anchor links, so the inspectors have real rows. That block trips the existing local field warning. It does not change the score rules.

## M3 checkpoint (2026-10-28)

Site Explorer is a report section. The popup Site tab opens that report and does not start a crawl. Chromium asks for the current origin on Start. Firefox shows the local-only sentence and has no Start button. The crawl runs in the open report, stops when that page closes, and does not resume. Scope is the exact origin. robots.txt failure blocks further fetches. A 404 does not. Disallow is crawl permission, not noindex. Page findings come from the existing Rust audit of source HTML. Duplicate titles and descriptions are comparisons, not a content-duplicate claim and not a second score. Details are in `docs/features/site-explorer.md`. UX-5 and UX-6 were not redesigned. Visual sign-off stays pending.

Headless Chromium 156 rendered a local fixture. Playwright 5 passed: scored audit, install, Firefox package, sitemap explorer, and a same-origin crawl that skips `/secret`, opens a page, exports CSV, stops, and stays within a 360px width. Vitest 67 passed. The in-process fixture crawl took 127 ms for 100 pages and 474 ms for 500 pages. Memory and CPU were not sampled. `vue-tsc`, ESLint, and Prettier passed. Cargo tests were 38 passed and Clippy passed with warnings denied. Firefox MV3 built at 1.25 MB and the package test passed. The Firefox package does not include the crawl network chunk. Firefox was not loaded as a temporary add-on. A phone was not used. Permission denial was not clicked in the browser.

Chrome package 1.28 MB. Popup chunk 12.25 KB. Report chunk 92.87 KB. Shared chunk 175.82 KB. Crawl network chunk 3.62 KB, Chromium only. CSS 47.87 KB. WASM 888.93 KB. Firefox report chunk 76.69 KB and shared chunk 165.64 KB. Audit timings on this run: popup 190 ms, report 180 ms. UX-6 samples were 188 ms and 179 ms. No new dependency.

## M4 checkpoint (2026-10-28)

History still starts with an explicit save. New saves add rule-set version, counts, category scores, and check identifiers to the existing 20-record store. Older saves remain readable. The chart plots saved scores for the open page and joins a line only when the rule set and measured-check count match. One save is not called a trend. A different URL is not added to that chart. Two saves can be compared. Resolved, new, and unchanged checks require saved check results and the same rule set. Missing data stays “Not recorded”. Unmeasured categories stay “Not measured”. CSV, JSON, and HTML export that page only. A site crawl is not saved and still has no site score. Details are in `docs/features/history.md`.

Headless Chromium rendered the history fixtures. Playwright 6 passed: scored audit, install, Firefox package, history, site explorer, and sitemap. Vitest 71 passed. `vue-tsc` passed. Cargo tests were 38 passed and Clippy passed with warnings denied. Firefox MV3 built at 1.28 MB and the package test passed. Firefox was not loaded as a temporary add-on. A phone was not used. M3 permission denial was not clicked.

Screenshots inspected: empty history, one save, several saves, the error and warning chart, resolved and new findings, a legacy save marked not comparable, an unmeasured Performance category, the popup History tab, the sidebar at 350px, 360px, 768px, and dark. The first chart focus ring was a full-height bar and was reduced to a ring. A page with no title now says “Untitled page” instead of the empty-page sentence.

Last timings on the passing audit run: popup 186 ms, report 181 ms. M3 samples were 190 ms and 180 ms. Chrome package 1.31 MB. Popup chunk 12.69 KB. Report chunk 103.85 KB. Shared chunk 181.81 KB. History brief chunk 1.19 KB and saved-report chunk 10.48 KB, loaded when History is opened. CSS 49.30 KB. WASM 888.93 KB. Firefox package 1.28 MB. No new dependency.

## M5 checkpoint (2026-10-28)

Technical compares a separately fetched HTML response, or an HTML file you choose, with the rendered snapshot. The fetch is not the original navigation. Firefox does not fetch. Schema adds bounded Microdata and RDFa beside the existing JSON-LD explorer. Indexability lists observed signals and keeps Google index status unknown. Hreflang on another host stays “not checked”. Image rows show sizes the browser already exposed. New findings are informational and do not change score weights. Details are in `docs/features/advanced-technical.md`.

Headless Chromium rendered a local page whose script changes the title and canonical and injects JSON-LD. Playwright 7 passed: scored audit, install, Firefox package, history, site explorer, sitemap, and the technical comparison. Vitest 82 passed. `vue-tsc` and ESLint passed. Cargo tests were 40 passed (37 rule tests and 3 scoring tests) and Clippy passed with warnings denied. Firefox MV3 built and does not include the HTML-fetch chunk. Firefox was not loaded as a temporary add-on. A phone was not used. M3 permission denial was not clicked. M4 comparison precision, when measured-check counts match but the eligible rule sets differ, remains open.

Screenshots inspected: HTML comparison at 1280, Schema with JSON-LD, Microdata, and RDFa, Images with intrinsic size, the sidebar at 350px, dark Technical, 768px, and the popup at 420px. The popup does not offer Compare HTML. Overflow checks stayed false.

Chrome package 1.35 MB. Popup chunk 12.69 KB, unchanged from M4. Report chunk 115.76 KB (M4 103.85 KB). Shared chunk 191.51 KB (M4 181.81 KB). HTML-fetch chunk 2.14 KB, Chromium only. CSS 50.00 KB. WASM 904.31 KB (M4 888.93 KB). Firefox package 1.32 MB. Firefox report chunk 100.31 KB and shared chunk 179.84 KB, with no HTML-fetch chunk. Audit timings on this run: popup 192 ms, report 193 ms. M4 samples were 186 ms and 181 ms. No new dependency.

## Blockers

- `wasm-bindgen-cli` must stay on 0.2.100. A newer CLI will not match the pinned crate.
- v0.2.0 store submissions and publication are pending; this branch is for build and review preparation.
