# Privacy

RankMiso looks at the page you chose to inspect, and it does that work in your browser.

## What stays on your computer

- The rendered page is read only after you open the extension.
- Page text is sent to the local analysis engine in memory. The audit result does not keep the full page text.
- Comparison summaries are saved in extension storage only when you choose **Save current comparison**. A new save includes the page URL, title, description, canonical URLs, counts, structured-data types, score, category scores, rule-set version, and check identifiers with their status. It excludes page text, link and image inventories, cookies, and full evidence. Older saves that lack those fields stay as they were. Up to 20 are kept. Saving past that removes the oldest. Nothing is saved during a site crawl.
- In Chromium builds, your optional PageSpeed Insights API key is stored in extension storage on this device if you choose to save it. Firefox does not use the key or make PageSpeed requests.
- No report or page content is saved by default.

## What this version does not do

- No accounts.
- No analytics or advertising.
- No sale or transfer of browsing data.
- No background crawl of your history.
- In Chromium builds, PageSpeed Insights is contacted only when you enter an API key, choose **Run mobile PageSpeed Insights**, and allow Google access. That request sends the page URL and API key to Google. Results are shown separately from the local audit and are not included in its score. The Firefox build does not include this request.
- Largest Contentful Paint and Cumulative Layout Shift are collected from the current browser page load when available. Interaction timing is estimated from the event entries the browser exposes. The Performance section also offers an explicit INP capture control; when started, it observes interactions on that page until stopped or until the page reloads or closes, including while the popup is closed. The next report refresh reads the in-memory measurements. These are browser observations, not field data, and may be unavailable.
- In Chromium builds, no request to robots.txt, sitemaps, or linked pages is made unless you press **Run optional checks** or **Discover sitemaps** and allow that origin. Sitemap discovery stays on that origin, omits cookies, and does not follow a link to another host. The Firefox build disables those optional site requests, imports a sitemap only from a file you choose, and declares no optional host permissions.

## Network

Core analysis does not contact a server. Loading an image thumbnail in the report can request that image from the site you already opened. Highlighting and extraction stay on the page.

INP capture is local and page-scoped. It does not send interaction data to RankMiso or a remote service. Capture data is kept in the page's memory for that page load and is not added to saved comparison summaries.

In Chromium builds, **Run optional checks** asks for permission for that origin only, then fetches the page headers, `/robots.txt`, the first sitemap listed in that file, up to eight hreflang alternates, and public links 20 at a time. Cookies are not sent. Local and private addresses are skipped. The results stay in this browser. The Firefox build has no PageSpeed Insights request or optional technical requests to other websites.

**Compare HTML**, in Chromium, is a separate request for the open page. It runs only after you press the button and allow that origin. Cookies are omitted. The HTML is used for that comparison and is not saved in history. Firefox does not make this request. Choosing an HTML file compares that file locally and does not upload it.

Opening RankMiso reads the page you invoked it on. Changing to another site closes that access. **Refresh analysis** can ask to read the new site. If the browser hides that address, it can also ask once for permission to see tab addresses, and then uses that only to name the tab you are analyzing. It does not keep a browsing history.

## Clearing data

Choose **Clear saved settings** to remove the appearance preference and saved PageSpeed API key. In Reports, delete saved comparisons individually or choose **Delete all saved reports**.
