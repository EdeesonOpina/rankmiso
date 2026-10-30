# F1 native browser verification handoff

These native browser interactions remain unverified. Run them in dedicated temporary browser profiles and send back the observations; do not treat this checklist as a pass until results are recorded.

## F1-F status and shortest remaining run

The product owner has already verified Chrome and Firefox sidebar A/B switching: first inspection of a new page still uses the existing explicit Refresh/inspection action; after both pages have been authorized and inspected, switching between them updates automatically without repeated Refresh. Do not repeat this sequence.

The remaining security acceptance requires browser-native UI. The automated fixture tests grant a test-only host permission and cannot establish a native denial or revocation result.

1. Use a fresh isolated Chrome profile, load the unpacked build below, start the fixture server, and open `http://127.0.0.1:8765/`.
2. Open RankMiso → Site → **Start crawl**. Deny the native origin prompt. Verify the UI reports denial, remains usable, and the server log has no extension crawl requests (`/robots.txt`, `/fast`, `/slow`) after the page's own initial `GET /`.
3. Retry and grant access. Confirm the crawl starts. Stop it while `/slow` is pending; record the UI status, client-close log line, and any requests arriving after Stop. Start again and close the report while `/slow` is pending; record whether new requests stop.
4. In `chrome://extensions` → RankMiso → Details → Site access, revoke the fixture origin while an operation is active. Try a subsequent operation and record the UI and timestamped server log. Existing in-flight requests may finish; distinguish them from newly scheduled requests.
5. Visit `/redirect-same`, `/redirect-other-origin`, and `/many` using the existing crawl workflow. Record same-origin handling, confirm the second-origin fixture receives no request for a rejected redirect, and confirm limited coverage is labeled partial.
6. In an isolated Firefox temporary-add-on profile, perform only the remaining checks not already recorded: Technical → import `apps/extension/browser-tests/fixtures/healthy.html` and a malformed small HTML file; Export → confirm and inspect JSON, CSV, HTML downloads, then cancel one export; History → save, reload, reopen, compare if a second compatible entry exists, and delete only the test entry. The prior XML/theme checks and product-owner A/B sidebar sequence do not need repeating.

Record browser version, build path, PASS/FAIL/BLOCKED for each step, exact observed messages, new filenames/content checks, and fixture request lines. Do not report a denial/revocation pass from a mocked API result.

## Preparation

1. From the repository root, start `node apps/extension/browser-tests/f1-runtime-fixture.mjs` in a terminal. Keep it open. It serves `http://127.0.0.1:8765/`, logs every request, delays `/slow`, disallows `/blocked`, and redirects `/redirect-other-origin` to the controlled second loopback origin `127.0.0.2:8766`.
2. In Chrome, create a dedicated profile using Chrome's profile UI. In Firefox, create a dedicated profile through `about:profiles`. Do not use the developer's normal browser profile.
3. Current unpacked builds (version **0.3.0**):
   - Chrome: `/home/ed/Projects/Rust/rankmiso/apps/extension/.output/chrome-mv3`
   - Firefox: `/home/ed/Projects/Rust/rankmiso/apps/extension/.output/firefox-mv3/manifest.json`
4. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the Chrome path above. In Firefox, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select the Firefox `manifest.json` above.
5. Open `http://127.0.0.1:8765/` in the test profile. Confirm its fixture title is visible. The server console should show this page navigation.

## Chrome installed-extension flow

1. Click RankMiso in the toolbar. Record whether the popup opens, shows **RankMiso F1-D Permission Fixture**, and displays a completed score/findings rather than a loading, stale, or permission error.
2. Open **Full report**. Record the page title and score. Visit Metadata, Headings, Links, Technical, and Site, then return to Overview. Use **Refresh analysis** and confirm the same active page is represented.
3. Use **Open sidebar**. Confirm its title/page matches the report. Navigate to Metadata and Overview, close and reopen the sidebar, and confirm it remains on the same tab.
4. In Settings, select Light, Dark, and System in turn. Close/reopen the popup or report after each choice; record whether the selected mode persists and matches the system mode for System.
5. Navigate the active tab to `http://127.0.0.1:8765/fast`, then reopen RankMiso. Confirm the current page changes to **Fast fixture page**. Close the fixture tab, open RankMiso on a new tab, and confirm it reports an understandable closed/unsupported-page state rather than showing old fixture data.
6. Check the page console and extension service-worker console for errors related to RankMiso. Record any error text and the surface where it occurred.

## Native permission denial, retry, revocation, and crawl limits

