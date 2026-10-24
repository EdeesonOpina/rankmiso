# Privacy

RankMiso looks at the page you chose to inspect, and it does that work in your browser.

## What stays on your computer

- The rendered page is read only after you open the extension.
- Page text is sent to the local analysis engine in memory. The audit result does not keep the full page text.
- Comparison summaries are saved in extension storage only when you choose **Save current comparison**. They include the page URL, title, description, canonical URLs, counts, structured-data types, and score. They exclude page text, links, and full audit details. Up to 20 are kept until you delete them.
- Your optional PageSpeed Insights API key is stored in extension storage on this device if you choose to save it.
- No report or page content is saved by default.

## What this version does not do

- No accounts.
- No analytics or advertising.
- No sale or transfer of browsing data.
- No background crawl of your history.
- PageSpeed Insights is contacted only when you enter an API key, choose **Run mobile PageSpeed Insights**, and allow Google access. That request sends the page URL and API key to Google. Results are shown separately from the local audit and are not included in its score.
- Largest Contentful Paint and Cumulative Layout Shift are collected from the current browser page load when available. Interaction timing is estimated from the event entries the browser exposes. The Performance section also offers an explicit INP capture control; when started, it observes interactions on that page until stopped or until the page reloads or closes, including while the popup is closed. The next report refresh reads the in-memory measurements. These are browser observations, not field data, and may be unavailable.
- No request to robots.txt, sitemaps, or other pages unless you press **Check this site** and allow that origin.

## Network

Core analysis does not contact a server. Loading an image thumbnail in the report can request that image from the site you already opened. Highlighting and extraction stay on the page.

INP capture is local and page-scoped. It does not send interaction data to RankMiso or a remote service. Capture data is kept in the page's memory for that page load and is not added to saved comparison summaries.

**Check this site** asks for permission for that origin only, then fetches the page headers, `/robots.txt`, the first sitemap listed in that file, up to eight hreflang alternates, and public links 20 at a time. Cookies are not sent. Local and private addresses are skipped. The results stay in this browser.

Opening RankMiso reads the page you invoked it on. Changing to another site closes that access. **Refresh analysis** can ask to read the new site. If the browser hides that address, it can also ask once for permission to see tab addresses, and then uses that only to name the tab you are analyzing. It does not keep a browsing history.

## Clearing data

Choose **Clear saved settings** to remove the appearance preference and saved PageSpeed API key. In Reports, delete saved comparisons individually or choose **Delete all saved reports**.
