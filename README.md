# RankMiso

**Every page. Every detail.**

RankMiso is a free, open-source SEO browser extension for developers, marketers, and website owners. Open it on the page you are viewing. It reads that page in your browser, scores the checks it can actually measure, and shows the rest as not measured.

It belongs to the Miso ecosystem. The idea is simple: powerful tools, less overhead. No account. No subscription. No telemetry. No ads. No backend.

Version 0.1.0 is the build prepared for Firefox. The steps, listing text, and reviewer notes are in [docs/releases/firefox.md](docs/releases/firefox.md). The privacy policy has to be on a public HTTPS page before that listing can point at it. The Chrome Web Store is a later upload.

## What you see

The popup is the short read. The full report is one click away.

- **Overview.** Score, title, description, counts, H1, canonical, robots, language, and schema types.
- **JSON-LD.** Labeled fields you can scan, plus a copy of the formatted source.
- **Headings.** The outline, with copy on each heading.
- **Links.** Internal, external, and nofollow, with addresses you can open.
- **Images.** Thumbnail, bold name, then the image address.
- **Social.** Approximate link and X cards, including the share image when it loads.

The dashboard keeps the same analysis and adds the longer tables: metadata, content, technical details, performance observations, international tags, a small accessibility sample, and exports. JSON, CSV, and HTML download only after you confirm.

Counts use thousands separators. Long addresses truncate. Web links open in a new tab. Light, dark, and system themes stay in the extension.

## A score you can trust

The number is a weighted summary of the checks that ran. Errors, warnings, and passes are counted. Checks that could not be evaluated stay out of the score.

RankMiso will not invent search volume, keyword difficulty, traffic, backlinks, or index status. A missing measurement is shown as unavailable. The result includes a disclaimer: this is not a Google ranking.

The full report can check one site after you allow it: response headers, robots.txt for the Googlebot group or `*`, whether the open URL is in the first sitemap, redirect hops, hreflang return links, and public links 20 at a time. Those requests stay off until you start them. Local and private addresses are skipped.

The Performance section shows how many resources this page load requested. Largest Contentful Paint, Cumulative Layout Shift, and Interaction to Next Paint stay Unavailable in this version.

Still not measured: search rankings, traffic, backlinks, index coverage, PageSpeed Insights, official rich-result eligibility, and comparisons across URLs. See [progress](docs/development/progress.md).

## Try it

Firefox, from this repository:

```bash
source "$HOME/.cargo/env"
pnpm install
pnpm build:wasm
pnpm --filter @rankmiso/extension build:firefox
```

Open `about:debugging`, choose **This Firefox**, then **Load Temporary Add-on**. Select:

`apps/extension/.output/firefox-mv3/manifest.json`

Choose the file, not the folder. The add-on disappears when Firefox quits. After a rebuild, click **Reload** on that same entry.

Chrome and Edge:

```bash
pnpm --filter @rankmiso/extension build
pnpm --filter @rankmiso/extension build:edge
```

Load the unpacked folder `apps/extension/.output/chrome-mv3` or `apps/extension/.output/edge-mv3`. Safari is not produced by these commands.

## Develop

Requirements: Rust stable, the `wasm32-unknown-unknown` target, `wasm-bindgen-cli` 0.2.100, Node.js 22+, and pnpm 10.

```bash
source "$HOME/.cargo/env"
pnpm install
pnpm build:wasm
pnpm dev
```

The Rust crates stay named `seo-core`, `seo-rules`, `seo-scoring`, and `seo-wasm`. They own the rules. Vue owns the screen.

| | |
| --- | --- |
| Product name, tagline, assets | `apps/extension/src/config/brand.config.ts` |
| Colors and type | `packages/design-tokens/src/tokens.css` |
| Interface copy | `apps/extension/src/locales/en.ts` |
| Replace the icon | [docs/branding/asset-replacement.md](docs/branding/asset-replacement.md) |

```bash
pnpm brand:icons
```

That reads `apps/extension/public/brand/icon.png` and writes the 16, 32, 48, and 128 toolbar icons. Reload the extension after rebuilding. The current artwork is the fox sticker.

## Docs

- [What the product includes](docs/features/overview.md)
- [How the pieces fit](docs/architecture/overview.md)
- [Brand and the fox mark](docs/branding/overview.md)
- [Privacy](PRIVACY.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT. See `LICENSE`.
