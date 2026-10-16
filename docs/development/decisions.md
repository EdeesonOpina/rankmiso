# Decisions

## Rust owns the rules

The browser collects a snapshot. Rust evaluates it. That keeps scoring testable without a browser and prevents the UI from drifting into its own SEO rules.

Content metrics stay in `seo-rules` for now. A separate content or schema crate can wait until the logic no longer fits one module.

## Score

Only PASS, WARNING, and ERROR affect the score. Points are 2, 1, and 0, multiplied by the check weight. Integer division truncates toward zero. INFO, NOT_APPLICABLE, and UNAVAILABLE are excluded. Category weights are metadata 25, headings 15, technical 15, content 10, images 10, links 10, international 5, accessibility 5, and social 5. Structured data and performance stay at weight 0 because their current results are informational or unavailable.

The disclaimer is part of the result: the number is not a ranking score.

## Unavailable means not measured

Missing HTTP headers, robots.txt, sitemaps, reciprocal hreflang, rich-result eligibility, index status, and INP are explicit unavailable checks. A page is not rewarded for measurements we did not attempt.

## No proprietary substitutes

Ahrefs, SEOquake, and similar products show domain rating, traffic, keyword volume, or backlink counts from private databases. This project will not estimate those and label the estimate as the same metric.

## Permissions

Default permissions are `storage`, `activeTab`, and `scripting`. The extension injects a page tool when the user opens it. It does not register a content script for every site. Optional host permissions are declared for later opt-in fetches and are unused.

## WebAssembly packaging

`wasm-bindgen` targets the web loader. Vite copies the `.wasm` file and the extension initializes it from that local URL. Extension pages allow `wasm-unsafe-eval` so the local module can compile. The CLI and crate are pinned to 0.2.100.

## Branding

`apps/extension/src/config/brand.config.ts` is the only product-identity source. The WXT manifest reads `identity.name`, `identity.description`, and `browser.geckoId` from that module. Vue headers read the same object. Do not add a second brand file.

Visual tokens live in `packages/design-tokens/src/tokens.css`. `--miso-color-*` and `--miso-font-*` are the configurable values. Existing `--background`, `--primary`, and related names alias those tokens so current Tailwind utilities keep working. The palette and the geometric M mark are temporary. They are not the final Miso identity.

Light type names Nunito first. Dark type names Inter first. JetBrains Mono is first for monospace. The extension does not download webfonts. If those families are not installed, the system UI and monospace fonts are used.

HTML `<title>` tags in the extension entrypoints are static copies of the product name. WXT does not import the TypeScript brand module into those HTML files, so a name change must update both places.

These identifiers stay technical and are not product branding:

- Rust crates remain `seo-core`, `seo-rules`, `seo-scoring`, and `seo-wasm`.
- `ENGINE_NAME` remains `seo-toolkit` inside audit JSON.
- The theme storage key remains `seoToolkit.theme`.
- In-page highlight markers remain `data-seo-toolkit-mark`, `seo-toolkit-highlight`, and `data-seo-toolkit-generation`.

## Localization

Interface strings use `en.ts`. Rule identifiers stay stable. English rule sentences are produced by Rust together with a `titleKey` so a later locale can override them without changing the rule id.

## Storage

Only the theme preference is stored. Full page text is not written to disk. Exports are user-initiated downloads.

## Firefox

The Firefox package is Manifest V3 via `wxt build -b firefox --mv3`. The id is `rankmiso@rankmiso.extension`. The first accepted addons.mozilla.org upload locks it. Changing it after that makes Firefox treat the add-on as a different extension. `data_collection_permissions.required` is `none`.

Optional host permissions stay out of the required set. **Check this site** calls `permissions.request` for the current origin, then fetches headers, robots.txt, the first listed sitemap, and at most 20 public links. Private and local addresses are skipped. PageSpeed Insights is not called. The JSON-LD rich-result row is a local field list and does not change the score, because that category weight is 0.
