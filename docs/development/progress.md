# Progress

Updated: 2026-10-30

## R0.4.0 release-candidate preparation (2026-10-30)

- Product owner confirms basic Firefox Site Explorer functionality in the latest development build. This is runtime evidence for basic operation only; native denial/revocation, robots/request logs, redirect boundaries, limits, cancellation logs, and native Chrome regression are still open.
- Updated root and extension package versions to 0.4.0 for candidate builds. Rust workspace crate versions remain 0.3.0 because they are independent and do not control extension manifest version. Published v0.3.0 artifacts remain untouched. No commit, push, tag, or submission.
- Release scope is being isolated from the dirty working tree. Candidate source is overlaid on `65753ffe` and includes extension F1 changes and relevant docs; modified marketing files and UX review screenshots are excluded. No claim of a committed clean release branch is made.
- Public Privacy Policy Version 6 was fetched and reviewed. It correctly distinguishes current v0.3.0 from v0.4.0 candidate features, but its Site Explorer network-request entry still says Chrome only. It needs a reviewed amendment describing Firefox's explicit, same-origin crawl and retaining open security limitations before store submission. Website repository remains unchanged.
- Automated QA, release ZIPs, source archive rebuild comparison, and checksums are in progress. The candidate is not store-ready until native security checks and the DNS-rebinding risk review are accepted.

## F1-I checkpoint — Firefox Site Explorer parity

- Root cause: Firefox Site Explorer was hidden by a browser guard in `SiteView.vue`; its network adapter was not loaded. Independently, `collectSitemaps` suppressed its robots/sitemap fetch path on Firefox. The shared crawler itself did not require a separate engine.
- Enabled the existing Site Explorer in Firefox only. It uses the same bounded queue, scope checks, robots handling, sitemap parser, page extraction, Rust/WASM analysis, progress model, storage, exports, Stop behavior, and report-unmount cancellation as Chromium. A purpose tag permits robots/sitemap requests only when they are part of an explicitly started Site Explorer crawl. Standalone Sitemap Explorer and unrelated Firefox external checks remain disabled.
- Start requests only the selected HTTP(S) origin within the button handler, confirms the grant, and checks permission again before each fetch. Revocation aborts the crawl; report disposal aborts the controller. Requests omit credentials and referrers. No manifest permission, dependency, version, or crawl limit changed.
- Source limits remain 100 pages, depth 3, concurrency 2, 10-second per-request timeout, 1 MB page body, 5 redirects, 120-second total duration, 400 discovered addresses, and one retry for configured transient failures.
- Current automated results from this checkpoint: Vitest 118 passed, 2 opt-in performance checks skipped; Vue/TypeScript, ESLint and Prettier passed; Playwright 10/10 passed outside the sandbox. Chromium (1.55 MB) and Firefox (1.53 MB) builds succeeded. The generated Firefox manifest remains v0.3.0 with no required host permission; the Firefox-specific install assertion checks the crawl adapter while unrelated optional-network modules remain gated.
- Native Firefox permission prompt/crawl, request-log-backed cancellation and redirect checks were not run in this checkpoint. Actual installed Chrome interactions also remain distinct from Playwright Chromium. See the F1-I manual checklist. **Implementation is verified; Firefox runtime and release readiness remain pending.** The target is v0.4.0; no version bump, commit, push, publication, or M6 work occurred.

## F1-H.1 checkpoint — unified website access and Smart Refresh (2026-10-30)

