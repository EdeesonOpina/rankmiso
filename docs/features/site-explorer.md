# Site Explorer

The report section **Site** crawls one origin after you choose **Start crawl**. The popup **Site** tab only opens that report. It does not start a crawl.

Both Chromium and Firefox ask for the starting origin when you start. A denial shows one message and sends no crawl request. The manifests have no required host permission; optional host eligibility is not a grant. Firefox uses the same report-owned crawl controller and network safety functions as Chromium. Automatic Checks never starts a crawl; Site Explorer remains an explicit action. Firefox's standalone Sitemap Explorer and other remote probes remain disabled.

The crawl stays in the open report. Closing the report or choosing Stop aborts it. It does not continue in the background and does not resume by itself. One previous session for the same origin can be shown from local storage. Raw HTML is not stored.

Scope is the starting origin. `www` and the bare host, HTTP and HTTPS, another port, and a subdomain are different origins and are not fetched. Query strings stay part of the address. Fragments do not. `mailto`, `tel`, `javascript`, `data`, and `blob` are ignored. A public page's link to a private or local address is not followed. A crawl that already started on a private origin stays on that origin.

Requests omit cookies and authorization headers. Redirects that leave the origin are recorded and not followed. The browser sends its own User-Agent. RankMiso cannot set one. robots.txt is evaluated for a `RankMiso` group when that group exists, otherwise `*`. That decision is crawl permission. It is not a page-level noindex. A failed robots.txt fetch stops further fetches. A 404 means there are no rules. A failed sitemap fetch is not reported as an empty sitemap.

Discovery reads `Sitemap` lines and the conventional sitemap paths the sitemap explorer already uses. A nested index follows the existing one-level rule. A typed sitemap URL stays on the Sitemaps screen.

Defaults: 100 pages, depth 3, 2 concurrent requests, 10 second timeout, 1 MB body, 5 redirects, 120 seconds, 400 discovered addresses, and one retry after 429, 503, or a timeout. Reaching the page cap marks the session partial. A stopped crawl says it was stopped.

Fetched HTML is parsed as source and scored with the existing page engine. That score stays on the page. The site view has no second score. Duplicate titles and descriptions are comparisons across fetched pages. A shared title is not duplicate content. An orphan candidate is a sitemap URL with no incoming link from the pages this crawl fetched, and only after a finished crawl that did not hit a limit.

CSV and JSON export the session, not raw HTML. CSV formula characters are prefixed.

## F1-I verification note

Firefox Site Explorer parity is implemented in the 0.4.0 development tree, not in the published v0.3.0 package. The generated Firefox package and shared crawler tests pass. Actual native Firefox grant/denial, crawl request logs, cancellation, and redirect acceptance still require runtime verification; see `docs/testing/manual-checklist.md`. Do not describe this development capability as available in v0.3.0.
