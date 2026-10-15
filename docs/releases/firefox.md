# Firefox release

Version 0.1.0. The package id is `rankmiso@rankmiso.extension`. The first accepted upload on addons.mozilla.org locks that id. Changing it later makes Firefox treat the file as a different add-on. This id is not an email address.

The GitHub repository is private. A private link cannot be the privacy policy URL on the listing. Put the text of `PRIVACY.md` on a public HTTPS page before you submit that field. Publishing this repository is one way to do that. Do not paste a private GitHub URL.

## Build the package

From the repository root:

```bash
source "$HOME/.cargo/env"
pnpm install
pnpm build:wasm
pnpm --filter @rankmiso/extension build:firefox
```

`wasm-bindgen-cli` must be 0.2.100, the same version as the crate. Node.js 22 or newer and pnpm 10.27.0 match this repository.

Confirm `apps/extension/.output/firefox-mv3/manifest.json` before you zip it:

- `manifest_version` is 3
- `name` is RankMiso
- `version` is 0.1.0
- `browser_specific_settings.gecko.id` is `rankmiso@rankmiso.extension`
- `browser_specific_settings.gecko.strict_min_version` is 140.0
- `browser_specific_settings.gecko.data_collection_permissions.required` is `["none"]`
- required permissions are only `storage`, `activeTab`, and `scripting`
- `optional_host_permissions` are `http://*/*` and `https://*/*`
- a `.wasm` file is present under the output

Zip the files inside the output folder, so `manifest.json` is at the root of the archive:

```bash
cd apps/extension/.output/firefox-mv3
zip -r -FS "$OLDPWD/rankmiso-0.1.0-firefox.zip" . -x '*.git*'
```

Load that same folder once as a temporary add-on before you upload. In Firefox, open `about:debugging` → **This Firefox** → **Load Temporary Add-on**, and select `manifest.json` inside `apps/extension/.output/firefox-mv3`. Choose the file, not the folder. If an older temporary add-on with `rankmiso@local.dev` is still listed, remove it first. The new id is a different add-on. After a rebuild, click **Reload** on that entry. The temporary add-on disappears when Firefox quits.

On a normal `https` page, open the toolbar button, open the sidebar, and open the full report. On the Technical section, press **Check this site** and both allow and deny the permission once. Performance should show a resource count. Largest Contentful Paint, Cumulative Layout Shift, and Interaction to Next Paint stay Unavailable in this version.

## Source archive for review

The Firefox package contains bundled JavaScript and a WebAssembly file. On the upload form, answer that reviewers need the source.

The source archive has to be the same tree you just built. Commit that tree first, then from the repository root:

```bash
git archive --format=zip --output rankmiso-0.1.0-source.zip HEAD
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
- A resource count from this browser’s timeline for the current page load
- Optional checks you start yourself, for one site: response headers, robots.txt, whether this URL is in the first listed sitemap, redirect hops, hreflang return links, and public links 20 at a time

Not included:

- Search rankings, traffic, backlinks, or index coverage
- PageSpeed Insights or Chrome UX Report field data
- Largest Contentful Paint, Cumulative Layout Shift, and Interaction to Next Paint. Those cards stay Unavailable in this version
- Official rich-result eligibility. The JSON-LD row is a local field list
- A crawl of your browsing history

Optional checks ask for permission for that site only. They are off until you press Check this site. Analysis stays in the browser. No account, no telemetry, no ads.

**Category:** Search Tools

**License:** MIT

Leave the homepage and support site empty until those pages exist. The Mozilla account email is the support contact.

## What to enter on the form

| Prompt | Answer |
| --- | --- |
| Where to distribute | On this site, so it is listed on addons.mozilla.org |
| Platforms | Firefox |
| Source code required | Yes. Upload `rankmiso-0.1.0-source.zip` |
| Privacy policy | Yes. Paste the public URL of `PRIVACY.md` |
| Data collection | None. This must match `data_collection_permissions.required` |
| Account for reviewers | None. Open any public `https` page |

Permission notes, if the form asks:

- `storage` keeps the appearance preference.
- `activeTab` reads the tab where you opened RankMiso. A domain change closes that access.
- `scripting` injects the page reader and the highlighter into that tab.
- Optional `tabs` is requested only if a domain change hides the open address. It is used to name that tab. Browsing history is not saved.
- Optional host access is requested for one origin when you press **Check this site**, or when **Refresh analysis** needs the site you just opened. Cookies are not sent. Local and private addresses are skipped by the site check. Results stay in the browser.

Add at least one screenshot of the popup and one of the full report on a normal page.

## After upload

Mozilla validates the zip, then a reviewer builds the source and tries the add-on. Approval signs the file. Users install the signed version from the listing. The temporary add-on in `about:debugging` is not that signed version.

This file does not mean the add-on has been submitted.
