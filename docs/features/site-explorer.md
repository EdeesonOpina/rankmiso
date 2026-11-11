# Site Explorer

Site Explorer 2.0 is in the v0.6.0 packages submitted to the stores. Store approval is a separate step and is not assumed here. The comparison behavior below is Site Explorer 3.0 and is not in those submitted packages. Published v0.5.1 packages do not include Site Explorer 2.0.

The report section **Site** crawls one origin after you choose **Start crawl**. The popup **Site** tab only opens that report. It does not start a crawl.

Both Chromium and Firefox ask for the starting origin when you start. A denial shows one message and sends no crawl request. The manifests have no required host permission; optional host eligibility is not a grant. Firefox uses the same report-owned crawl controller and network safety functions as Chromium. Automatic Checks never starts a crawl; Site Explorer remains an explicit action. Firefox's standalone Sitemap Explorer and other remote probes remain disabled.

The crawl stays in the open report. Closing the report or choosing Stop aborts it. It does not continue in the background and does not resume by itself. One previous session for the same origin can be shown from local storage. Raw HTML is not stored.

Scope is the starting origin. `www` and the bare host, HTTP and HTTPS, another port, and a subdomain are different origins and are not fetched. Query strings stay part of the address. Fragments do not. `mailto`, `tel`, `javascript`, `data`, and `blob` are ignored. A public page's link to a private or local address is not followed. A crawl that already started on a private origin stays on that origin.

Requests omit cookies and authorization headers. Redirects that leave the origin are recorded and not followed. The browser sends its own User-Agent. RankMiso cannot set one. robots.txt is evaluated for a `RankMiso` group when that group exists, otherwise `*`. That decision is crawl permission. It is not a page-level noindex. A failed robots.txt fetch stops further fetches. A 404 means there are no rules. A failed sitemap fetch is not reported as an empty sitemap.

Discovery reads `Sitemap` lines and the conventional sitemap paths the sitemap explorer already uses. A nested index follows the existing one-level rule. A typed sitemap URL stays on the Sitemaps screen.

Defaults: 100 pages, depth 3, 2 concurrent requests, 10 second timeout, 1 MB body, 5 redirects, 120 seconds, 400 discovered addresses, and one retry after 429, 503, or a timeout. Reaching the page cap marks the session partial. A stopped crawl says it was stopped.

Fetched HTML is parsed as source and scored with the existing Rust/WASM page engine. Site-wide aggregation is a TypeScript layer over those page results and observed crawl links; it does not rerun SEO rules or add a second score. The Site Explorer report provides Overview, Issues, Pages, and Links views. The Overview summary uses the same card as the page Overview: pages analyzed out of the page limit, then analyzed pages grouped by their worst finding (errors, warnings, neither). Pages from sessions saved before Site Explorer 2.0 have no per-page findings and are left out of the "neither" count. There is no site-wide score. Findings retain rule IDs, categories, status and bounded evidence from the existing checks. Missing and empty metadata are counted separately from duplicate groups.

Duplicate title and description normalization applies Unicode NFC, trims and collapses whitespace, and compares case-insensitively. It preserves punctuation and reports the original first observed value. Missing and empty values and unsuccessful pages are excluded. Crawled addresses that redirect to an already analyzed final page are counted once and reported as redirect aliases, so one page is never shown as its own duplicate. A shared title or description is not a claim of duplicate page content.

Internal link analysis uses the URLs already discovered by the crawl; it sends no additional requests. Incoming counts are unique analyzed source pages within this bounded session. “Few incoming links observed” means zero or one such source page. It is not an orphan-page claim. Target states distinguish analyzed, confirmed failed, skipped, and not crawled. Saved older sessions may contain only the first 50 internal targets per page and do not have finding IDs/categories; their page data remains readable, but derived link coverage and issue taxonomy are incomplete.

