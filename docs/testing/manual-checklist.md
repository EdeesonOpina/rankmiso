# Manual checklist

## F1-H.1 — Automatic checks and Smart Refresh (native permission dialogs pending)

Use isolated temporary browser profiles. Load the current unpacked builds from `apps/extension/.output/chrome-mv3` in Chrome (`chrome://extensions` → Developer mode → Load unpacked) and `apps/extension/.output/firefox-mv3` in Firefox (`about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json`). Do not use a daily profile. Start with both profiles having no RankMiso site grants.

1. Open two ordinary HTTPS pages in separate tabs, then open the RankMiso sidebar. Confirm the access state identifies Automatic checks and also offers Individual website access; confirm no audit starts and no permission prompt appears before a button click.
2. Click **Enable automatic checks**. Approve the browser's broad HTTP/HTTPS permission prompt. Confirm the current page is audited locally and the page title, host, findings, and score correspond to that tab. The host patterns are broad permissions; the UI disclosure must be visible before approval.
3. Switch A → B → A. Confirm each page appears correctly without another prompt or Refresh. Modify a page's title/description in DevTools, click **Refresh**, and verify the new metadata appears without a page reload.
4. In another fresh profile, click **Enable automatic checks** and deny the native prompt. Confirm no audit or extension error occurs and **Allow websites individually** still works. Revisit the page and confirm RankMiso does not prompt automatically.
5. Select **Allow websites individually** in a third clean profile. Allow one site. Confirm it audits; switch to a different origin and confirm it remains unauthorized. If the browser lacks URL metadata before approval, verify the documented toolbar fallback and that no guessed origin is requested.
6. Enable Automatic checks in a granted profile, then revoke RankMiso's website access through the browser's extension permission controls. Confirm the current result is cleared or access-required, no audit runs after revocation, and saved History remains unchanged. Return to Settings and confirm access is shown as not granted.
7. With broad access granted, switch the preference to Individual website access. Confirm a site covered only by the broad permission is not automatically inspected. A separately granted exact site may remain available.
8. Switch to a restricted browser page (`about:preferences` / `chrome://settings`). Confirm no access request is attempted and no prior website result is shown as current.
9. In Firefox, open Technical, Site, and Sitemaps after enabling Automatic checks. Confirm local audit works, standalone Sitemaps remains local-import-only, optional probes remain unavailable, and no crawl starts until you choose **Start crawl** in Site.

Record browser/version, build path, profile isolation, permission prompt wording/scope, granted/denied/revoked result, current tab and displayed audit identity, whether Refresh was needed, and any runtime errors. Do not record page contents or credentials. Restore the test environment by closing the temporary profile; do not remove or alter the maintainer's normal browser profile or saved History. Native results remain NOT TESTED until the maintainer supplies observations.

Use an unpacked build and a local HTML file, not only a production website.

This checklist does not authorize a version bump or store submission.

Native browser interactions (installed-Chrome acceptance, Firefox HTML comparison, exports and history, permission denial and revocation, and request-log-backed crawl cancellation) stay unverified until someone runs them and records the result. The product owner has verified Chrome and Firefox A/B sidebar switching after initial authorization.

