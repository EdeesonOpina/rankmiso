# Changelog

## 0.2.0 — prepared for release (2026-10-24)

- Add a refreshed, more consistent report interface with clearer section spacing, structured-data guidance, and more noticeable page-action controls.
- Save up to 20 comparison summaries locally and compare selected page fields with a current audit. Saving and deletion require explicit user actions.
- Edit title and description drafts in approximate desktop and mobile search snippet previews; edits do not alter the inspected page.
- Add an optional mobile PageSpeed Insights request using a user-provided API key. Results are labeled as Google's lab data and stay outside RankMiso's local score.
- Capture browser-observed LCP and CLS when exposed, and estimate INP from Event Timing interaction entries. Add an explicit, page-scoped INP capture control that continues while the popup is closed and ends on page reload or close.
- Improve technical checks with fresh optional requests for response headers, robots.txt, the first listed sitemap, redirect hops, reciprocal hreflang, and public links in batches of 20.
- Add Playwright coverage for the built Chromium popup and Firefox package integrity, plus a Rust SEO rules benchmark baseline.
- Keep permission requests and network checks opt-in. Core analysis remains in-browser, with no account, telemetry, or backend.

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
