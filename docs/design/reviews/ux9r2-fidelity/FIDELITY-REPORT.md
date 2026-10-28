# UX-9R.2 fidelity

The package at `/home/ed/docs/design/references/RankMiso-Complete-UI-Prototypes-Sidebar-Dark-FIXED/RankMiso-Popup-Tab-Prototypes/` was opened. `README.md` and the dark-theme and footer rules in `assets/prototype.css` were read. All 18 root HTML files were rendered in Chromium at 420×735, in light and dark. Those shots are in `references/`. Production light shots are in `production-light/`. Production dark shots are in `production-dark/`.

The prototype sidebar preview was not copied. The footer Sidebar button calls the existing `openSidebar` path.

## Status

This table was replaced on 2026-10-28 after the exact-replication pass. Side-by-side shots, prototype on the left and the working popup on the right, are in `../ux9r2-exact/light/` and `../ux9r2-exact/dark/`. Each popup destination is a component in `apps/extension/src/components/popup/`.

| Destination | Status |
|---|---|
| Overview | MATCH. Finding rows keep the prototype's gap under the title. |
| Issues | MATCH. Descriptions are one line, as in the prototype. |
| Metadata | MATCH. |
| Content | MATCH. |
| Headings | MATCH. Two actions, Highlight headings and Highlight H1. The second H1 is labelled "Second H1". |
| Links | MATCH. |
| Images | MATCH. A thumbnail that fails shows "Preview unavailable" and no details row. |
| Schema | MATCH. Microdata and RDFa items show their type, for example Product and Organization. |
| Social | MATCH. |
| Technical | MATCH in layout. HTML comparison still runs in the report. |
| Performance | MATCH. |
| International | MATCH. |
| Accessibility | MATCH. Row descriptions are one line. |
| Site | MATCH in layout. Start opens the report. Stop and the page search are disabled until a crawl exists. |
| Sitemaps | MATCH in layout. Discover opens the report. The URL search is disabled in the popup. |
| History | MATCH. The chart, before and after, issue movement, and saved audits use saved records. |
| Export | MATCH. JSON, CSV, and HTML report. The links, headings, and images CSVs stay in the report. |
| Settings | MATCH. Light, Dark, System. Rules version and Clear saved settings stay in the report. |

Differences that remain come from the data: the popup shows the measured page, not the prototype's sample counts.

Chrome adds `body{font-size:75%}` and its own font to extension pages. The popup resets that, so line boxes match the prototype.