- The popup Overview tab shows the page title, description, H1, canonical, robots, counts, and a score, or a clear error on `chrome://` and `about:` pages.
- A long page title truncates, and the refresh control stays one line.
- Primary buttons use readable foreground text against the theme primary color in light and dark modes. Card and table lines stay quiet in both themes.
- Counts of 1,000 or more show a comma.
- The Schema tab shows each JSON-LD block, a structured tree, and raw JSON. Copy source keeps the captured text. Invalid JSON shows the error and the source. Microdata and RDFa, when present, appear as their own groups and are not described as a rich-result test.
- The full report's Structured data section has a clearly labeled Google Rich Results Test action. It opens Google's official test in a new tab and does not claim RankMiso has validated eligibility.
- The Images tab shows a thumbnail, alt text, and the image address in one horizontal row. Extra images are described in a centered line that points to the full report.
- The Social tab shows a link card and an X card. A page with `og:image` displays that image. A page without one says the image is missing.
- The check filter field shows a search icon.
- Choosing an export shows Confirm and Cancel before a file downloads. Print is not offered.
- A page with no title shows an error, not a pass.
- An image without an alt attribute is an error. An image with `alt=""` is a note.
- Highlight headings, then clear highlights. The page outline returns to its previous look.
- Refresh after a client-side URL change shows the stale notice or a new result.
- JSON export downloads. A CSV cell beginning with `=` is prefixed.
- The HTML report contains no executable script from the page text.
- Save a report comparison, verify it survives reopening the report, compare it with the current page, then delete one and delete all.
- Save the same page twice and confirm the score chart shows both times, including two saves on the same day. Confirm a different URL is not drawn on that chart.
- Confirm a category that was not measured says “Not measured”, and an older save without category data says “Not recorded”.
- Edit the metadata preview title and description; verify it changes only the preview and that **Restore page values** resets both fields.
- Save a PageSpeed API key, verify no request occurs until **Run mobile PageSpeed Insights** is pressed, and verify the permission prompt can be denied without sending the request.
- With Google access allowed and a valid key, verify PSI lab results appear separately from the local score; clear settings and confirm the key is removed.
- On a browser exposing Event Timing interaction IDs, start INP capture, close the popup, interact with the page, reopen or refresh the report, and verify the estimate updates. Stop capture and verify it ends; reload the page and verify capture does not persist across page loads. Verify unsupported browsers and pages with no qualifying interactions remain clearly unavailable.
- System, light, and dark appearance all keep text readable.
- The side panel opens on Chrome. On a browser without the API, the button is absent and the dashboard still works.
- **F1-E active-tab acceptance — actual Chrome and actual Firefox, separately:** load `apps/extension/.output/chrome-mv3` unpacked in Chrome and `apps/extension/.output/firefox-mv3` as a temporary add-on in Firefox. Before switching, ensure RankMiso already has inspection access to both HTTP(S) test tabs using each browser's existing explicit permission flow. Open the native sidebar on Tab A and wait for its score. Select Tab B and verify title, hostname, URL (hover the hostname), score, and findings update without selecting Refresh. Switch back and verify the matching result returns. Navigate the active tab to a new route, use Back/Forward, and verify old results clear and the new page appears. Then select a restricted page and verify the previous score disappears and a permission/unsupported state appears; use Chrome's explicit Refresh permission flow or Firefox's toolbar popup authorization as appropriate. Record browser/version, extension package path, source and destination URLs, access state, before/after title and score, whether Refresh/toolbar action was needed, console errors, and any discrepancy. Do not treat Playwright Chromium as installed Chrome or Firefox evidence.
- In Firefox, verify the Technical section shows the local-only notice and has no optional site-check buttons; verify the Performance section has no PageSpeed key/request controls. Invoke RankMiso on a different page and confirm the extension can still read it through `activeTab` without an optional origin prompt.
- Historical v0.3.0 behavior: Firefox Site Explorer had no Start button. The v0.4.0 candidate enables the shared user-started crawl; use the F1-I runtime checklist below.
- In Chromium, open Technical and confirm Compare HTML does nothing until you allow that origin. Confirm the result says the response was fetched separately and was not saved. In Firefox, confirm there is no Compare HTML button and that choosing an HTML file still compares it.
- Confirm Google index status stays Unknown, and that an hreflang URL on another host says the return link was not checked.
- In Chromium, deny the origin prompt on Start crawl and confirm the crawl does not start. Allow it on a local fixture, confirm Stop ends the crawl, and confirm closing the report does not continue it.

## F1-G: Firefox inspection authorization and sidebar report transition

Use the current development builds: Chrome `apps/extension/.output/chrome-mv3` (Load unpacked) and Firefox `apps/extension/.output/firefox-mv3` (temporary add-on). Use two ordinary HTTP(S) fixture tabs. These checks do not start crawling or request network probes.

### Firefox authorization

1. In the Firefox temporary add-on, inspect Website A with the RankMiso toolbar action/popup.
2. Switch to an uninspected Website B. Confirm the sidebar clears A's results and displays toolbar-action guidance; it must not show a generic Refresh that attempts `permissions.request`.
3. Click the RankMiso toolbar icon while B is active, allow the popup's local audit to finish, and close the popup. Confirm the sidebar updates to B without a permission exception.
4. Switch A↔B after both have been inspected. Confirm the matching title/host/score returns without another Refresh.
5. Confirm no `permissions.request` error appears in the extension console and no optional network request is initiated.

