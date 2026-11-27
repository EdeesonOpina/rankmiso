# Permissions

The notes below describe the generated manifests in this repository. Chrome Web Store and Firefox Add-ons publish v0.5.1. The extension declares `nativeMessaging` as an optional permission for local AI sharing.

Required API permissions remain:

- `storage` saves appearance and inspection-mode preferences.
- `activeTab` and `scripting` support user-invoked, local page inspection.
- Chromium additionally requires `sidePanel` for its native side panel.

Neither browser build requires host access at installation. Both declare `http://*/*` and `https://*/*` only under `optional_host_permissions`. These declarations make the access requestable; they do not grant it.

The user can choose **Automatic checks** or **Individual website access**. Automatic checks are opt-in. RankMiso requests broad HTTP/HTTPS access from the explicit button action; the user must approve the browser prompt. The permission is broad even though RankMiso's implementation limits automatic local auditing to the active eligible page while its sidebar is open and Automatic checks are selected. Individual mode ignores broad grants and uses only separately authorized sites or temporary toolbar inspection. Users can deny or revoke access in browser controls; RankMiso does not persist a second permission registry.

Core page extraction and SEO analysis remain local. Opening the sidebar or granting host access does not start crawling, standalone sitemap discovery, optional probes, PageSpeed, or automatic History saves. Site Explorer crawling is a separate user-initiated action in both Chrome and Firefox. Firefox continues to omit standalone sitemap discovery, optional technical probes, and PageSpeed even when website access is granted, and its manifest keeps `data_collection_permissions.required` set to `none`.

Since v0.7.1 (unreleased), `webRequest` is also an optional permission, approved by the owner on 2026-11-25. It is requested only when the user chooses **Allow redirect details** in Technical → Redirect trace. Browsers return an opaque response to `redirect: "manual"` fetches, so without it RankMiso can tell only that a redirect happened. With it, RankMiso reads the status code and `Location` of responses to its own requests (from its pages or background) for the origin it already has access to, validates each next URL, and requests it itself. The listener is non-blocking, changes nothing, and is removed when the trace or crawl ends. Site Explorer uses it only if it was already granted.

The optional `tabs` permission remains separate and is not requested to obtain broad website access. The extension does not request the `history` permission, cookies, `webRequest`, or a permanent content script.
