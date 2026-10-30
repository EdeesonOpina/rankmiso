# Firefox release

Published version: v0.3.0. v0.4.0 has been submitted for review. Preserve the existing package id `rankmiso@rankmiso.extension` so Firefox treats it as an update to the existing add-on.

The listing's privacy policy URL must be a public HTTPS page that matches `PRIVACY.md`.

## Build the package

From the repository root:

```bash
source "$HOME/.cargo/env"
pnpm install
pnpm build:wasm
pnpm --filter @rankmiso/extension build:firefox
```

`wasm-bindgen-cli` must be 0.2.100, the same version as the crate. The tested environment used Node.js 22.23.3, pnpm 10.27.0, Rust 1.99.1, and the `wasm32-unknown-unknown` target.

Confirm `apps/extension/.output/firefox-mv3/manifest.json` before you zip it:

- `manifest_version` is 3
- `name` is RankMiso
- `version` is 0.4.0
- `browser_specific_settings.gecko.id` is `rankmiso@rankmiso.extension`
- `browser_specific_settings.gecko.strict_min_version` is 140.0
- `browser_specific_settings.gecko.data_collection_permissions.required` is `["none"]`
- required permissions are only `storage`, `activeTab`, and `scripting`
- `optional_host_permissions` contains optional HTTP/HTTPS eligibility patterns. They are not granted at install; Automatic Checks and Individual Website Access require browser approval. Firefox still omits PageSpeed Insights, standalone remote sitemap discovery, and optional technical probes.
- a `.wasm` file is present under the output

Zip the files inside the output folder, so `manifest.json` is at the root of the archive:

```bash
cd apps/extension/.output/firefox-mv3
zip -r -FS "$OLDPWD/rankmiso-v0.4.0-firefox.zip" . -x '*.git*'
```

Load that same folder once as a temporary add-on before you upload. In Firefox, open `about:debugging` → **This Firefox** → **Load Temporary Add-on**, and select `manifest.json` inside `apps/extension/.output/firefox-mv3`. Choose the file, not the folder. If an older temporary add-on with `rankmiso@local.dev` is still listed, remove it first. The new id is a different add-on. After a rebuild, click **Reload** on that entry. The temporary add-on disappears when Firefox quits.

On a normal `https` page, open the toolbar button, sidebar, and full report. Confirm local inspection and the approved permission modes. In Site, explicitly start a bounded crawl and verify it can be stopped. Confirm standalone Sitemaps remains local-import-only, optional technical probes stay unavailable, and no PageSpeed key or request control is present. Performance values are browser observations, not field data.

## Source archive for review

The Firefox package contains bundled JavaScript and a WebAssembly file. On the upload form, answer that reviewers need the source.

The source archive must contain the exact source snapshot used to build the Firefox package, including the Rust workspace, `Cargo.lock`, `pnpm-lock.yaml`, workspace manifests, WXT configuration, build scripts, and `SOURCE_CODE_REVIEW.md`. Do not use `git archive HEAD` for an uncommitted candidate. Generate WXT's source archive from the isolated candidate snapshot, inspect its contents, and verify it reproduces the Firefox package before submission. See the root `docs/releases/v0.4.0.md` for the candidate procedure.

```bash
pnpm --filter @rankmiso/extension exec wxt zip -b firefox --mv3
```

Reviewers reproduce the package with the commands in [Build the package](#build-the-package). Dependencies come from `pnpm-lock.yaml` and `Cargo.lock` through pnpm and Cargo. The archive must stay under 200 MB, so leave out `node_modules`, `target`, and `.output`.

## Listing text

Use this, and change it if the product changes.

**Summary**

On-page SEO for the page you are viewing. Local analysis, no account.

**Description**

RankMiso reads the page open in your browser and reports the SEO details it can actually measure.

Included:

- Title, description, canonical, robots, headings, links, images, and JSON-LD syntax
- A local checklist score that leaves out checks it could not run
- Approximate social cards
- Browser-observed LCP and CLS, an INP estimate when the browser exposes interaction timing, and an explicit page-scoped INP capture control
- A resource count from this browser’s timeline for the current page load

Not included:

- PageSpeed Insights or optional technical requests to other websites
- Chrome UX Report field data
- Search rankings, traffic, backlinks, or index coverage
- Official rich-result eligibility. The JSON-LD row is a local field list
- A crawl of your browsing history

Analysis stays in the browser. This Firefox build does not include PageSpeed Insights or optional requests to other websites. No account, no telemetry, no ads.

**Category:** Search Tools

**License:** MIT

Leave the homepage and support site empty until those pages exist. The Mozilla account email is the support contact.

## What to enter on the form

| Prompt                | Answer                                                       |
| --------------------- | ------------------------------------------------------------ |
| Where to distribute   | On this site, so it is listed on addons.mozilla.org          |
| Platforms             | Firefox                                                      |
| Source code required  | Yes. Upload the verified `rankmiso-v0.4.0-firefox-sources.zip` |
| Privacy policy        | Yes. Paste the public URL of `PRIVACY.md`                    |
| Data collection       | None. This must match `data_collection_permissions.required` |
| Account for reviewers | None. Open any public `https` page                           |

Permission notes, if the form asks:

- `storage` keeps the appearance preference.
- `activeTab` reads the tab where you opened RankMiso. A domain change closes that access.
- `scripting` injects the page reader and the highlighter into that tab.
- Optional `tabs` is requested only if a domain change hides the open address. It is used to name that tab. Browsing history is not saved.
- v0.3.0 remains the published baseline and does not include v0.4.0 permissions or Firefox crawling. The v0.4.0 candidate declares optional HTTP/HTTPS host eligibility, requires explicit browser approval, and supports local active-page inspection plus explicitly started same-origin Site Explorer crawling. Explain that broad Automatic Checks access is broad, not active-tab-only. Firefox standalone sitemap discovery, remote technical probes, and PageSpeed remain unavailable. Update the store permission purpose and privacy disclosures before submission.

Add at least one screenshot of the popup and one of the full report on a normal page.

## After upload

Mozilla validates the zip, then a reviewer builds the source and tries the add-on. Approval signs the file. Users install the signed version from the listing. The temporary add-on in `about:debugging` is not that signed version.

v0.4.0 was submitted on 2026-10-30 with `rankmiso-v0.4.0-firefox.zip` and `rankmiso-v0.4.0-firefox-sources.zip`.