### Sidebar to Site report

Repeat separately in current Chrome and Firefox builds:

1. Open a website tab, then open RankMiso's native sidebar and select **Site**.
2. Click **Open Full Report to Crawl**.
3. Confirm a full report opens with the same tab context and Site Explorer selected. Confirm the original website tab remains open, only the originating RankMiso sidebar closes, and no crawl starts.
4. If closure is unsupported/rejected, confirm the report still opens and RankMiso explains how to close the panel manually.
5. If two browser windows are available, leave a RankMiso panel open in Window B and launch the report from Window A; only A's panel should close.

Record browser/version, extension build path, source page, whether access was already granted, before/after title and score, whether the panel closed, report destination, crawl state, console errors, and any message. Do not report a native runtime PASS until these observations are supplied.

# F1-C runtime status update — 2026-10-30

- Chrome 156.0.8078.47: actual unpacked extension loaded through DevTools Protocol into an isolated profile; `chrome://extensions` showed RankMiso 0.3.0 enabled with an ID and MV3 worker. The action-trigger CDP method failed to accept the Playwright page target, so popup, active-tab audit, sidebar, full report, browser permission prompt and settings persistence remain unchecked in installed Chrome.
- Firefox 158.0.1 temporary add-on: previously exercised report audit, all 18 popup/report destinations, local XML import and theme persistence. The follow-up local HTML comparison did not expose a confirmed completion state; JSON/CSV/HTML downloads, persisted history reload and actual sidebar still need manual verification. Signed install and upgrade are not covered.
- Chromium real-page interaction regression: repeated headings/links highlight and clear, page-owned legacy marker and inline styles remain intact, and clipboard contents were read back for title, outline, link, image and JSON-LD. Clipboard failure and empty-value feedback remain unchecked.
- Real optional permission denial/revocation and report-close cancellation remain unchecked. Site stop is covered by existing local-fixture browser test; mocked permission cases are not native dialog evidence.
- No repeatable five-sample UI/audit/performance baseline was captured in this run. The package sizes in progress notes are build outputs, not runtime performance measurements.
- Microsoft Edge is unavailable. `EDGE RUNTIME: NOT TESTED — BROWSER UNAVAILABLE`.

## F1-H: Firefox optional website access

Start the deterministic server from the repository root with `node apps/extension/browser-tests/f1-runtime-fixture.mjs`. It serves `http://127.0.0.1:8765/` and `http://127.0.0.2:8766/target` and logs each request. Use Firefox 158+ with the newly built temporary add-on at `apps/extension/.output/firefox-mv3` and an isolated profile. Install it through `about:debugging` → This Firefox → Load Temporary Add-on → select the build's `manifest.json`. Do not use `about:`, `file:`, or extension pages for permission requests.

1. Open `http://127.0.0.1:8765/` in tab A and `http://127.0.0.2:8766/target` in tab B. Open the persistent RankMiso sidebar on A without granting the site. Confirm **Check this website**, the trusted hostname, **Allow this website**, **Not now**, and the toolbar fallback. Confirm no page audit is shown as current.
2. Click **Allow this website** once. Accept Firefox's native prompt. Confirm it names only the selected site, the prompt closes, and a local SEO result for A appears without a gesture exception in the browser console.
3. Switch to B. Confirm B is not implicitly authorized by A. Click Allow and deny the native prompt. Confirm no SEO result appears and the denied state offers Try again and Not now; confirm RankMiso remains usable.
4. Retry B and grant access. Confirm its local audit appears. Switch A → B → A several times; confirm hostname, title and score follow the selected page without another prompt or Refresh.
5. In Firefox Add-ons Manager, remove RankMiso's permission for A. Return to A; confirm current/cached data is not represented as a currently authorized inspection and no new extraction occurs until access is granted again.
6. Switch to `about:config`. Confirm no permission prompt and an unavailable-page state.
7. After granting a site, confirm no crawl, sitemap discovery, HTTP probe, link check or PageSpeed request starts automatically. Firefox network-only tools remain unavailable.

## F1-H: Chrome regression

