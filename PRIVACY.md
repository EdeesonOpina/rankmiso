# Privacy

RankMiso looks at the page you chose to inspect, and it does that work in your browser.

## What stays on your computer

- The rendered page is read only after you open the extension.
- Page text is sent to the local analysis engine in memory. The audit result does not keep the full page text.
- This version does not save page snapshots or reports.
- The only setting stored by default is your appearance preference, in extension storage.

## What this version does not do

- No accounts.
- No analytics or advertising.
- No sale or transfer of browsing data.
- No background crawl of your history.
- No request to PageSpeed Insights, Chrome UX Report, or any other speed-score service.
- Largest Contentful Paint, Cumulative Layout Shift, and Interaction to Next Paint are not collected. The report can show how many resources the current page load requested, from this browser only.
- No request to robots.txt, sitemaps, or other pages unless you press **Check this site** and allow that origin.

## Network

Core analysis does not contact a server. Loading an image thumbnail in the report can request that image from the site you already opened. Highlighting and extraction stay on the page.

**Check this site** asks for permission for that origin only, then fetches the page headers, `/robots.txt`, the first sitemap listed in that file, up to eight hreflang alternates, and public links 20 at a time. Cookies are not sent. Local and private addresses are skipped. The results stay in this browser. PageSpeed Insights is not called.

Opening RankMiso reads the page you invoked it on. Changing to another site closes that access. **Refresh analysis** can ask to read the new site. If the browser hides that address, it can also ask once for permission to see tab addresses, and then uses that only to name the tab you are analyzing. It does not keep a browsing history.

## Clearing data

Open the extension options and choose "Clear saved settings". That removes the stored appearance preference.
