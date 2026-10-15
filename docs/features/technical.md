# Technical SEO

When navigation timing exposes a status, HTTP 4xx and 5xx are errors. A missing or zero status is unavailable, not a pass. Redirect count comes from the same API. **Check this site** lists up to five hops from a fresh request. That list is separate from the navigation-timing count.

Meta refresh is a warning. HTTPS is checked from the page URL. The index-status check states that this tool cannot know whether a search engine has indexed the URL.

**Check this site** is optional. It asks for that origin, then fetches:

- A short allowlist of response headers, including `x-robots-tag`, cache, and content type. Values are truncated. This is a new request, not the original navigation.
- `/robots.txt`, compared with the current path. A `Googlebot` group is used when one matches. Otherwise the check uses `User-agent: *`. The report names the group. HTTP 404 is reported as “no file”, not as a pass that the file exists.
- The first `Sitemap:` line in that file. The report says whether the open URL appears in the fetched `loc` entries. A later sitemap is not fetched.
- Redirect hops from that fresh fetch, up to five. The navigation-timing count is separate.
- Public http(s) links, 20 at a time. The report shows how many exist and how many were requested. **Check 20 more links** continues the list. A clean result changes the technical score only after every requested public link has a result. 4xx and 5xx (except 401, 403, and 429) are warnings.
- Up to eight hreflang alternates, to see whether each page links back.

Local and private addresses are skipped. PageSpeed Insights is not called.

Client-side redirects are not fully detected. The history marker only tells the UI that the document changed.
