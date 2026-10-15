# Permissions

Required:

- `storage` saves the appearance preference.
- `activeTab` allows the extension to read the tab the user invoked it on.
- `scripting` injects the extractor and highlighter into that tab.

Chromium also requests `sidePanel` so the side panel entry can open.

Optional host permissions `http://*/*` and `https://*/*` are declared and unused until a click asks for one origin. **Check this site** asks for the site you are checking. **Refresh analysis** asks for a new site after you leave the site where RankMiso was opened, because the browser closes the original access on a domain change.

The optional `tabs` permission is requested only when that domain change hides the address. RankMiso uses it to name the open tab and ask for that site. It does not read the history list, and it does not store addresses.

The extension does not request the `history` permission, cookies, webRequest, or a permanent content script.

Firefox `data_collection_permissions.required` is set to `none`.
