# Technical SEO

When navigation timing exposes a status, HTTP 4xx and 5xx are errors. A missing or zero status is unavailable, not a pass. Redirect count comes from the same API. **Check this site** lists up to five hops from a fresh request. That list is separate from the navigation-timing count.

Meta refresh is a warning. HTTPS is checked from the page URL. The index-status check states that this tool cannot know whether a search engine has indexed the URL.

**Check this site** is optional and available in Chromium builds only. It asks for that origin, then fetches:

- A short allowlist of response headers, including `x-robots-tag`, cache, and content type. Values are truncated. This is a new request, not the original navigation.
- `/robots.txt`, compared with the current path. A `Googlebot` group is used when one matches. Otherwise the check uses `User-agent: *`. The report names the group. HTTP 404 is reported as “no file”, not as a pass that the file exists.
- The first `Sitemap:` line in that file. The report says whether the open URL appears in the fetched `loc` entries. A later sitemap is not fetched.
- Redirect hops from that fresh fetch, up to five. The navigation-timing count is separate.
- Public http(s) links, 20 at a time. The report shows how many exist and how many were requested. **Check 20 more links** continues the list. A clean result changes the technical score only after every requested public link has a result. 4xx and 5xx (except 401, 403, and 429) are warnings.
- Up to eight hreflang alternates, to see whether each page links back.

Local and private addresses are skipped.

Chromium builds can optionally request mobile lab data from Google PageSpeed Insights. The user supplies and may store an API key locally, explicitly allows `www.googleapis.com`, and starts each request. RankMiso sends the current page URL and key to Google. The returned Lighthouse score and lab metrics are displayed separately and do not affect the local audit score. Firefox builds omit PageSpeed Insights and optional site requests, and declare no optional host permissions or data collection.

Browser LCP and CLS values come from the current page's performance timeline when exposed. INP is estimated from Event Timing entries, grouping event entries by interaction and using the high-percentile interaction duration used by the INP definition. Users can start explicit INP capture from the Performance section. It observes only the current page load, continues while the popup is closed, and ends when stopped or when the page reloads or closes. The estimate is local browser data, not field data; browsers that do not expose interaction IDs, and pages with no qualifying interactions, show it as unavailable.

Client-side redirects are not fully detected. The history marker only tells the UI that the document changed.