- Implemented opt-in **Automatic checks** and retained **Individual website access**. The choice is stored locally as a preference; it is separate from the browser's host-permission grant. Automatic access is requested only from the user's button click, for optional HTTP and HTTPS host patterns. Neither manifest adds required website access. Individual mode ignores those broad grants and continues to honor specific site grants.
- Firefox's old URL-missing state can now offer the broad access action without first resolving a URL. Following approval, the sidebar resolves the current tab in its owning window and uses the same local snapshot/Rust-WASM audit path. Per-site prompts continue to use the current validated origin. Permission callbacks recheck mode, grants, tab identity, and request revision before inspection.
- Smart Refresh bypasses the automatic audit cache and extracts a fresh snapshot from the currently selected eligible page; it does not reload the website. Turning Automatic checks off prevents broad access alone from authorizing automatic inspections. Revoking broad access clears the current and bounded in-memory cache state for affected pages; any surviving individual grant remains independently valid.
- Added seven focused lifecycle regressions: synchronous broad request after explicit opt-in, denial without inspection, broad grants not used in Individual mode, fresh manual Refresh, authorized multi-site cache reuse, revoked broad access, and failed permission removal feedback. Added popup Settings coverage for both inspection choices and broad-scope disclosure. Current frontend run: **116 passed / 2 opt-in performance tests skipped**; Vue/TypeScript, ESLint and Prettier passed. Rust format, 40 workspace tests and Clippy passed. Final Chromium and Firefox MV3 builds passed at 1.55 MB and 1.51 MB; both remain 0.3.0. Generated manifests have no required host access and no new API permission.
- Full Playwright passed **10/10** outside the sandbox after sandbox loopback and Chromium launch restrictions. This includes extension installation and manifest checks, not native permission dialog acceptance. The bundled Playwright Chromium runtime does not establish installed Chrome or Firefox behavior.
- Native Chrome/Firefox permission grant, denial, and revocation remain **NOT TESTED** for this new broad workflow. Chrome 156 is installed, but its native extension UI/prompt was not exercised. The Firefox launcher refused to run because snap reported an AppArmor confinement problem. The earlier Firefox 158 temporary add-on and product-owner A/B sidebar verification are historical evidence only; no native prompt interaction was performed in this checkpoint. Follow the focused manual steps in `docs/testing/manual-checklist.md`.
- The existing repeatable F1-E benchmark remains the comparable baseline. This change adds permission API checks but no polling, cache expansion, duplicate WASM initialization, or extra automatic network requests. The current full browser suite printed single-run timings; they are not added as benchmark samples. No website repository or published artifact was modified.
- Release handoff: before shipping, update the public privacy policy and Chrome Web Store / Firefox Add-ons permission disclosures to explain the optional broad HTTP/HTTPS grant, explicit choice, active-page-only local inspection while the sidebar is open, Individual mode, revocation, and separate user-initiated network features. Published v0.3.0 disclosures must continue to describe the published package, which does not include this new workflow.

F1-H.1 implementation is complete for automated verification. Native permission-dialog verification remains outstanding; runtime and release readiness are therefore pending. Version stays 0.3.0; no commit, push, or publication was performed.

## F1-F latest status (2026-10-30)

- Continued the existing F1-E implementation. The product owner reports manual Chrome and Firefox sidebar verification: after pages A and B each receive the existing explicit inspection authorization, switching A/B updates the sidebar automatically; initial access to B still requires the existing Refresh/inspection action. This does not verify same-tab/SPA navigation, multiple windows, restricted pages, or permission revocation.
- Fixed one confirmed cancellation race in the existing crawler. If Stop arrived while awaiting robots policy evaluation, the page fetch could still be scheduled; a network helper could also dispatch when it received an already-aborted signal. Added pre-dispatch abort checks to the crawler, page fetch helper, and sitemap fetch helper. Regression cases cover Stop during policy evaluation and already-cancelled page/sitemap requests.
- Current automated checks: Rust formatting, 40 workspace tests, and Clippy passed; Vue/TypeScript, Vitest **94 passed / 2 opt-in performance cases skipped**, ESLint, and Prettier passed. Chromium and Firefox builds passed. Full Playwright passed **9/9** outside the sandbox after loopback binding and Chromium launch were denied inside it. The authorized local Site Explorer browser test verifies the delayed response closes after Stop and report closure.
- The F1-E repeatable local performance baseline remains the comparable baseline. This cancellation-only change did not alter audit, cache, crawl limits, parsing, or startup paths; single-run timings printed by this Playwright run are not benchmark samples.
- Native Chromium optional-permission denial/retry/revocation and request-log evidence for Stop/report closure remain **NOT VERIFIED**. The browser automation grant is test-only and does not exercise the native permission prompt. Firefox HTML comparison, exports, history reload, and Chrome installed UI checks remain **NOT VERIFIED** in this checkpoint. See `docs/testing/f1-d-manual-handoff.md`.
- No new permission, dependency, telemetry, or UI change. Version remains 0.3.0. The v0.3.0 tag is absent locally; published artifact equivalence remains unestablished. F1 remains **BLOCKED** on native security and remaining browser acceptance evidence.

## F1-F defect register addition

| Severity | Reproduction and root cause                                                                                                                                                                                                                           | Correction                                                                                           | Regression evidence                                                                                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Stop could race with an awaited robots-policy decision: the crawler did not recheck its signal before scheduling the page fetch. Request helpers also installed abort listeners after entry, which does not replay a signal that was already aborted. | Recheck cancellation after the policy await and before dispatch in page and sitemap network helpers. | `tests/site-crawl.test.ts` checks Stop during policy evaluation and a pre-aborted page request; `tests/sitemap.test.ts` checks no request for a pre-cancelled collection. |

Release baseline: v0.3.0 is published (maintainer-confirmed). Current checkout: `chore/rustfmt` at `65753ffe77d5e8dfac079369d44389ab5de04b94`. There is no v0.3.0 tag in this checkout; release-preparation commit `0959792` is an ancestor. Do not bump version or prepare another store submission without approval.

