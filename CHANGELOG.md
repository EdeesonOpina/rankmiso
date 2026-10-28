# Changelog

## 0.3.0 — prepared for release (2026-10-28)

- Rebuild the popup as a 420px vertical-rail workspace with a dark page-health hero, compact finding rows, focus areas, and a pinned footer with Open full report and Sidebar. All 18 destinations have purpose-built layouts.
- Rebuild the sidebar as a persistent narrow workbench with a 64px rail, and the full report as a desktop dashboard with a 232px rail and a two-column Overview. All three surfaces share one audit and one visual language, in light, dark, and system themes.
- Add a Sitemap Explorer: read robots.txt sitemap directives and common sitemap paths after a per-site permission, or import a local XML file. Shows the file tree, URL entries, findings, and confirmed CSV exports. Inclusion is not presented as proof of indexing.
- Add a Site Explorer in Chromium: a bounded, user-started crawl of the current origin (up to 100 pages, depth 3) that respects robots.txt, reports duplicate titles and descriptions, and exports CSV or JSON. It can be stopped at any time and never runs in the background.
- Add historical analytics for explicitly saved audits: score, error and warning, and per-category trends; before-and-after comparison of two saves; issue movement; and confirmed history exports. Older saves stay readable.
- Add advanced technical checks: compare the rendered page with separately fetched HTML (Chromium) or a chosen HTML file, and extract Microdata and bounded RDFa alongside JSON-LD.
- Show each finding's evidence, recommendation, and a verification guide with a clearly marked generic example.
- Keep every network feature opt-in and permission-gated. Firefox builds omit the crawl, sitemap discovery over the network, HTML fetch, and PageSpeed Insights, and keep the no-data-collection declaration.
- No new permissions, accounts, telemetry, or backend.

This branch is prepared for v0.3.0 builds. Store packages have not been submitted as v0.3.0.

## 0.2.0 — prepared for release (2026-10-24)

- Add a refreshed, more consistent report interface with clearer section spacing, structured-data guidance, and more noticeable page-action controls.
- Save up to 20 comparison summaries locally and compare selected page fields with a current audit. Saving and deletion require explicit user actions.
- Edit title and description drafts in approximate desktop and mobile search snippet previews; edits do not alter the inspected page.
- Add an optional mobile PageSpeed Insights request using a user-provided API key. Results are labeled as Google's lab data and stay outside RankMiso's local score.
- Capture browser-observed LCP and CLS when exposed, and estimate INP from Event Timing interaction entries. Add an explicit, page-scoped INP capture control that continues while the popup is closed and ends on page reload or close.
- Improve technical checks with fresh optional requests for response headers, robots.txt, the first listed sitemap, redirect hops, reciprocal hreflang, and public links in batches of 20.
- Add Playwright coverage for the built Chromium popup and Firefox package integrity, plus a Rust SEO rules benchmark baseline.
- Keep permission requests and network checks opt-in. Core analysis remains in-browser, with no account, telemetry, or backend.
- Keep PageSpeed Insights and optional technical requests in Chromium builds only; the Firefox build omits both and declares no optional host permissions or data collection.

This branch is prepared for v0.2.0 builds. Store packages have not been submitted as v0.2.0.

## 0.1.x

Initial releases for Chrome and Firefox.

- Local on-page analysis for the rendered page: metadata, headings, content counts, links, images, JSON-LD syntax, social tags, and a limited accessibility sample.
- Weighted checklist score that excludes checks which could not be evaluated.
- Popup, full report, options page, and a side panel or sidebar entry.
- JSON, CSV, and HTML export, plus browser print.
- Page highlighting that can be cleared.
- No accounts, telemetry, or required network services.
- Product name, tagline, and asset paths come from one brand configuration. The toolbar icon is the fox sticker.
- Optional site check, started by the user for one origin: response headers, robots.txt, the first listed sitemap, redirect hops, hreflang return links, and public links 20 at a time. Local and private addresses are skipped.
- JSON-LD field list for a few common types. It is not an official rich-result test.
- The Performance section shows the resource count for this page load. Browser timing values and optional site checks were expanded in 0.2.0.
- Firefox id is `rankmiso@rankmiso.extension`. Listing text and upload steps are in `docs/releases/firefox.md`.
- Refresh reads the current page after a domain change. The browser closes the original access, so the click asks for the new site.

Search rankings, traffic, backlinks, and index coverage are not measured.