Use a fresh dedicated Chrome profile with no prior permission for `http://127.0.0.1`.

1. Open `/` and use the popup's Site action to open the full report. Choose Site → **Start crawl**. When Chrome shows the native optional host permission prompt, deny it.
2. Confirm the crawl stays stopped, RankMiso shows a denial/retry message, and the report still navigates. In the fixture-server log, after the initial browser `GET /`, confirm there is no crawl request such as `GET /robots.txt`, `/fast`, or `/slow`.
3. Retry Start and grant access. Confirm `/robots.txt` and same-origin pages appear in the fixture log. Click **Stop** while `/slow` is pending. Confirm the UI says Stopped and the fixture logs a client close for `/slow` or otherwise shows that pending work ended. Note the last request and wait 16 seconds for any unexpected continuation.
4. Start again, then close the report tab while `/slow` is pending. Watch the server log for 16 seconds. Record whether requests stop after closure.
5. Start once more. In `chrome://extensions` → RankMiso → **Details** → **Site access**, revoke the fixture site's access (use the browser's native access control, such as switching the extension to On click/removing the site entry). Return to the report and try the next operation. Record the UI, the exact time access changed, and whether any request arrived after revocation.
6. Open `/redirect-same` and `/redirect-other-origin` as the crawl start page or discovered links. Confirm the same-origin redirect stays inside `127.0.0.1:8765`, while the crawler does not fetch the second origin. The second-origin log must remain empty for a rejected cross-origin redirect.
7. Open `/many`, start a crawl, and let it reach its configured limit. Confirm the UI labels coverage partial/limited and lists no more than the configured cap. The fixture offers 105 pages; do not interpret this bounded crawl as proof of globally orphaned pages.

## Firefox temporary-add-on flow

The previous Firefox run already confirmed a local WASM audit, all 18 popup/report destinations, XML import, and dark-theme persistence. Focus on these remaining checks.

1. On the fixture page, use Firefox's RankMiso toolbar menu and choose **Run for this visit only** if asked. Open the popup and then Full report. Confirm the fixture title and audit correspond to the current tab.
2. Open the report's **Technical** destination. Choose **Compare an HTML file** and select `apps/extension/browser-tests/fixtures/healthy.html`. Confirm the selected-file comparison says it completed and shows comparison rows/values; confirm no network fetch starts. Repeat with `sparse.html`. Record any error/empty-content handling. A malformed-but-small HTML file is accepted by HTML's forgiving parser unless the UI reports otherwise; record rather than assuming it should be rejected.
3. Open **Sitemaps** → **Import XML**, select `apps/extension/browser-tests/fixtures/sitemap-local.xml`, and confirm both listed fixture URLs appear. This is a spot recheck; local XML import already passed in the prior Firefox runtime run.
4. In Export, test JSON, CSV, and HTML one at a time: choose the format, verify the confirmation, confirm, and check `about:downloads` or the dedicated profile's download folder for a new file. Inspect JSON parseability, CSV header/rows, and HTML escaping. Repeat one format and choose Cancel; confirm no new file appears.
5. Open History and choose **Save current comparison**. Confirm success and one saved report. Reload the report, return to History, and confirm it remains. Open its comparison/details, then delete only that test report and confirm it disappears.
6. In the full report click **Open sidebar**. Confirm the native Firefox sidebar opens, shows the same fixture page/audit, navigates to Metadata and Overview, closes, and reopens. The sidebar uses Firefox's `sidebarAction`; Site crawling and optional network probes remain unsupported there. Confirm the manifest still has no optional host permission and no PageSpeed/site-probe controls.

## Evidence to return

For each item, send `PASS`, `FAIL`, or `BLOCKED`, browser/version, and a short note. Include:

- Screenshots of Chrome popup, sidebar, and report on the fixture; Firefox sidebar and completed HTML comparison.
- The fixture server's timestamped request lines around denial, stop, report closure, revocation, and redirects. Distinguish the user's initial page navigation from extension requests.
- Any RankMiso console/worker error text.
- Export filenames and a short content check for each file; note that Cancel created no file.
- History save/reload/deletion result and whether Settings survived surface close/reopen.

## Restore the test environment

Stop the fixture server with Ctrl-C. Close only the dedicated test-browser profiles. Remove the dedicated browser profiles only if you created them for this procedure and have recorded their exact paths; do not touch the normal Chrome/Firefox profile. Firefox temporary add-ons are removed when the dedicated profile/browser session closes. No repository build files or release packages need to be removed.