## F1-E latest status (2026-10-30)

- Fixed the P1 sidebar tracking defect. `useAudit` previously only set `stale=true` on activation, leaving the old tab ID and audit visible. The sidebar now follows activation in its owning window, invalidates old data, and starts the local audit automatically when browser access already allows it. The active target is not pinned by the sidebar URL; explicit legacy/test `tabId` sidepanel URLs remain pinned, as do report and popup targets.
- Full navigation events clear old data and refresh on completion. The existing page hook now signals SPA `pushState`, `replaceState`, Back/Forward, and hash routes to an isolated-world listener; the sidebar refreshes only when that message came from its currently selected tab. No `webNavigation` or host permission was added.
- Automatic runs do not request access or start optional probes. Host-access errors show a clear “Select Refresh” permission path. In-memory cache is capped at five tabs and reused only when URL and the existing route generation match. Request revisions discard late results. Pinned report/popup stale notices are preserved.
- Vitest: 91 passed, 2 opt-in performance tests skipped. Rust: 40 passed, format check and Clippy passed. Typecheck, ESLint, Prettier passed. Chrome and Firefox builds passed. Full Playwright: 9/9 passed; new built-Chromium fixture verified A→B→A, same-tab SPA/full navigation, manual Refresh and no optional requests.
- Five-profile F1-E performance repeat: 25 cached A→B→A cycles had 37 ms median (26–42 ms); extension-page JS heap after five cycles had 5.51 MB median across five profiles. Deterministic crawl and sitemap opt-in benchmarks also reran; ranges overlap the prior baseline. See `docs/testing/performance-baseline.md`.
- Actual installed Chrome and Firefox sidebar behavior after this fix remains **NOT VERIFIED**. Playwright Chromium is not installed Chrome, and no post-fix Firefox runtime session was exercised. F1 remains blocked pending the concise Chrome/Firefox manual check and the separate earlier F1-D permission cases.

## F1-E implementation details (2026-10-30)

- Confirmed P1 root cause: the shared audit composable listened for `tabs.onActivated` only to set a stale flag. It did not select the new active tab or run a new local audit. The sidepanel also parsed a `tabId` query parameter, allowing a stale target to pin the sidebar.
- The sidebar now follows the browser window where it opened. Activation and focused-window events select that window's active tab; completed navigation refreshes its local audit; selected-tab closure clears the old result. The full report and popup retain pinned targeting and their existing stale-result warning.
- Automatic refresh performs only the existing local DOM extraction and Rust/WASM scoring. It does not request permissions or trigger crawl, sitemap, header, redirect, link, or PageSpeed operations. Missing access clears prior results and tells the user to use Refresh, which retains the existing gesture-based permission flow. No permissions or version changed.
- Added a bounded five-tab in-memory cache keyed by tab ID, URL, and the existing page generation. Matching cached audits are reused only after current page identity/generation verification. Navigation invalidates the entry. Request revisions discard late responses.
- Existing page history hooks now emit route-change signals for `pushState`, `replaceState`, Back/Forward and hash changes. An isolated-world listener forwards only that signal to the extension; the sidebar checks that the sender is its current active tab before reauditing. No `webNavigation` permission or polling was added.
- Automated verification: nine-case `use-audit.test.ts` covers switching/cache reuse, rapid activation, late response discard, full navigation, inactive-tab cache invalidation, window isolation, permission denial without auto-request, tab closure, SPA route messages, listener cleanup, and pinned report stale-state preservation. New Playwright test passed against the built Chromium extension for A→B→A, SPA route, full navigation, manual Refresh, and no optional requests.
- Final regression: Rust fmt, 40 workspace tests, Clippy, Vitest 91 passed/2 skipped, Vue/TypeScript, ESLint, Prettier, Chrome and Firefox production builds all passed. Full Playwright passed 9/9 after fixing and testing the pinned-report stale regression. Native installed Chrome and Firefox sidebars still need separate runtime confirmation; do not claim those as runtime PASS based on Playwright.

## F1-G targeted corrections (2026-10-30)