The original **Export CSV** remains a page-only file with its existing 12-column header and page rows. **Export Site Analysis CSV** is a separate typed export for the summary, issues, duplicate metadata, and observed links. This keeps existing page CSV consumers compatible. JSON retains the Site Explorer schema-version-1 required fields and adds a derived `siteAnalysis` object; the local MCP companion's schema-version-1 reader ignores additive fields. Neither format contains raw HTML. CSV formula characters are prefixed. The existing latest-session local-storage key and origin match are retained; new fields are optional for older saved records. Saved link observations and text are bounded to control storage size.

Every site-wide result describes crawl coverage, not all pages on a website. Failed analyses are excluded from successful-page metrics, and unavailable/not-applicable checks are not passes. Partial results identify their bounded status. Source HTML does not provide rendered image dimensions or prove search-engine indexation. Structured-data validation is limited to the existing local checks.

The 100-page, depth, time, discovery, concurrency, response, redirect, and same-origin boundaries remain unchanged. Firefox uses the shared extraction, aggregation, and view code; browser-specific crawling and permission adapters are unchanged. Native Messaging is outside Site Explorer.

The crawl session persists locally for its origin; no crawl data is uploaded or synchronized.

## Comparisons

**Save for comparison** stores the current crawl for that origin. Saving is explicit. The latest-session restore is unchanged and is not a comparison snapshot. Up to five snapshots are kept per origin, inside a 1.5 MB history budget. Delete removes one snapshot. Clear unreadable history removes only the comparison-history key.

**Compare** chooses a baseline crawl and a later crawl. One of them can be the crawl currently open. Both must be the same origin and the same ruleset. The summary is grouped into crawl coverage, issue changes, and comparison reliability. Coverage shows baseline pages, later pages, newly observed pages, and pages not observed again. Issue changes show new, resolved, unchanged, and not-comparable counts. A lower issue count is not reported as a ranking or traffic gain.

The comparison counts analyzed pages. Fetched and listed counts include every crawl record. A failed page is not analyzed. Several records that redirect to the same final URL count as one analyzed page. A crawl that finishes because it hit a limit is marked **Finished at limit**, and the note says the crawl stopped at that limit.

Changing either crawl selector, or replacing the open crawl, hides the previous comparison until **Compare crawls** is clicked again. Evidence text is not the issue identity. The same page and rule with different complete evidence stays one unchanged issue, with a note that the evidence changed. Shortened evidence cannot create a new or resolved issue. A page the later crawl skipped, failed, or never reached stays not comparable. A link is removed only when the source page was analyzed both times and the stored link list was complete. Pages whose link lists were actually cut, including pages that hit the crawl's 200-anchor cap, stay in the unable-to-compare count and can be expanded. Anchor text is not stored in a comparison snapshot. The saved URL list is what comparison uses.

Comparison snapshots stay in `localStorage` under `rankmiso.siteCrawlHistory`. Internal URLs are stored relative to the origin. Each snapshot stays within 350 KB. The history key stays within 1.75 MB, and each origin still keeps at most five snapshots. A normal 75-page crawl keeps its link lists. A list that still cannot fit is marked incomplete rather than treated as a removed link.

Comparison CSV and JSON are separate files. Their schema version is 1 and the JSON kind is `rankmiso.siteComparison`. Columns are `schemaVersion`, `recordType`, `change`, `reason`, `page`, `ruleId`, `category`, `severity`, `field`, `previous`, `current`, and `detail`. Record types are `schema`, `summary`, `issue`, `page`, `page-field`, `link`, and `duplicate`. Formula characters are prefixed. These files do not replace the 12-column page CSV, the 22-column Site Analysis CSV, or Site Explorer JSON schema version 1. Comparison data is not shared with the MCP companion.

## F1-I verification note

Firefox Site Explorer parity is implemented in the 0.4.0 development tree, not in the published v0.3.0 package. The generated Firefox package and shared crawler tests pass. Actual native Firefox grant/denial, crawl request logs, cancellation, and redirect acceptance still require runtime verification; see `docs/testing/manual-checklist.md`. Do not describe this development capability as available in v0.3.0.
