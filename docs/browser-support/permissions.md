# Permissions

Required:

- `storage` saves the appearance preference.
- `activeTab` allows the extension to read the tab the user invoked it on.
- `scripting` injects the extractor and highlighter into that tab.

Chromium also requests `sidePanel` so the side panel entry can open.

Optional host permissions `http://*/*` and `https://*/*` are declared for future opt-in fetches. Current analysis does not use them.

The extension does not request history, cookies, webRequest, or a permanent content script.

Firefox `data_collection_permissions.required` is set to `none`.
