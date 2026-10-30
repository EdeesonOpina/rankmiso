# RankMiso performance baseline

Updated: 2026-10-30. This is a deterministic local-fixture baseline for later comparisons, not a claim about public-network performance or installed Chrome/Firefox. No optimization was justified by this run.

## Environment

- OS: Ubuntu Linux, kernel `6.17.0-41-generic`, x86_64.
- CPU: AMD Ryzen 7 5700G, 8 cores / 16 threads.
- RAM: 14 GiB; at capture, about 4.5 GiB available and 928 MiB swap in use. This is a source of timing variability, not a controlled lab machine.
- Node: 22.23.3. Playwright: 1.64.1.
- Browser: Playwright Chromium / Chrome for Testing 156.0.8078.4. The installed Chrome 156.0.8078.47 runtime was not used for these measurements.
- Fixtures run on loopback or in-process. No public websites were fetched.

## Method

- UI timings use `Date.now()` wall-clock milliseconds. Each Playwright repeat launches a fresh Chromium process and a new temporary extension profile. The OS/browser executable caches may be warm. Fixture tabs and the extension worker are prepared before the measured view; popup is the first measured extension surface, report/sidebar/history are warm within their iteration. Popup/report timings include the Rust/WASM audit work required to show the fixture result; there is no separate WASM initializer stopwatch.
- The scored audit scenario was repeated five times. Popup time runs from navigation to `popup.html` until the page title and measured-check summary render. Full-report time runs from creating/navigating the report until a known finding is visible. Sidebar time runs from `sidepanel.html` navigation until its active-page title renders. A deterministic large-page report uses 500 sections, 500 links, and 500 paragraphs. The large-page heap sample is `performance.memory.usedJSHeapSize` for that report page, not total browser RSS.
- F1-E tab synchronization uses the same local Chromium fixture and extension build. Each repeat performs five cached A→B→A tab-switch cycles; each cycle is timed from before selecting B until the sidebar displays A again. Five independent persistent-context runs produce 25 switch observations and five heap samples. Sidebar heap is `performance.memory.usedJSHeapSize` after those cycles, not process RSS. The composable unit test separately verifies that matching cached audits are reused without another page inspection.
- History time was sampled over five isolated browser-test profiles. It covers report reload after an explicit save until the score-history heading and saved-measurement empty/one-entry state render.
- Site crawl timings are sequential runs of the existing 100-page and 500-page bounded-crawl tests, with the fetch callback returning generated HTML in process. They measure crawl queue and extraction work, **not HTTP/network latency**. Five samples per page count.
- Sitemap timings parse the same generated 1,000-URL XML fixture five times in the existing Vitest/jsdom test environment. They do not include network, gzip, or file-picker time.
- Values are medians with min/max variability. These samples are useful as a local comparison baseline; machine load produced visible spread, so small differences are not meaningful.

## Results

| Operation | Fixture / state | Samples | Median | Min–max |
| --- | --- | ---: | ---: | ---: |
| Popup audit result | `healthy.html`; fresh profile, first extension surface | 5 | 199 ms | 190–238 ms |
| Full report audit result | `issues.html`; warm browser context | 5 | 187 ms | 172–207 ms |
| Sidebar title startup | `issues.html`; warm browser context | 5 | 127 ms | 123–158 ms |
| Large-page audit result | 500 sections / links / paragraphs; warm context | 5 | 361 ms | 267–386 ms |
| Large report page JS heap | same 500-section fixture, after audit | 5 | 18,062,374 bytes | 17,937,038–18,489,440 bytes |
| History render | saved report, report reload to History ready | 5 | 152 ms | 148–155 ms |
| Crawl processing | 100 generated local pages; synthetic fetch callback | 5 | 210 ms | 123–403 ms |
| Crawl processing | 500 generated local pages; synthetic fetch callback, cap reached | 5 | 1,179 ms | 510–2,423 ms |
| Sitemap parsing | 1,000 URL `<urlset>`; XML extraction only | 5 | 43.82 ms | 40.39–84.16 ms |

