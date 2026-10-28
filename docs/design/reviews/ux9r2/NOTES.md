# UX-9R.2 screenshot notes

The HTML files in `references/` are copies of `/home/ed/docs/design/references/RankMiso-18-Self-Contained-HTML-Files/`. Their PNG files are the prototypes opened at 420×735. `final/` is the working popup on the scored local fixture at 420×720. `baseline/` is the UX-9R popup before these inspector changes.

The prototypes use made-up scores, hosts, and crawl counts. The extension shots use the fixture audit.

## What matches

Overview still leads with the dark health hero, Fix next, and focus tiles. The rail is unchanged. Each other destination uses the same header, kicker, and footer.

Issues opens with the live finding count, then the existing severity filters and finding rows. Metadata shows H1, title, description, canonical, robots, and a desktop or mobile snippet. Content shows word count, characters, reading time, readability, and repeated terms. Headings, links, images, and schema keep their existing explorers and add count tiles. Social keeps both previews and the approximation line. Performance shows the browser’s LCP, CLS, INP, and DCL, or an en dash. International shows the document language and says a valid hreflang row was not checked. Accessibility shows the category score and says the sample is not a WCAG certificate. Export lists the working formats behind a confirm step. Settings keeps light, dark, and system, and the version comes from the manifest.

## Deviations

- Site does not show Start, Stop, or the prototype’s fetched, listed, and failed counts. The crawl still starts in the full report.
- Sitemaps does not discover files when the popup opens and does not invent a file or URL count.
- History in this fixture has no saved audit, so it shows the empty state. It does not draw a sample chart.
- Technical does not add a control named Compare HTML. Comparison stays in the report, and the note says a fetched response is not the navigation response.
- Google index status stays unknown. Return links stay “Not checked” until an optional probe runs.
- The snippet editor remains the report preview. The popup preview can switch Desktop and Mobile, and it says the preview does not change the page.
- Issue filters are All, Warnings, and Errors. All still lists every check, with warnings and errors first, so a passing check such as JSON-LD parses stays on the page. The old search, category, and sort controls are not on the popup issues list.
- Focus-area names on Overview can still sit under the footer at 720px. That limit was left from UX-9R.