- Firefox permission root cause: `prepareTabAccess` attempted `permissions.request({permissions:["tabs"]})` from the sidebar after asynchronous tab resolution. The Firefox manifest has an existing optional `tabs` declaration, but this call is outside an eligible user-action context and it would not grant the page's `activeTab` inspection access. The sidebar now avoids permission requests on Firefox, displays toolbar authorization guidance, and disables the misleading Refresh control for that state. After a successful Firefox toolbar popup audit, a sender-validated runtime message refreshes the matching active tab in the owning sidebar window. Chrome keeps the existing explicit optional-origin prompt path. No manifest permissions changed.
- Score History now uses `brandConfig.assets.icon` (`/brand/icon.png`), visually confirmed as the official head-only fox. The 72px card image is decorative (`alt=""`) because the adjacent heading and copy provide the content. Copy and card styling are unchanged.
- Sidebar-originated “Open Full Report to Crawl” now uses one shared navigation helper. It opens the existing report with `tabId` and `section=site`, then requests closure of the originating panel. Chrome's default/global side panel is closed by owning `windowId`; Firefox uses `sidebarAction.close()` directly in the click call stack. Report launch is settled independently so a rejected/unsupported close does not prevent the report; the UI reports the fallback. No crawl is started.
- Regression coverage: Vitest covers no Firefox permission request, popup-authorized sidebar refresh, Chrome origin permission regression, Chrome window-scoped close, Firefox sidebar close, and close failure while report launch succeeds. The History browser test asserts the brand icon and preserved dimensions, and captures light/dark states.
- F1-G automated validation: Vitest passed 101 with 2 opt-in performance cases skipped; Vue/TypeScript, ESLint, Prettier, Rust formatting, 40 Rust workspace tests, and Clippy passed. Chromium and Firefox production builds passed. The first sandbox Playwright run failed because loopback binding and browser launch are restricted; the approved outside-sandbox rerun passed 9/9. Its History assertions verified `/brand/icon.png`, decorative alt, 72px sizing, and light/dark screenshots. Native installed Chrome and Firefox UI were not exercised in this checkpoint; keep those runtime statuses separate from automated tests.
- No new permissions, dependencies, telemetry, or version changes. Existing website inspection and optional network boundaries are preserved. F1-G manual acceptance remains required for native Firefox activeTab behavior and Chrome/Firefox panel closure.

| Severity | Status                                                     | Reproduction / root cause                                                                                                                                                                | Correction and evidence                                                                                                                                                                                                                        |
| -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Fixed; automated regression passed; native runtime pending | Firefox sidebar Refresh reached `permissions.request` after asynchronous tab lookups for a permission Firefox does not expose as optional; this also loses the gesture-required context. | Sidebar now provides toolbar-action guidance without requesting permission; popup success signals the authorized tab to the matching sidebar. `use-audit.test.ts` covers denied and authorized paths; actual Firefox UI check remains pending. |
| P1       | Fixed; unit and browser assertion added                    | Score History empty state referenced the full-body mascot asset.                                                                                                                         | Use configured official head-only `brand/icon.png`, decorative alt text, and preserve 72px layout. `history.spec.ts` asserts source, alt, sizing and captures themes.                                                                          |
| P1       | Fixed; unit regression passed; native runtime pending      | Shared report launcher created a dashboard tab but never closed the originating native sidebar.                                                                                          | Sidebar-only helper opens the Site deep link and closes the correct global Chrome window panel or Firefox sidebar; close failure does not block report launch. `sidebar.test.ts` covers both APIs and rejected close.                          |

## F1-D previous checkpoint (historical)

- Preserved the four confirmed F1/F1-C fixes. The full eight-test Playwright suite passed in Chromium 156.0.8078.4 with local fixtures, including actual-page highlight/clear, clipboard read-back, scored popup/report/sidebar, site crawl, sitemap, history, and technical views. Review screenshots were redirected to `/tmp`.
- The audit spec's screenshot paths now accept `RANKMISO_REVIEW_SCREENSHOT_DIR`, preventing the regression test from overwriting pre-existing tracked design-review images. A strict measured-check locator ambiguity was fixed and the scored-fixture test passed five consecutive repetitions.
- Chrome 156 installed-build discovery is resolved: actual unpacked v0.3.0 loaded via `Extensions.loadUnpacked`; manager showed enabled extension, ID, and worker. CDP `Extensions.triggerAction` could not use the available page target, so native toolbar/popup/sidebar/report/settings and permission interactions remain unverified. See `docs/testing/f1-d-manual-handoff.md`.
- Firefox temporary add-on evidence remains: real WASM report audit, all 18 destinations, local XML import, and dark-theme persistence. Sidebar, HTML comparison, exports, and saved-history reload need manual confirmation. No signed-install/upgrade claim.
- Added repeated local benchmarks: five each for popup, report, sidebar, 500-section/500-link audit, history render, 100/500-page in-process crawl, and 1,000-URL sitemap parse. Values and reproducible commands are in `docs/testing/performance-baseline.md`. Network latency and installed-browser performance are explicitly not measured.
- Native permission denial/revocation, request-log-backed Stop/close cancellation, redirect boundary, and cross-surface active-tab changes still need maintainer interaction. Edge is unavailable. No new package or permission; version stays 0.3.0.
- Regression checks currently pass: Rust fmt/workspace tests/Clippy, Vitest 82 passed with two opt-in performance cases skipped by default, typecheck, ESLint, Prettier, both production builds, and full Playwright 8/8. **F1-D and F1 remain BLOCKED** pending the manual browser handoff.

