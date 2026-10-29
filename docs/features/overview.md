# What RankMiso shows

Open the extension on a normal web page. RankMiso reads the rendered page, runs the local engine, and splits the result into a short popup and a full report.

## Popup

The popup is 420 pixels wide. One tab strip lists Overview, Issues, Metadata, Content, Headings, Links, Images, Schema, Social, Technical, Performance, International, Accessibility, Site, and Sitemaps. Tabs scroll instead of wrapping. Overview shows the score, a count of errors, warnings, and passed checks, the measured categories under 100, up to three findings, and a short page summary. The full category list stays behind View all categories. Issues lists the checks, with search, status and category filters, and severity or title sorting. Evidence and examples open from each finding. Metadata, Headings, Links, Images, Schema, and Social open in one selection. Open full report is the primary action and uses the current section. Open sidebar is secondary. The refresh control is an icon. A long title wraps to two lines, and the full title stays in the heading. The Site tab names the host and opens the report. It does not start a crawl. The Sitemaps tab explains the explorer; the table stays in the full report.

**Overview** shows the checklist score, categories that need attention, the first errors and warnings, and the H1, title, description, canonical, and robots values. Copy is available from Metadata for the URL, title, description, and canonical.

**Schema** lists each JSON-LD block, plus Microdata and RDFa extracted from the rendered page. Structured view expands properties. Raw JSON shows the formatted parse, and Copy source keeps the captured text. The full report links to Google's official Rich Results Test. RankMiso checks JSON syntax and a local field list only, not rich-result eligibility. The RDFa reader is a bounded subset. See `docs/features/advanced-technical.md`.

**Headings** lists the outline. Each heading can be copied.

**Links** groups internal, external, and other addresses. nofollow, sponsored, and ugc stay on the row. An http or https address can open in a new tab.

**Images** shows a thumbnail, the name in bold, then the address underneath.

**Social** draws an approximate link card and an X card. The share image loads when the address resolves. Full values sits apart from the preview. The card says when a title, description, or image was borrowed from another tag.

## Full report

The dashboard repeats the score, lists the findings that need attention, and shows the measurement limits from the snapshot. Wide layouts use one left navigation list. Every SEO section is a direct item: Overview, Issues, Metadata, Content, Headings, Links, Images, Schema, Social, Technical, Performance, International, Accessibility, Site, and Sitemaps. History, Export, and Settings follow. Narrow layouts and the sidebar use the same list as one scrolling tab strip. History is the saved comparison list. Site crawls the current origin after you choose Start; see `docs/features/site-explorer.md`. Sitemaps inspects sitemap files after you start discovery or import a file; see `docs/features/sitemaps.md`. Export is the confirmed JSON, CSV, and HTML download. Settings stays available. Opening the report from a popup tab selects the matching section. Chromium builds can run **Check this site** after you allow that origin. Firefox omits that feature and PageSpeed Insights, and does not request optional host access. The popup and the report can open the sidebar when the browser exposes it. Performance shows browser-observed LCP and CLS when available, plus an INP estimate from event entries exposed for the current page. Users can explicitly start INP capture; it continues while the popup is closed and ends on page reload or close. These are not field data. Chromium builds can optionally request PageSpeed Insights with a user-supplied API key and explicit Google access; its results stay separate from the local score.

History can save up to 20 comparison summaries locally after an explicit action. A new save stores selected metadata, the score, category scores, and check identifiers, not page text, links, or complete evidence. The History screen charts those saves for the open page, compares two of them, and can export that page only. Older saves that lack the newer fields stay readable and show “Not recorded” where a value was never stored. Saved reports can be deleted individually or together. See `docs/features/history.md`. The metadata section includes editable desktop and mobile snippet drafts; they change the preview only and never modify the page.

Tables for links, repeated terms, and hreflang can be resized from the header edge. Empty sections use a short title and one sentence, instead of a bare line of text.

Exports for JSON, CSV, and HTML ask for confirmation before a file is created.

## The number on the score

Counts use thousands separators. The score summarizes checks that ran. The result says it is a local summary, and that search engines may rewrite titles and descriptions.
