# Browser compatibility

| Browser | Build | Status in 0.1.0 |
| --- | --- | --- |
| Chrome | `wxt build` | MV3 build succeeds. The maintainer loaded the unpacked folder and used the popup and side panel on a live page. |
| Edge | `wxt build -b edge` | Same Chromium MV3 path. Not separately installed here. |
| Brave, Opera, Vivaldi | Load the Chrome package | Expected to work where Manifest V3 and `sidePanel` match Chrome. Not installed here. |
| Firefox | `wxt build -b firefox --mv3` | Script targets MV3. Sidebar entry is generated. This version has not been loaded in Firefox, and it has not been submitted. |
| Safari macOS | Not built | Needs Apple's converter, signing, and distribution. A successful future build command would not mean store support. |
| Safari iOS | Not targeted | No feasible packaging in this version. |

APIs used: `storage`, `tabs`, `scripting.executeScript`, `sidePanel` or `sidebarAction` when present, optional `permissions.request` for one origin, and the page performance timeline. `webRequest` is not used.

If neither sidebar API exists, the sidebar button is hidden. The dashboard remains available. The Firefox sidebar control has not been clicked in a live window. The Chrome side panel has.
