# UX-9R.3 and UX-9R.4 fidelity

Date: 2026-10-28

## References

`/home/ed/docs/design/references/RankMiso-Sidebar-Fullpage-HTML-Prototypes/RankMiso-Sidebar-Fullpage-UI/` was read: `README.md`, both HTML files, their shared stylesheet, the interaction script, and the per-view markup for all 18 destinations on each surface. All 9 preview PNGs were opened. Both prototypes use one stylesheet with `.sidebar` and `.report` modifiers. Thirteen views share markup across surfaces. Overview, Metadata, Content, Technical, and History differ.

## How it was compared

Each prototype view was rendered in Chromium with the demo frame removed (sidebar 390×860, report 1440×900, light and dark). The built extension was loaded with a local fixture that mirrors the sample content and two saved audits, and each destination was opened by deep link. Images were placed side by side and inspected. They are in the ignored folder `docs/design/reviews/local/ux9r3-4/` (`ref/`, `baseline/`, `r1/`, `final/`) and are not committed.

Widths opened: sidebar 320, 350, 390, 420, 480; report 768, 1024, 1280, 1440. Light and dark at 390 and 1440.

## Matrix

Sidebar and full-page fidelity are judged against the HTML composition. Differences caused by real data (counts, URLs, longer Rust descriptions) are not deviations.

| Destination | Sidebar | Full page | Functionality | Deviations |
|---|---|---|---|---|
| Overview | Match | Match | Pass | Category health lists every category; unmeasured ones say Not measured. Coverage card adds the audit's measurement limits. |
| Issues | Match | Match | Pass | Adds Passed, Note, and Not measured pills when present, plus search, category, and sort. All checks are listed, not only warnings. |
| Metadata | Match | Match | Pass | Adds title and description measurements and a collapsed "Edit preview text" form. Report adds a Measurements card. |
| Content | Match | Match | Pass | Term rows show density and "in title". |
| Headings | Match | Match | Pass | Adds a level filter and Clear highlights. |
| Links | Match | Match | Pass | Adds highlight actions under the groups. |
| Images | Match | Match | Pass | Adds filter pills and an expandable detail row (source, sizes, loading). |
| Schema | Match | Match | Pass | Adds Copy JSON per entity and the Google Rich Results link. |
| Social | Match | Match | Pass | An X `summary` card renders compact, as declared. |
| Technical | Match | Match | Pass | The comparison card is the working HTML compare (fetch or file). Adds Googlebot, Bingbot, response fields, and the optional site check card. |
| Performance | Match | Match | Pass | Fourth KPI is DCL; RankMiso does not record TTFB. Adds INP capture and PageSpeed cards (Chromium). |
| International | Match | Match | Pass | Adds a three-number summary above the list. |
| Accessibility | Match | Match | Pass | — |
| Site | Match | Match | Pass | Sidebar shows the last saved crawl and opens the report to crawl. Report runs Start crawl / Stop, filters, page detail, CSV/JSON export. |
| Sitemaps | Match | Match | Pass | Adds the discovery card (Discover, Import XML, Sitemap URL), findings, pagination, and confirmed exports. |
| History | Match | Match | Pass | Adds a save strip. Report adds issue and category trends, the comparison detail, and compare-with-current. |
| Export | Match | Match | Pass | Six formats instead of three, each behind Confirm. |
| Settings | Match | Match | Pass | The prototype's Compact results and Reduced motion toggles do not exist in RankMiso and were not added; real behavior rows and Clear saved settings are shown. |

Every view ends with a Checks list for its category that opens Issues. The sidebar lists only errors and warnings there.

## Shell

Sidebar: 64px rail, compact header with theme and refresh, independent scrolling, pinned Open full report. Full page: 232px rail with brand, header with status pill, theme and refresh, pinned footer with Open sidebar and Refresh analysis. Below 760px the report rail becomes the compact icon rail, as in the prototype.

## Popup regression

All 18 popup destinations were captured in light and dark before and after. Pixel differences were limited to fixture data (the random server port in URLs and measured timings) on Links, Performance, Sitemaps, Social, and Technical.

## Status

Technical verification: passed for Chromium. Firefox package built; Firefox was not loaded as a temporary add-on. HTML implementation fidelity: matched, with the deviations above. Product-owner visual sign-off: pending.