## F1 initial post-release checkpoint — historical, superseded by F1-D below (2026-10-30)

- Implemented verified fixes: HTTP(S)-only external link highlighting; RankMiso-owned marker namespacing and safe cleanup; history score/category comparison now uses measured rule IDs, exposes changed coverage, and leaves chart gaps across incompatible saves.
- Added focused Vitest regressions. Full extension suite passed: 83 tests; `vue-tsc`, ESLint, and Prettier passed. Rust workspace passed (40 tests), formatting and Clippy passed.
- Six Playwright Chromium extension tests passed on local fixtures: popup load, Firefox package asset check, History, Site Explorer, Sitemap Explorer, and Technical HTML comparison.
- Firefox 158.0.1 temporary add-on was loaded in an isolated profile. The report ran Rust/WASM scoring (81/100; 25 measured, 10 not measured), all 18 destinations were reachable, theme persisted after reload, and local XML import worked. This is not signed-install/upgrade evidence.
- Installed Chrome launch did not expose an extension service worker in a separate attempt. Edge is unavailable. Real public sites, explicit permission denial/revocation, actual-page highlight/clear cycles, export downloads, and repeatable startup performance remain unverified. See `docs/testing/functional-matrix.md`.
- Chrome and Firefox builds completed. Output sizes: Chrome 1.52 MB, Firefox 1.49 MB, WASM 904.31 KB. Version remains 0.3.0 and browser permissions were not changed.
- F1 is still in progress; do not begin M6. Complete acceptance status and verification gaps are recorded in `docs/testing/functional-matrix.md`.

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

- F1 browser and real-page verification; current evidence and open gaps are in `docs/testing/functional-matrix.md`.
- At this checkpoint, later corrected by F1-C: the Chrome manager had not actually installed the extension because the launch flags were ignored. See the F1-D findings below.

## Not started

- M6 MCP and M7 Search Console. Constraints are in `implementation-plan.md`. Do not treat these as available. M5 is implemented; see the checkpoint below. F1 sign-off remains open.

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

## UX-7 checkpoint (2026-10-28)

Light colors already matched the Miso website. Dark colors now match the website dashboard (`#0f1424` canvas, `#ef5340` primary) instead of the earlier green set. The public site is light only. Dark button text is sumi on that red so small labels clear 4.5:1. Headers use the site's noren stripe. The toolbar and header icon are the website fox, `miso-icon.png`. Empty history shows a 192px copy of the RankMiso fox. Nunito, M PLUS Rounded 1c, and JetBrains Mono stay named and are not downloaded. Scoring, permissions, and inspectors are unchanged. See `docs/branding/design-tokens.md`.

Headless Chromium rendered the scored fixtures. Playwright 7 passed. Vitest 82 passed. `vue-tsc` passed. Cargo tests and Clippy passed with warnings denied. Firefox MV3 built and still omits the HTML-fetch chunk. Firefox was not loaded as a temporary add-on. The website repository was not modified. A side-by-side browser render of the website was not captured. Alignment was checked against `apps/web/app/globals.css` and the brand files.

Screenshots inspected: popup overview, dark social, report overview, dark settings, and the sidebar. The noren stripe, fox mark, cream cards, and score ring are visible. Overflow checks in the audit test stayed false.

Chrome package 1.42 MB (M5 1.35 MB). Firefox package 1.39 MB (M5 1.32 MB). The increase is the fox icon, toolbar sizes, and the 21 KB history illustration. Popup chunk 12.77 KB (M5 12.69 KB). Report chunk 116.04 KB (M5 115.76 KB). Shared chunk 191.59 KB (M5 191.51 KB). CSS 50.81 KB. WASM 904.31 KB, unchanged. Audit timings on this run: popup 195 ms, report 184 ms. M5 samples were 192 ms and 193 ms. No new dependency.

## UX-8 checkpoint (2026-10-28)

The light canvas is white. Cards are white with a 1px neutral border and a light shadow. Miso red stays on the active destination, primary buttons, and the fox mark. The noren stripe is gone. Type uses the platform UI and mono stacks, so the look no longer depends on Nunito being installed. Dark mode keeps the navy surfaces. Scoring and inspectors were not rewritten. The website remains the logo and mascot source. See `docs/branding/design-tokens.md`.

Headless Chromium rendered the scored fixtures. Playwright 7 passed. Vitest 82 passed. `vue-tsc` passed. Rust sources were not changed. Firefox MV3 built and still omits the HTML-fetch chunk. Firefox was not loaded as a temporary add-on.

Screenshots inspected: popup overview, dark social, report overview, sidebar links, and empty history. The canvas is white, card edges are gray, and the score ring and fox remain. Overflow checks in the audit test stayed false.