Use Chrome 156+ with the unpacked build at `apps/extension/.output/chrome-mv3` in a clean isolated profile. Start the same local fixture server. Open the 127.0.0.1 page, open the RankMiso sidebar, use the existing site access action if prompted, and confirm local audit results. Switch to 127.0.0.2 and confirm it does not inherit the first site's grant. Approve the second site, switch back and forth, and confirm results follow the active tab without another prompt. Use the popup toolbar action, manual Refresh, and full report once to check they still work. Confirm no crawl/probe begins automatically. Revoke each site from Chrome's extension Site access controls and verify the sidebar returns to the access-required state.

Record browser/version, exact build, grant/deny/revoke observations, console errors, whether Refresh was needed, and the fixture server log. Expected server traffic is page navigation only; permission grants must not trigger `/robots.txt`, `/sitemap.xml`, or additional page requests. Do not mark native permission behavior PASS from mocked tests alone. Stop the server with Ctrl-C after testing. The toolbar action remains the single-page `activeTab` fallback.

# F1-I — Firefox Site Explorer runtime acceptance

Use an isolated Firefox profile and the built temporary add-on at `apps/extension/.output/firefox-mv3/manifest.json`. Start `node apps/extension/browser-tests/f1-runtime-fixture.mjs`; it serves `http://127.0.0.1:8765/` and a redirect-boundary origin at `http://127.0.0.2:8766/target`, and logs requests. The fixture uses loopback, so record whether the installed browser permits that test origin; do not weaken production checks if the browser treats it specially. Confirm no site grant exists before beginning.

1. In Firefox, load the temporary add-on, open the primary fixture, then open the full RankMiso report → Site. Confirm opening the report did not start a crawl.
2. Click **Start crawl**. Approve Firefox's native request for the selected origin. Confirm the UI enters progress and the server log shows `/robots.txt` followed by same-origin eligible pages. Confirm `/blocked` is not requested. Confirm page observations and a completed/partial status appear.
3. Repeat from a clean permission state and deny. Confirm no crawler request appears in server logs, an actionable denial message appears, and popup/sidebar/local audit functionality remains usable.
4. Select a site whose fixture responds at `/many`; confirm the source-controlled page cap and partial label. Run a slow `/slow` crawl and click Stop; distinguish already in-flight requests from any newly scheduled request. Repeat and close the full report; confirm no later requests are scheduled.
5. Revoke site access during a slow crawl through Firefox's extension permission controls. Confirm pending work aborts and no new request is made after permission removal is observed.
6. Test `/redirect-same` and `/redirect-other-origin`. Confirm same-origin handling is recorded and the second-origin server receives no request. If Firefox returns an opaque manual redirect, verify it is reported blocked rather than followed. Confirm redirect loops/limits do not escape the origin.
7. Repeat a small authorized crawl in Chrome using the unpacked build. Confirm equivalent scope, robots, Stop, and report-close behavior.

Record browser/version, exact build directory, permissions before/after, fixture URL, listed/processed counts, terminal status, console errors, and timestamped logs from both fixture origins. Stop the fixture server with Ctrl-C. Do not mark native Firefox or installed Chrome PASS until this evidence is recorded. These checks exercise development builds only; published v0.3.0 remains unchanged.

## v0.4.0 release-candidate manual acceptance still required

The product owner separately confirmed basic Firefox Site Explorer operation in the latest development build. Do not treat that as a full security pass. In isolated current Firefox and installed Chrome profiles, capture broad/per-site permission grant, denial and revocation; current-page identity and Smart Refresh; crawl fixture server logs for robots exclusions, redirects, Stop/report closure, request limits and unauthorized destinations; History/export; and browser console errors. Record exact browser versions, extension build, target origin, and logs. Installed Chrome and the native security cases remain unverified in the release-candidate QA report. Do not use Playwright bundled Chromium as a substitute.

## R0.4.0-G1 native security acceptance

Use the rebuilt v0.4.0 candidate in isolated Firefox and Chrome profiles. Start `f1-runtime-fixture.mjs`, grant only its test origin, and save timestamped server logs. Verify denial/revocation sends no new crawl requests; `/robots.txt` exclusions are respected; redirects, loops, and local destinations are blocked as expected; Stop/report closure schedules no further requests; and exceeding 100 pages shows partial results. Record browser/build, permissions, origin, and request counts. A DNS-rebinding test requires an isolated controlled DNS/network environment; do not weaken production checks to enable it. If requests to a public hostname resolving private are not blocked before connection, the release gate remains blocked. A DNS preflight result does not prove connection safety.