## F1-E repeat sample (2026-10-30)

The same Ubuntu / Playwright Chromium 156.0.8078.4 environment was used. Five independent extension profiles each ran five A→B→A cycles after A and B had valid cached audits.

| Operation | Fixture / state | Samples | Median | Min–max |
| --- | --- | ---: | ---: | ---: |
| Cached sidebar A→B→A switch cycle | Two authorized local fixture tabs; five cycles in each of five profiles | 25 | 37 ms | 26–42 ms |
| Sidebar JS heap after five cycles | Same extension page and profiles | 5 | 5,514,638 bytes | 5,458,804–5,703,115 bytes |
| Crawl processing | 100 generated local pages; synthetic fetch callback | 5 | 194 ms | 122–472 ms |
| Crawl processing | 500 generated local pages; synthetic fetch callback, cap reached | 5 | 1,114 ms | 498–2,402 ms |
| Sitemap parsing | 1,000 URL `<urlset>`; XML extraction only | 5 | 55.29 ms | 49.54–242.20 ms |

These crawl and sitemap samples have broad, overlapping ranges with the prior baseline, so they do not establish a meaningful regression or improvement. Cached switch measurements are local extension-page timings, not real installed Chrome or Firefox performance claims.

Process memory/RSS, installed-browser cold startup, Firefox timings, real-network crawling, sitemap fetch/decompression, and a separate WASM initialization time were not measured. Do not compare these figures with those environments as if equivalent.

## Reproduction

Run from the repository root after building both packages. Set the screenshot directory to avoid overwriting the tracked UX review images:

```sh
RANKMISO_REVIEW_SCREENSHOT_DIR=/tmp/rankmiso-f1d-review \
  pnpm --filter @rankmiso/extension exec playwright test browser-tests/audit.spec.ts --repeat-each=5

pnpm --filter @rankmiso/extension exec playwright test browser-tests/history.spec.ts --repeat-each=5
RANKMISO_RUN_PERF=1 pnpm --filter @rankmiso/extension exec vitest run tests/site-crawl.test.ts
RANKMISO_RUN_PERF=1 pnpm --filter @rankmiso/extension exec vitest run tests/sitemap.test.ts
pnpm --filter @rankmiso/extension exec playwright test browser-tests/f1-tab-sync.spec.ts --repeat-each=5
```

The Vitest crawl/parser measurements are opt-in so ordinary correctness runs do not inherit benchmark workload. The benchmark checks use the existing Playwright/Vitest infrastructure and add no package or framework dependency. A later milestone should retain the same browser, fixture counts, profile state, timing boundaries, and sample count before comparing results.

## F1-F comparison (2026-10-30)

F1-F only adds cancellation guards before crawler and sitemap network dispatch. It does not change audit startup, active-tab cache behavior, parsing, crawl budgets, or concurrency. The existing F1-E five-sample measurements remain the comparable baseline; no new benchmark run is represented as evidence for this cancellation-only change. Single-run popup/report/sidebar/history timings printed by the full Playwright acceptance run are intentionally excluded from the sample table. The change's scope does not indicate a performance regression, but this is not a new benchmark claim.

## F1-H permission workflow

F1-H adds one browser `permissions.contains` check before a sidebar inspection and a user-initiated `permissions.request` only when access is missing. It does not add polling, background audits, another WASM instance, or persistent permission state. The existing five-sample sidebar/cache baseline remains the comparable reference; no new timing sample is claimed for the permission API path because native Firefox prompt timing is not available through the deterministic benchmark harness. First audit after grant and cached switching need the manual/runtime acceptance pass. Chrome and Firefox production build output remains about 1.54 MB and 1.50 MB respectively in this run; these are package sizes, not runtime performance measurements.

