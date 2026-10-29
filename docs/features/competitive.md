# Competitive capability matrix

Reviewed 2026-10-27 from public product pages, not from copied interfaces. Sources: Detailed SEO Extension (`detailed.com/extension`), Ahrefs SEO Toolbar (`ahrefs.com/seo-toolbar`), SEOquake (Chrome Web Store listing and public feature descriptions), and MozBar (public MozBar feature descriptions). RankMiso does not include their paid link metrics.

Classes: Implemented, Partially implemented, Missing, Intentionally out of scope.

## On-page SEO

| Capability | RankMiso | Notes |
| --- | --- | --- |
| Metadata | Implemented | Title, description, canonical, robots, and the local snippet preview. |
| Headings | Implemented | H1–H6 outline, counts, copy, and page highlighting. |
| Content | Partially implemented | Word count, reading time, and repeated terms. N-gram keyword density is missing. |
| Image inspection | Implemented | Preview, address, alt state, intrinsic and displayed size when the browser exposed them, filters, and CSV export in the report. |
| Link inspection | Partially implemented | Internal, external, and nofollow sample. Chromium can check a batch of 20 public links. Not every link is fetched. |
| Structured data | Partially implemented | JSON-LD parse and selected fields, plus bounded Microdata and RDFa extraction. This is not a rich-result eligibility test and not a complete RDFa processor. |
| Social metadata | Implemented | Open Graph and X card previews, with warnings when a value is borrowed. |

## Technical SEO

| Capability | RankMiso | Notes |
| --- | --- | --- |
| Robots directives | Partially implemented | Meta robots is local. robots.txt is an optional Chromium site check. Firefox does not request it. |
| Canonicals | Implemented | Missing, multiple, and invalid canonicals are checks. A relative URL or a fragment is informational. It is not Google's selected canonical. |
| Redirects | Partially implemented | Chromium site check lists redirect hops. Firefox does not. |
| HTTP headers | Partially implemented | Optional Chromium site check. Firefox does not request headers. |
| Hreflang | Partially implemented | Alternate tags, plus a Chromium same-host return-link probe. Another host is not checked, and that is not reported as a missing link. |
| Sitemap inspection | Implemented | Bounded explorer: 8 files, 500 URLs, 512 KB. Nested indexes are reported and not followed. Firefox imports XML only. Inclusion is not indexing. |
| Performance observations | Partially implemented | Local LCP, CLS, and a session INP estimate. Optional PageSpeed stays separate from the score. No field data. |

## Productivity

| Capability | RankMiso | Notes |
| --- | --- | --- |
| Search | Implemented | Check list search. |
| Filtering | Implemented | Status and category filters. |
| Copy actions | Implemented | Metadata, headings, and related report values. |
| Exports | Implemented | Confirmed JSON, CSV, and HTML. CSV formula characters are prefixed. |
| Highlighting | Implemented | Existing heading and element highlight controls. |
| Saved comparisons | Implemented | Up to 20 explicit page saves, with a score timeline and a two-save comparison. Not rankings or traffic. |
| Keyboard navigation | Implemented | Tab strip uses arrows, Home, and End. The wide report list is buttons. |
| Direct feature access | Implemented | Metadata through Social are one selection. |

## Advanced tools

| Capability | RankMiso | Notes |
| --- | --- | --- |
| Raw versus rendered HTML | Partially implemented | Compares selected SEO fields with a separately fetched response or a chosen HTML file. It is not the original navigation response and not a full document diff. Firefox does not fetch. |
| SERP analysis | Intentionally out of scope | The snippet preview is a local approximation. No rankings or search volume. |
| Keyword density analysis | Missing | Repeated terms only. Not added in UX-2. |
| Site crawling | Partially implemented | Chromium crawls the current origin after Start, up to 100 pages. Firefox does not crawl. Sitemap discovery alone is not a crawl. |
| Historical analytics | Implemented | Charts use explicit page saves only. A site crawl is not a history series. |
| MCP integration | Missing | Planned as M6. No server or browser bridge exists. |
| Backlinks, DA, PA, DR, UR, traffic | Intentionally out of scope | RankMiso does not invent these metrics. |
| Indexation status | Intentionally out of scope | noindex is a warning. It is not a Google index claim. |
| People Also Ask, user-agent switch | Intentionally out of scope | Not required for the local audit. |
