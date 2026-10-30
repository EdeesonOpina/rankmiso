# Permissions

The published v0.3.0 package and the current F1-H.1 development build differ. The notes below describe the current generated development manifests; v0.3.0 remains unchanged until a maintainer-authorized release.

Required API permissions remain:

- `storage` saves appearance and inspection-mode preferences.
- `activeTab` and `scripting` support user-invoked, local page inspection.
- Chromium additionally requires `sidePanel` for its native side panel.

Neither browser build requires host access at installation. Both declare `http://*/*` and `https://*/*` only under `optional_host_permissions`. These declarations make the access requestable; they do not grant it.

The user can choose **Automatic checks** or **Individual website access**. Automatic checks are opt-in. RankMiso requests broad HTTP/HTTPS access from the explicit button action; the user must approve the browser prompt. The permission is broad even though RankMiso's implementation limits automatic local auditing to the active eligible page while its sidebar is open and Automatic checks are selected. Individual mode ignores broad grants and uses only separately authorized sites or temporary toolbar inspection. Users can deny or revoke access in browser controls; RankMiso does not persist a second permission registry.

Core page extraction and SEO analysis remain local. Opening the sidebar or granting host access does not start crawling, standalone sitemap discovery, optional probes, PageSpeed, or automatic History saves. Site Explorer crawling is a separate user-initiated action in both Chrome and Firefox. Firefox continues to omit standalone sitemap discovery, optional technical probes, and PageSpeed even when website access is granted, and its manifest keeps `data_collection_permissions.required` set to `none`.

The optional `tabs` permission remains separate and is not requested to obtain broad website access. The extension does not request the `history` permission, cookies, `webRequest`, or a permanent content script.