Chrome package 1.42 MB, the same total as UX-7. Firefox package 1.39 MB. Popup chunk 12.69 KB (UX-7 12.77 KB). Report chunk 115.97 KB (UX-7 116.04 KB). Shared chunk 191.59 KB. CSS 49.90 KB (UX-7 50.81 KB). WASM 904.31 KB. Audit timings on this run: popup 189 ms, report 186 ms. UX-7 samples were 195 ms and 184 ms. No new dependency.

## UX-9 checkpoint (2026-10-28)

Incomplete. The reference directory `docs/design/references/ux9/` is missing, so those screenshots were not inspected. Colors stayed on the UX-8 white system.

Changed composition: the score ring sits beside error, warning, and passed counts and a distribution bar. Categories are a two-column meter grid. Findings are no longer a second card. Headings use count chips and a guided outline. A link row stacks its name above its URL. A structured value sits under its key. Site Explorer opens with listed, fetched, failed, and skipped counts plus a progress meter.

Not changed: history charts, the sitemap tree, image rows, metadata, content, social previews, and the desktop report column. No paired UX-8 baseline screenshots were archived.

Playwright 7 passed. Vitest 82 passed. `vue-tsc` passed. Rust was not re-run. Chrome package 1.43 MB. Firefox package 1.39 MB, still without the HTML-fetch chunk. Popup chunk 12.69 KB. Report chunk 116.40 KB (UX-8 115.97 KB). CSS 51.83 KB (UX-8 49.90 KB). WASM 904.31 KB. Audit timings: popup 196 ms, report 193 ms. UX-8 samples were 189 ms and 186 ms. No new dependency. Firefox was not loaded as a temporary add-on.

## UX-9 completion (2026-10-28)

The six reference images were opened from `/home/ed/docs/design/references/ux9/RankMiso-UX9-References-NEW/`. They are not in this repository. UX-8 screenshots were not reconstructed. The partial UX-9 build was archived under `docs/design/reviews/ux9-continuation/baseline/` before the remaining inspectors changed. Final shots are in `final/`, including the Site Explorer board.

Wide reports use two columns for the overview, history charts, history comparison, social previews, and the selected crawl page. Metadata, content, images, technical rows, international return status, and the sitemap count board were rebuilt in the templates. The sitemap URL table stays full width so addresses do not break mid-word. Colors and scoring did not change.

Playwright 7 passed. Sitemap and the audit spec were run again after the sitemap table fix. Vitest 82 passed. `vue-tsc` passed. ESLint passed. Cargo: 37 seo-rules tests and 3 scoring tests. Clippy passed with warnings denied. Chrome package 1.43 MB. Firefox package 1.40 MB, still without the HTML-fetch chunk. Popup chunk 12.69 KB. Report chunk 119.66 KB (partial UX-9 116.40 KB). CSS 54.67 KB (partial UX-9 51.83 KB). WASM 904.31 KB. Last full-suite timings: popup 191 ms, report 200 ms. Partial UX-9 samples were 196 ms and 193 ms. No new dependency. Firefox was not loaded as a temporary add-on. The screenshot directories were not committed.

## UX-9R checkpoint (2026-10-28)

The popup shell is now the approved vertical rail. The horizontal tab strip is gone from the popup only. The sidebar and the desktop report still use their previous navigation. The hero, finding rows, and focus tiles use the live audit. Export and Settings are on the rail. Screenshots are in `docs/design/reviews/ux9r/`.

Playwright 7 passed. The audit spec passed again after a small hero spacing change. Vitest 82 passed. `vue-tsc` passed. ESLint passed. Rust was not re-run. Chrome package 1.46 MB. Firefox package 1.43 MB, still without the HTML-fetch chunk. Popup chunk 24.95 KB (previous popup 12.69 KB). CSS 64.88 KB. WASM 904.31 KB. Last audit timing: popup 206 ms, report 186 ms. Previous popup sample was 191 ms. No new dependency. Firefox was not loaded as a temporary add-on. Visual sign-off is pending.

## UX-9R.2 checkpoint (2026-10-28)

The other 17 popup destinations now use the same inspector language as the approved rail: a section kicker, a navy measurement where the page has a real summary, compact rows, and the existing audit data. Overview was not rebuilt. The report and the sidebar were not restyled. Site still opens the report before a crawl. Sitemaps still wait for an explicit read in the report. History still loads only saved audits. Export still confirms before download.

The 18 HTML files in `/home/ed/docs/design/references/RankMiso-18-Self-Contained-HTML-Files/` were opened and screenshotted. Copies and the working popup shots are in `docs/design/reviews/ux9r2/`. Notes on the differences are in `NOTES.md` there.

