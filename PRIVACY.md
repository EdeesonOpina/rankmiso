# Privacy

This document describes v0.4.0, which has been submitted for store review. The published v0.3.0 extension remains governed by the privacy disclosures shown on its store listing until v0.4.0 is approved and released. RankMiso reads pages only with access granted through the browser.

## What stays on your computer

- In Individual Website Access, a page is read only after you inspect it and grant the required website access. In Automatic Checks, the active page is read only while the RankMiso sidebar is open and the preference is enabled. Only the active tab in that sidebar's window is inspected; other tabs and windows are not enumerated.
- Page text is sent to the local analysis engine in memory. The audit result does not keep the full page text.
- Comparison summaries are saved in extension storage only when you choose **Save current comparison**. A new save includes the page URL, title, description, canonical URLs, counts, structured-data types, score, category scores, rule-set version, and check identifiers with their status. It excludes page text, link and image inventories, cookies, and full evidence. Older saves that lack those fields stay as they were. Up to 20 are kept. Saving past that removes the oldest. Automatic checks never save History entries.
- When you explicitly start Site Explorer, the latest crawl session is kept in extension storage on this device for that origin. RankMiso stores the crawl results, not the fetched raw HTML, and does not automatically resume the crawl. Clear saved settings removes the saved crawl.
- In Chromium builds, your optional PageSpeed Insights API key is stored in extension storage on this device if you choose to save it. Firefox does not use the key or make PageSpeed requests.
- No report or page content is saved by default.

## What this version does not do

- No accounts.
- No analytics or advertising.
- No sale or transfer of browsing data.
- No background crawl of your history and no audit of unrelated background tabs.
- Automatic Checks do not crawl a website. Site Explorer always requires you to choose **Start crawl**.
- In Chromium builds, PageSpeed Insights is contacted only when you enter an API key, choose **Run mobile PageSpeed Insights**, and allow Google access. That request sends the page URL and API key to Google. Results are shown separately from the local audit and are not included in its score. The Firefox build does not include this request.
- Largest Contentful Paint and Cumulative Layout Shift are collected from the current browser page load when available. Interaction timing is estimated from the event entries the browser exposes. The Performance section also offers an explicit INP capture control; when started, it observes interactions on that page until stopped or until the page reloads or closes, including while the popup is closed. The next report refresh reads the in-memory measurements. These are browser observations, not field data, and may be unavailable.
- Both builds declare optional HTTP/HTTPS website access but require browser approval; installation does not grant host access. Automatic Checks asks for broad HTTP/HTTPS access. Individual Website Access requests only the selected site's host pattern. Browser host patterns do not restrict ports. You can deny or revoke access in browser controls.
- In both builds, no request to crawl pages is made until you press **Start crawl** in Site Explorer. A crawl starts from the selected page and stays on the same scheme, hostname, and port. It requests robots.txt and sitemap data only as part of that crawl, applies existing crawl limits and robots rules, omits credentials and referrers, and can be stopped. The crawl results stay on this device. Firefox still disables standalone network Sitemap Explorer discovery, PageSpeed Insights, optional technical probes, and remote HTML comparison.

## Network

Core analysis does not contact a server. Loading an image thumbnail in the report can request that image from the site you already opened. Highlighting and extraction stay on the page.

INP capture is local and page-scoped. It does not send interaction data to RankMiso or a remote service. Capture data is kept in the page's memory for that page load and is not added to saved comparison summaries.

In Chromium builds, **Run optional checks** asks for permission for that origin only, then fetches the page headers, `/robots.txt`, the first sitemap listed in that file, up to eight hreflang alternates, and public links 20 at a time. The Firefox build does not include these probes. Neither build sends cookies or authorization credentials for Site Explorer requests. Site Explorer validates same-origin URLs and manually checks redirects; a redirect that cannot be inspected is blocked. The current implementation rejects literal local/private hostnames for links from public crawls; it cannot guarantee detection of DNS rebinding where a public hostname resolves to a private address.

**Compare HTML**, in Chromium, is a separate request for the open page. It runs only after you press the button and allow that origin. Cookies are omitted. The HTML is used for that comparison and is not saved in history. Firefox does not make this request. Choosing an HTML file compares that file locally and does not upload it.

Opening RankMiso reads the page you invoked it on through the browser's toolbar grant or existing website permission. Automatic Checks can follow the active page only while the sidebar is open and the preference remains enabled. **Refresh** takes a new page snapshot and reruns local analysis; it does not reload the website or start network checks. Individual Website Access remains available if you do not want broad Automatic Checks access.

## Clearing data

Choose **Clear saved settings** to remove the appearance preference and saved PageSpeed API key. In Reports, delete saved comparisons individually or choose **Delete all saved reports**.
