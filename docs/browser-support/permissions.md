# Permissions

Required:

- `storage` saves the appearance preference.
- `activeTab` allows the extension to read the tab the user invoked it on.
- `scripting` injects the extractor and highlighter into that tab.

Chromium also requests `sidePanel` so the side panel entry can open.

The Chromium builds declare optional host permissions `http://*/*` and `https://*/*`. **Check this site** and PageSpeed Insights are available there only after a user action and the relevant permission prompt.

The Firefox build declares no optional host permissions. It omits PageSpeed Insights and optional technical requests to other websites, and sets `data_collection_permissions.required` to `none`. Its local page analysis and browser performance observations remain available.

The optional `tabs` permission is requested only when that domain change hides the address. RankMiso uses it to name the open tab and ask for that site. It does not read the history list, and it does not store addresses.

The extension does not request the `history` permission, cookies, webRequest, or a permanent content script.