The existing Playwright tab-sync fixture was rerun after using a hostname-level permission in its disposable test manifest. Five warm A/B/A cycles measured 36 ms median (25–55 ms range); sidebar JS heap was 5,781,260 bytes after the cycles. The fixture grants localhost access in its copied test package, so these numbers measure cached switching only, not native permission prompts or installed-browser performance. The range overlaps the prior 37 ms median / 26–42 ms range and does not establish a meaningful change.

## F1-H.1 check (2026-10-30)

The full existing Playwright suite passed in Playwright Chromium 156.0.8078.4. Its one tab-sync test printed five cached A/B/A observations of 63, 82, 42, 47, and 38 ms (median 47 ms; range 38–82 ms) and one extension-page heap reading of 4,855,001 bytes. These five cycles came from one test profile, unlike the five-profile / 25-cycle baseline above, so they are a smoke observation and are **not** used to claim a change or replace the comparable baseline. The same suite printed one popup audit at 191 ms, one report audit at 168 ms, one sidebar audit at 122 ms, one large-page audit at 259 ms, and one history render at 147 ms; single runs are excluded from the benchmark table. No automatic permission prompt timing or native-browser memory was measured. The optional permission API adds no polling or persistent audit state; no optimization is indicated by this evidence.

After the popup Settings and permission-removal feedback changes, the final 10/10 Playwright run printed five more A/B/A cycles in its single temporary profile: 75, 72, 73, 71, and 48 ms (median 72 ms; range 48–75 ms), with one sidebar heap reading of 4,940,563 bytes. Those cycles test existing cached tab synchronization under the fixture's granted access, not the broad native permission path; sample setup differs from the five-profile reference. Treat this as a sanity check only. Final one-run startup values (popup 194 ms, report 178 ms, sidebar 133 ms), large-page result (341 ms), and history render (140 ms) are likewise not benchmark samples. No meaningful performance change can be inferred from these single-context observations.

After adding the Smart Refresh DOM-change assertion, the full Playwright suite again passed 10/10. The tab-sync test observed five cached A/B/A cycles of 25, 31, 73, 72, and 25 ms (median 31 ms; range 25–73 ms), with one sidebar JS heap reading of 4,851,637 bytes. Popup/report/sidebar audit timings were 209/172/119 ms; the large-page audit was 267 ms with an 18,045,968-byte JS heap reading, and history rendered in 138 ms. These are single-profile exploratory observations, not comparable with the established multi-profile benchmark or native browser permission workflows, and they do not establish a performance change.
# F1-I crawl implementation note (2026-10-30)

No native Firefox-versus-Chromium crawl timing comparison was produced for F1-I. The shared browser fixture Playwright suite passed, but its current duration observations are not a five-sample comparable crawl benchmark. No memory or stop-latency claim is made. The implementation adds a permission check before each fetch and an event listener only for the active report crawl; it introduces no polling or persistent cache. Capture browser/runtime version, fixture logs, at least five comparable runs, duration, pages processed, stop-to-no-new-scheduling latency, and memory before using results to claim a performance change.

## R0.4.0 candidate smoke observations (2026-10-30)

The candidate Playwright suite passed and printed one-profile timings: popup 192 ms, report 166 ms, sidebar 125 ms, large-page audit 257 ms, History render 140 ms; large-page JavaScript heap 18,110,614 bytes. Five cached tab-switch cycles in that single profile were 48, 31, 73, 72, and 71 ms (median 71 ms, range 31–73 ms); sidebar heap after switching was 4,904,999 bytes. These are smoke observations from Playwright Chromium, not comparable installed-browser performance samples. They do not establish a regression or improvement and do not replace the existing multi-profile baseline. Firefox native crawl duration/memory and cancellation latency remain unmeasured.

## R0.4.0-G1 (2026-10-30)

No new benchmark sample was collected for the bounded robots reader, whole-crawl deadline, or literal-IP classification changes. The Playwright one-profile observations above predate G1 and are not presented as measurements of the corrected candidate. Native Chrome/Firefox runtime timing, real crawl duration, memory, and Stop latency remain unmeasured. These small control-flow changes add no polling, dependency, or additional cache.