## M6.2 — browser-to-MCP audit sharing

### Beginner quick test: isolated Chrome

From the repository root, run `pnpm mcp:dev`. It builds the companion and extension, creates a temporary Chrome profile/audit folder, registers the exact development extension ID inside that profile, and opens RankMiso on AI Integrations beside a local test page. In the opened RankMiso window:

1. Click **Enable local sharing** and approve Chrome's Native Messaging permission prompt. If Chrome leaves it unresolved, RankMiso changes to **Awaiting Permission** instead of remaining at “Checking…”. When permission is granted later, RankMiso rechecks the companion automatically. If Chrome requires an extension reload to expose `runtime.connectNative`, RankMiso shows that recovery message and the check can be retried after reload. After enabling, switch between Website A and Website B and return to AI Integrations: once the 15-second status freshness expires, RankMiso should automatically revalidate the companion without another click or permission prompt. Disable and re-enable local sharing to verify the preference and explicit permission boundary.
2. Open the local page's RankMiso full report, choose **Export → Share with MCP**, review the confirmation and approve.
3. In AI Integrations, confirm **Connected** and the saved audit is listed with analyzed/shared timestamps and a short snapshot ID. The **Audit Shared Successfully** toast should appear only after the host acknowledges persistence. Remove one snapshot there and confirm **Audit Removed** appears after acknowledgement; if another snapshot of the same website remains, it must remain listed.
4. Close the isolated Chrome window. The launcher removes its temporary registration and test data.

The launcher does not modify a normal browser profile or any existing registration. The real permission prompt must be clicked in the visible browser. Grant, deny, revocation, and reauthorization outcomes must be recorded separately; an automated run with pregranted permission is not evidence for those cases. The latest prior visible run reached **Awaiting Permission**, but the window closed before a grant; current automatic AI Integrations checks and the newest notification UI still need a visible-session check.

### Full lifecycle checks

Run from a temporary browser profile and a temporary `HOME`/`XDG_CONFIG_HOME`; do not edit the user's regular browser registration. Build both Rust executables and the target browser extension. Register `rankmiso-mcp-native-host` for that exact unpacked extension ID with `scripts/native-host/install.py`. Keep the audit directory explicit and existing.

- **Chrome:** verify the built manifest lists `nativeMessaging` only under `optional_permissions`. Use AI Integrations to enable local sharing and grant it. Verify deny leaves the host unused; grant and use **Share with MCP** from a full report. Confirm website, audit time, size and local destination, then approve. Verify a `rankmiso-shared-*.json` file appears, the AI Integrations list can remove it, and MCP listing/issue retrieval sees it. Revoke permission in extension settings and verify no new native call succeeds while prior files remain.
- **Firefox:** use `allowed_extensions: ["rankmiso@rankmiso.extension"]`, not Chrome's `allowed_origins`. Repeat permission grant/deny, share, MCP retrieval, removal and revocation. Record Firefox version and temporary profile path.
- **Claude Code/Codex:** after sharing, use the existing MCP configuration to retrieve the audit and issues; do not add another server.
- **Large audit:** verify the confirmation explains the 900 KiB Native Messaging limit and offers the existing JSON export fallback; no measurements may be truncated.
- **Disable/removal:** Disable local sharing clears the saved opt-in and visible audit list; it does not revoke browser permission or delete snapshots. Removing a file prevents future MCP retrieval but cannot erase information previously returned to an AI client.

Automated tests do not count as native permission or real browser verification. Record browser/client versions, exact extension build, actual permission outcomes, native host process exit, local files, MCP tool responses and any console diagnostics. Current M6.2 live results are recorded in the development handoff.

### M6.2.1 results and remaining manual checks