Playwright 7 passed, then the audit, history, and technical specs passed again after the inspector spacing pass. Vitest 82 passed. `vue-tsc` passed. ESLint passed. Cargo: 37 seo-rules tests and 3 scoring tests. Clippy passed with warnings denied. Chrome package 1.48 MB (1,476,645 bytes). Firefox package 1.44 MB (1,444,820 bytes), still without the HTML-fetch chunk. Popup chunk 35.55 KB on Chrome and 36.63 KB on Firefox. CSS 69.37 KB. WASM 904.31 KB. Last audit timing: popup 225 ms, report 186 ms. The UX-9R samples were 206 ms and 186 ms. No new dependency and no new permission. Firefox was not loaded as a temporary add-on. Visual sign-off is pending.

## UX-9R.2 exact (2026-10-28)

The popup was compared screen by screen with the corrected prototype package, in light and dark. Side-by-side shots are in `docs/design/reviews/ux9r2-exact/`. Export now lists three formats and Settings drops the Rules row and the clear button, as chosen by the maintainer. Site and Sitemaps copy the layout and still start in the report. Chrome's extension-page font defaults are reset in the popup. Microdata and RDFa types now show in Schema.

Playwright 7 passed after stale popup selectors were updated. Vitest 82 passed. `vue-tsc` and ESLint passed. Cargo: 37 seo-rules tests and 3 scoring tests. Clippy passed with warnings denied. Chrome package 1.57 MB. Popup audit 249 ms, report 193 ms. No new dependency and no new permission. Firefox was not loaded as a temporary add-on. Visual sign-off is pending.

## UX-9R.3 and UX-9R.4 (2026-10-28)

The sidebar and the full report were rebuilt from the approved sidebar and full-page HTML prototypes. One shell serves both, with a 64px rail in the sidebar and a 232px rail in the report. All 18 destinations use real audit data; prototype sample numbers were not copied. Site crawling stays in the report. Old report components and `main.css` were removed. The popup did not change.

Playwright 7 passed. Vitest 81 passed. `vue-tsc`, ESLint, and Prettier passed. Cargo: 37 seo-rules tests and 3 scoring tests; Clippy passed with warnings denied. Chrome package 1.52 MB, Firefox 1.49 MB. Start-up: sidebar 125 ms, report 122 ms, popup 123 ms. No new dependency and no new permission. Firefox was not loaded as a temporary add-on. Visual sign-off is pending. Matrix: `docs/design/reviews/ux9r3-4/FIDELITY-REPORT.md`.

## Blockers

- `wasm-bindgen-cli` must stay on 0.2.100. A newer CLI will not match the pinned crate.
- No confirmed release blocker is currently declared. F1 verification gaps remain open; v0.3.0 is published and release actions require maintainer approval.

## R0.4.0 release-candidate QA (2026-10-30)

Prepared an isolated v0.4.0 source snapshot from the reported base commit and selected RankMiso changes; unrelated dirty marketing edits and design-review screenshots were excluded. Root and extension package metadata and generated Chrome/Firefox manifests are 0.4.0. Rust crate versions remain independent. The Chrome, Firefox, and Firefox reviewer-source archives are under the ignored `apps/extension/.output/release-candidate/` directory with release notes, QA report, and SHA-256 manifest. Extracted Firefox source rebuilt the same 24 extension files byte-for-byte.

Candidate verification: Rust formatting and Clippy passed; 40 Rust tests passed; TypeScript, ESLint, and Prettier passed; Vitest 118 passed / 2 opt-in performance cases skipped; Playwright 10/10 passed; Chrome and Firefox production builds passed. Product-owner runtime confirmation covers Firefox basic Site Explorer only. Installed Chrome and native permission-denial/revocation, redirect, robots request-log, crawl cancellation, and cap enforcement remain unverified. Current code does not establish DNS-rebinding resistance. Store submission remains blocked pending security boundary review, outstanding native checks, and public Privacy Policy v6 alignment. No commit, tag, push, or submission was made.

## F1-C continuation (2026-10-30)

Continued from the existing F1 checkpoint; preserved the external HTTP(S) highlight classification and measured-rule history comparison fixes. Added an isolated browser interaction regression. The page fixture revealed that a page-owned legacy highlight attribute could suppress RankMiso highlighting. Current RankMiso highlights now use `data-rankmiso-highlight`; the real-page test passed twice through highlight/clear cycles while preserving page-owned marker values and inline styles. It also verified actual clipboard contents for title, heading outline, link, image, and JSON-LD values.

