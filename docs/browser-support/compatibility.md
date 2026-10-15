# Browser compatibility

| Browser | Build | Status in 0.1.0 |
| --- | --- | --- |
| Chrome | `wxt build` | MV3 build succeeds. Live install was not exercised in this session. |
| Edge | `wxt build -b edge` | Same Chromium MV3 path. Not separately installed here. |
| Brave, Opera, Vivaldi | Load the Chrome package | Expected to work where Manifest V3 and `sidePanel` match Chrome. Not installed here. |
| Firefox | `wxt build -b firefox --mv3` | Script targets MV3. Sidebar entry is generated. Live install was not exercised. |
| Safari macOS | Not built | Needs Apple's converter, signing, and distribution. A successful future build command would not mean store support. |
| Safari iOS | Not targeted | No feasible packaging in this version. |

APIs used: `storage`, `tabs`, `scripting.executeScript`, `sidePanel` when present, and the page performance timeline. `webRequest` is not used.

If `sidePanel` is missing, the side-panel button is hidden. The dashboard remains available.