The sandboxed Google Chrome 156.0.8078.47 E2E passes host discovery, ping, explicit share, snapshot persistence, all five existing MCP tool calls, AI Integrations list/removal, and failure to retrieve a removed snapshot. It uses a temporary Chrome profile, audit directory, and helper configuration without overriding Chrome's HOME/XDG environment. Its observed extension ID was `fefdclmdaficlhhagamdacojbkhickke`. The production manifest remains optional. A separate Chrome 156.0.8078.47 fresh-profile run used extension ID `agdpmgkibcepjolhomcgaffklofjbcai`, observed `nativeMessaging=false` before opening AI Integrations, then triggered the real `permissions.request` path. After 1.5 seconds, permission remained absent, the UI still showed “Checking…”, and the request had not reached the host. This is an unresolved browser prompt, not a denial result; no snapshot was written. Vitest covers an explicit denied return, cancellation, and blocked calls after permission is absent, but those are not substitutes for browser grant/deny/revoke.

The failing Playwright `channel: "chromium"` executable was Chrome for Testing 156.0.8078.4. Root cause: the harness used an explicit custom `--user-data-dir` but installed the manifest in Chromium's default directory. Current Chromium looked under `<user-data-dir>/NativeMessagingHosts`; a controlled wrong-profile registration returned `Specified native messaging host not found.` The corrected sandboxed Chrome run recorded the manifest at `/tmp/.../chrome-profile/NativeMessagingHosts/com.misoecosystem.rankmiso.json`. Host launch and share were acknowledged; the 32,638-byte snapshot was readable through the MCP server. Chrome's narrow native-messaging VLOG filters produced no matching log lines, so the exact browser API failure and registration paths are the direct lookup evidence.

The system Firefox Snap remains blocked by AppArmor. An official Mozilla Linux archive was extracted to `/tmp/rankmiso-firefox-bin`; Firefox 159.0 launched with Mozilla geckodriver 0.37.1 and a temporary geckodriver profile. The existing 0.4.0 Firefox build installed temporarily and Firefox reported the exact ID `rankmiso@rankmiso.extension`, active. Separately, the helper created `/tmp/rankmiso-firefox-registration-evidence/home/.mozilla/native-messaging-hosts/com.misoecosystem.rankmiso.json` with `type: stdio` and only `allowed_extensions: ["rankmiso@rankmiso.extension"]`, then removed it. Full runtime verification remains NOT VERIFIED: standard WebDriver and WebDriver BiDi both reject navigation to `moz-extension:` pages and `about:debugging`; Firefox says privileged browser-chrome access requires `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1`. That override was not used because it relaxes the browser's remote-control boundary. No Firefox Native Messaging ping, permission prompt, audit transfer, MCP retrieval or deletion occurred. Complete this on a normal desktop through Firefox's actual UI, then verify the snapshot through MCP. Do not use a normal Firefox profile or claim a pass from helper/protocol tests.

### M6.2 permission-prompt recovery update

The Chrome fresh-profile run above observed the permission request remain pending; it did not establish grant or denial. The AI Integrations and report-share flows now stop showing an indefinite “Checking…”/“Sharing…” state after 10 seconds, explain that a browser decision is pending, and avoid treating timeout as denial. AI Integrations rechecks `permissions.contains()` on the next click and does not issue a duplicate prompt or native call while the original request is unresolved. The share dialog rechecks authorization on retry. Vitest verifies these states; it is not native browser permission evidence.

For release evidence, repeat in isolated Chrome and Firefox profiles: grant, deny, revoke after a successful `ping`, reauthorize, cancel the share dialog, verify no snapshot on denial/cancellation, and confirm old snapshots remain after revocation. Chrome grant/deny/revocation and all Firefox Native Messaging runtime steps are still NOT VERIFIED. Firefox automation was stopped at the browser's privileged-page boundary; do not enable `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1` to bypass it. Use an operator-driven desktop session and capture only permission state, host launch outcome, snapshot metadata and MCP result—never audit contents.

### M6.2 AI Integrations workbench

Use isolated Chrome and Firefox profiles with the existing development companion. No DevTools is required for this acceptance flow.