Chrome 156.0.8078.47 ignores the legacy extension launch flags used by the prior branded-Chrome attempt. Using the Chrome DevTools Protocol `Extensions.loadUnpacked` method, the actual production unpacked build loaded in an isolated profile; `chrome://extensions` showed enabled RankMiso 0.3.0, its ID, and an MV3 worker target. This resolves the earlier installation/service-worker ambiguity: the previous command had not installed the extension, and worker absence is not evidence of a RankMiso failure. Further popup/action verification is blocked by `Extensions.triggerAction` returning “Action can only be triggered on a tab target” for the fixture page; no full installed-Chrome audit or real permission-dialog exercise is claimed.

Firefox 158.0.1 temporary add-on: prior successful verification remains valid for the report audit, 18-destination navigation, XML import, and theme persistence. The extended follow-up has not yet established Firefox sidebar, HTML import, or export downloads; signed-install and upgrade behavior were not tested. Firefox manifest retains no optional host permissions and declares required data collection as `none`.

## F1-H checkpoint — cross-browser website permission workflow (2026-10-30)

Firefox's persistent sidebar now presents a per-site access state for a selected HTTP(S) page. The **Allow this website** action calls `permissions.request` synchronously from the button handler for the current scheme and hostname, then rechecks the requested tab, active tab, permission grant, and request revision before starting the existing local snapshot + Rust/WASM audit. Denial and request errors have recoverable states; unsupported URLs fall back to the toolbar route. Permission removal invalidates matching current and cached audits. Chrome keeps its origin prompt behavior. The browser remains authoritative for saved permissions.

Both generated MV3 manifests declare `http://*/*` and `https://*/*` only as optional host eligibility; neither has required host access. Runtime requests are narrowed to one scheme and hostname (WebExtension host patterns do not restrict ports). Firefox still excludes optional network checks, crawling, sitemap discovery, and PageSpeed even after a site grant. Firefox data collection remains `none`; no API permission, dependency, telemetry, or release version was added.

Automated evidence: Vitest covers exact origin patterns, unsupported schemes, allow/deny, no inspection before approval, cross-tab request races, revocation invalidation, and sidebar listener lifecycle. Generated manifest assertions cover Firefox and Chromium. Final run: Rust format, 40 workspace tests, Clippy, Vue/TypeScript, ESLint, Prettier, Vitest 108 passed / 2 opt-in skipped, both production builds, and Playwright 10/10 passed. Five warm cached A/B/A cycles measured 36 ms median (25–55 ms range), within the existing baseline range; this does not measure native permission prompts. Native Firefox grant/deny/revocation prompts have not yet been exercised in this checkpoint; use the F1-H manual procedure in `docs/testing/manual-checklist.md` before claiming runtime verification. The published v0.3.0 policy remains accurate for that installed package; a new policy revision describing optional Firefox site permissions is a release prerequisite. No website repository or published artifact was changed.

Checks in this continuation: Rust format check; 40 workspace tests; Clippy with warnings denied; 83 Vitest tests; Vue/TypeScript typecheck; ESLint; Prettier; seven Playwright tests (the existing screenshot-writing audit test was excluded because the review image directories were already dirty); Chromium build (1.53 MB as reported by build output, WASM 904.31 KB) and Firefox build (1.49 MB, WASM 904.31 KB). The seven Playwright tests include the new real-page highlighting and clipboard check. All passed. The source still contains all seven original Playwright tests; the prior six-count selection omitted the screenshot-writing audit case, not its source coverage.

Still open: installed Chrome popup/full report/audit and permissions; real optional-origin permission denial/revocation; Firefox sidebar, HTML comparison import, and JSON/CSV/HTML downloads; report-close cancellation; and a repeatable multi-sample performance baseline. Static package size is recorded, but is not performance evidence. Functional matrix and handoff hold these items as unverified. F1 technical sign-off remains BLOCKED. v0.3.0 remains published; no version or release artifact changed.

## R0.4.0-G1 security and native acceptance (2026-10-30)

Source review confirmed browser-extension fetch cannot portably pin a checked DNS answer to the eventual connection. Firefox `dns.resolve()` is a separate asynchronous query requiring another permission; Chrome MV3 does not allow ordinary store extensions to use blocking `webRequest` to pin/block each connection. A preflight remains TOCTOU. Literal IPv4/IPv6 address checks were tightened, but DNS rebinding remains unresolved. Robots fetching now shares the request timeout and redirect cap; the 120-second total deadline begins before robots/sitemap preflight and aborts outstanding work; Stop during the transient retry delay cannot launch a retry. Focused regression tests were added. Rebuild candidate packages/source and regenerate checksums.

Installed Chrome 156.0.8078.47 loaded the pre-G1 v0.4 candidate unpacked in a temporary profile and showed it enabled; toolbar-action automation still failed with “Action can only be triggered on a tab target,” so page interactions remain unverified. Firefox native launch is blocked by this environment's Snap confinement error. Product-owner Firefox basic-crawl confirmation remains limited to that scenario. Native security request logs remain outstanding; submission remains blocked.
