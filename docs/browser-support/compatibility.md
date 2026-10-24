# Browser compatibility

| Browser | Build | Status |
| --- | --- | --- |
| Chrome | `wxt build` | Available in Chrome Web Store. MV3 build succeeds; Playwright verifies the built popup loads. |
| Edge | `wxt build -b edge` | Same Chromium MV3 path. Not separately installed here. |
| Brave, Opera, Vivaldi | Load the Chrome package | Expected to work where Manifest V3 and `sidePanel` match Chrome. Not installed here. |
| Firefox | `wxt build -b firefox --mv3` | Available in Firefox Add-ons. MV3 build succeeds; browser-specific manual checks should be repeated after significant changes. |
| Safari macOS | Not built | Needs Apple's converter, signing, and distribution. A successful future build command would not mean store support. |
| Safari iOS | Not targeted | No feasible packaging in this version. |

APIs used: `storage`, `tabs`, `scripting.executeScript`, `sidePanel` or `sidebarAction` when present, optional `permissions.request` for one origin, and the page performance timeline. `webRequest` is not used.

If neither sidebar API exists, the sidebar button is hidden. The dashboard remains available. Playwright currently automates the built Chromium popup smoke path; Firefox, Edge, and live-page behaviors remain manual checks.