1. Open RankMiso and choose **AI Integrations** from the utility navigation. If not configured, click **Enable local sharing** and approve the optional browser permission.
2. Confirm **Connected**, then switch between two website tabs and return to AI Integrations. After its 15-second freshness window expires, a tab activation should quietly revalidate; no manual Check Companion action or new permission prompt should be needed. Repeat after closing and reopening the popup.
3. Configure Codex or Claude Code using the companion setup guide. Confirm the client reports its own MCP state; the browser's **Connected** indicator does not assert AI-client connectivity.
4. Share an audit from **Export → Share with MCP**. Confirm the success notification and **View Shared Audits** action, then confirm the snapshot appears with analyzed/shared timestamps and a short ID.
5. Share a second snapshot of the same website. Confirm both remain distinguishable. Remove one and confirm only that snapshot disappears without another companion check.
6. Remove Native Messaging permission in browser extension settings. Confirm status changes to **Permission Required**, snapshots are not deleted, and no native request proceeds until the user reauthorizes.

The automated tab activation test covers stale-status recovery/deduplication, and the Chrome native-sharing E2E covers explicit share/removal in an isolated profile. Actual permission grant, denial, revocation, reauthorization prompts and the Firefox Native Messaging runtime remain operator checks; use temporary profiles and record actual results. Firefox browser automation has been stopped at the documented privileged-page boundary. No privileged override or normal profile modification is permitted for this checklist.

### M6.2 resume verification (2026-10-31)

The latest isolated Google Chrome 156.0.8078.47 E2E passed Native Messaging discovery and ping, user cancellation with no file written, confirmed sharing, schema-v1 persistence, all five MCP tools, managed deletion, and failure to retrieve the deleted snapshot. It used extension ID `jjfplnlkfedjjdbbkhpiamgakoblncko`; its isolated test manifest pregranted `nativeMessaging`. It does not close the native permission lifecycle gap. Source inspection shows `permissions.request()` is invoked in the Settings/share user action before any awaited preflight, but the earlier live request stayed pending and no prompt/result was observed. Keep Chrome grant/denial/revocation/reauthorization and Firefox host runtime explicitly NOT VERIFIED until an operator records the actual browser interaction.

### M6.2 UX refinement — current source verification (2026-10-31)


The current source remembers the local-sharing opt-in, automatically checks permission and companion availability when enabled Settings opens, and reuses short-lived connection/list metadata for 15 seconds. The Connected status expires at that interval without polling. Permission revocation clears the visible status/list and invalidates in-flight cache results. Shared audits sort by the host-reported file modification timestamp and show analyzed time, shared time, and a short snapshot ID. Explicit connection, share, and acknowledged removal use the accessible, dismissible success toast.

The current Chrome E2E passed in Google Chrome 156.0.8078.47 with a temporary profile: native host discovery, ping, explicit share, schema-v1 persistence, all five existing MCP tools, removal of the exact snapshot, and failed retrieval after deletion. The isolated test copy pregranted `nativeMessaging`; real permission prompts remain unverified. Vitest covers denial, permission revocation/restoration, saved preference and automatic Settings checks, duplicate-check suppression, success notifications, and retention of another snapshot for the same site. Firefox production build and isolated host-registration helper pass, but live Firefox Native Messaging remains unverified because standard WebDriver/BiDi refuse privileged extension/about pages. No privileged remote-control override or Snap/AppArmor workaround was used, and the user's normal Firefox profile was not touched. Complete the visible Firefox lifecycle only in a dedicated temporary profile.

## M6.3 — packaged companion platform acceptance

Use isolated OS user accounts or temporary profiles. Install from each native-runner artifact and record OS version, archive checksum, browser version and exact extension build. Confirm the installer validates executable launch, creates stable private per-user audit storage, registers Chrome's exact production origin and Firefox's exact add-on ID, and does not require administrator access. Share an audit explicitly, verify the MCP server reads it from the same directory, then remove it through RankMiso. Verify denial/revocation does not permit new native calls. Repeat installation as an upgrade and confirm the snapshot survives. Uninstall and confirm only RankMiso browser registration/binaries are removed while audit/config data remain. Exercise Windows registry registration/removal and macOS manifest paths on those actual systems; cross-compilation is not runtime evidence. Verify Codex and Claude configuration in isolated homes, including that an existing `rankmiso` entry is refused without modifying it and unrelated MCP settings remain intact. Browser companion connection, client configuration, and client connection are separate states. Record any macOS notarization/Gatekeeper or Windows SmartScreen behavior; unsigned artifacts are expected during this preview.
