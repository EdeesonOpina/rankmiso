# Chrome release

RankMiso v0.3.0 is the published Chrome Web Store version. This document covers the unsubmitted v0.4.0 candidate.

The product name is already RankMiso. Icons are already generated from the fox sticker.

When you are ready:

1. Confirm `apps/extension/package.json` is version `0.4.0`, then run `pnpm build:wasm` and `pnpm --filter @rankmiso/extension build`.
2. Load `apps/extension/.output/chrome-mv3` as an unpacked extension and repeat the same page checks used for Firefox.
3. Zip that folder so `manifest.json` is at the root of the archive.
4. Confirm manifest version 3, permissions `storage`, `activeTab`, `scripting`, and `sidePanel`, optional host permissions only, and a `.wasm` file inside the zip.
5. Publish the same privacy text as `PRIVACY.md` at a public HTTPS URL. The Chrome Web Store listing has to point at that URL.
6. Update the listing to describe local browser observations, explicit page-scoped INP capture, and the optional, user-triggered PageSpeed Insights request accurately. Do not claim rankings, field metrics, or official rich-result eligibility.

For v0.4.0, use `rankmiso-v0.4.0-chrome.zip` from the release-candidate output. Update the listing's optional HTTP/HTTPS permission purpose to explain Automatic Checks' broad access, Individual Website Access, and the explicit Site Explorer crawl. The crawl sends requests directly to the selected website only after Start.
