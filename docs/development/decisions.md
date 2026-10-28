# Decisions

## Rust owns the rules

The browser collects a snapshot. Rust evaluates it. That keeps scoring testable without a browser and prevents the UI from drifting into its own SEO rules.

Content metrics stay in `seo-rules` for now. A separate content or schema crate can wait until the logic no longer fits one module.

## Score

Only PASS, WARNING, and ERROR affect the score. Points are 2, 1, and 0, multiplied by the check weight. Integer division truncates toward zero. INFO, NOT_APPLICABLE, and UNAVAILABLE are excluded. Category weights are metadata 25, headings 15, technical 15, content 10, images 10, links 10, international 5, accessibility 5, and social 5. Structured data and performance stay at weight 0 because their current results are informational or unavailable.

The disclaimer is part of the result: the number is not a ranking score.

## Unavailable means not measured

Missing HTTP headers, robots.txt, sitemaps, reciprocal hreflang, rich-result eligibility, index status, and browser interaction timing when the API exposes no entries are explicit unavailable checks. A page is not rewarded for measurements we did not attempt. Browser performance observations and optional PageSpeed lab results are not field data and do not affect the score.

## No proprietary substitutes

Ahrefs, SEOquake, and similar products show domain rating, traffic, keyword volume, or backlink counts from private databases. This project will not estimate those and label the estimate as the same metric.

## Permissions

Default permissions are `storage`, `activeTab`, and `scripting`. The extension injects a page tool when the user opens it. It does not register a content script for every site. Chromium builds request optional host access only when the user starts **Run optional checks** or PageSpeed Insights. Firefox has no optional host permissions and omits both external-request features; its manifest declares `data_collection_permissions.required: ["none"]`.

## A fetched response is not the navigation response

HTML comparison requests the open address again, or reads a file the user chose. It is labeled as fetched HTML. Cookies, cache, and personalization can make it differ from the page the browser first received. The difference is not stored as a JavaScript defect, and the HTML is not written into history.

Microdata and RDFa observations are informational. RDFa support is the subset in `docs/features/advanced-technical.md`, not a complete processor. An hreflang URL on another host, or a fetch that did not succeed, is not a missing return link.

## MCP remains optional and local

MCP integration is planned, not implemented. Any future MCP surface must consume the same versioned audit produced by the extension and Rust engine; it must not introduce a second rules engine, hosted backend, telemetry, or silent page access. A local stdio companion and an explicit extension-to-host bridge are candidates, not settled architecture. See Phase 7 in `implementation-plan.md` for the investigation, proposed read-only tools, and acceptance requirements.

## WebAssembly packaging

`wasm-bindgen` targets the web loader. Vite copies the `.wasm` file and the extension initializes it from that local URL. Extension pages allow `wasm-unsafe-eval` so the local module can compile. The CLI and crate are pinned to 0.2.100.

## Branding

`apps/extension/src/config/brand.config.ts` is the only product-identity source. The WXT manifest reads `identity.name`, `identity.description`, and `browser.geckoId` from that module. Vue headers read the same object. Do not add a second brand file.

Visual tokens live in `packages/design-tokens/src/tokens.css`. `--miso-color-*` and `--miso-font-*` are the configurable values. Existing `--background`, `--primary`, and related names alias those tokens so current Tailwind utilities keep working. The mark in the extension is the official fox icon from the Miso website, `public/brand/miso-icon.png`.

RankMiso uses its own white-first application design. Each inspector is laid out for the kind of data it shows. A color or padding change is not a layout change. From 1100px the report overview uses two columns. Narrower windows stack. The sitemap URL table stays full width. The Miso website remains the reference for logos and mascot art, not for canvas color, cards, type, spacing, or layout. Do not restore the cream canvas, ivory cards, or coral card outlines unless the maintainer asks. Miso red is for the mark, the active destination, and the primary action. Status colors stay separate from that red. Dark mode keeps the navy dashboard surfaces. Dark filled buttons use sumi ink on `#ef5340` because white on that red is below 4.5:1.

Type is the platform UI stack in both themes: `ui-sans-serif`, `system-ui`, then the common system faces. Monospace is `ui-monospace`, then the common system mono faces. RankMiso does not name Nunito or M PLUS Rounded 1c and does not request font files. Those faces are not assumed to be installed.

## Workbench navigation

M1 first grouped the popup as Overview, Issues, and Inspect, and the report as Overview, Issues, On-page, Technical, History, and Export. UX-2 replaced those containers with the flat list below. Existing section ids stay valid for deep links. `?section=headings` still opens headings. Issues and export are presentation sections. They do not add checks. Category bars read `score.categories` and show "not measured" when `available` is false. Finding guides in `apps/extension/src/locales/findings.en.ts` add verification text and optional examples. Rust still decides status, evidence, and the page-specific recommendation.

HTML `<title>` tags in the extension entrypoints are static copies of the product name. WXT does not import the TypeScript brand module into those HTML files, so a name change must update both places.

These identifiers stay technical and are not product branding:

- Rust crates remain `seo-core`, `seo-rules`, `seo-scoring`, and `seo-wasm`.
- `ENGINE_NAME` remains `seo-toolkit` inside audit JSON.
- The theme storage key remains `seoToolkit.theme`.
- In-page highlight markers remain `data-seo-toolkit-mark`, `seo-toolkit-highlight`, and `data-seo-toolkit-generation`.

## Localization

Interface strings use `en.ts`. Rule identifiers stay stable. English rule sentences are produced by Rust together with a `titleKey` so a later locale can override them without changing the rule id.

## Storage

The theme preference and optional PageSpeed API key can be stored locally. Comparison summaries are stored only after an explicit save action, capped at 20, and exclude full page text, links, and complete audit details. Exports are user-initiated downloads.

## Workbench navigation

UX-1 put Metadata through Social behind Inspect, and used one Current view select on the narrow report and the sidebar. The product owner rejected that presentation: the tools were hard to find, the select was large, and the overview did not feel like a workbench. UX-2 keeps the same sections and makes each one a direct destination.

The order is Overview, Issues, Metadata, Content, Headings, Links, Images, Schema, Social, Technical, Performance, International, Accessibility, and Sitemaps. History, Export, and Settings stay available. Schema is the short label for structured data. Performance, International, and Accessibility stay separate so `?section=performance` and the existing panels remain one selection.

A wide report shows that list in the left column. Buttons use `aria-current="page"`. History, Export, and Settings are visually separated and are not an extra step. Below 760px, and in the sidebar, the same list is one horizontal tab strip. Tabs do not wrap. Previous and next buttons scroll the strip, a fade shows that more tabs exist, and arrow keys, Home, and End move the selection. The active tab scrolls into view. There is no Current view select and no second tab row.

New features join this flat list. They do not add a group that must be opened before the feature. `?section=` still selects the section. Changing section scrolls the report to the top.

The overview shows the Rust score, a segmented count of errors, warnings, and passed checks, compact bars for measured categories under 100, and up to three existing findings. Unmeasured categories stay "Not measured". The score disclaimer stays on the page, after the findings. Open full report is the only primary button.

UX-3 keeps that list. The product owner rejected the UX-2 presentation: content sat too close to the edges, the score was only a number, and the tab arrows fought the scrollbar. The score is an SVG ring bound to the Rust value. The tab strip scrolls by drag, touch, and trackpad. Keyboard selection remains the way to reach a hidden tab without dragging.

The product owner then rejected the white cards UX-3 put on the cream canvas. UX-4 keeps the ring, the gutters, and the drag strip. Headings render in document order with a capped indent. They are a list, not an ARIA tree, because there is no tree keyboard model. Links use the same filters in the inspector. A content width under 640px uses stacked rows so a URL can wrap. Wider reports use a table whose cells wrap. Copy uses the collected URL. Highlight still targets a kind, such as every heading or every internal link, not one row.

UX-4 left the inspectors too plain. UX-5 uses the existing Save and compare card as the group treatment: ivory fill, a primary-mixed border, 18px radius, and the same wash. Cards wrap a section or a summary. They do not wrap each heading, link, or finding. Open Graph and X previews are separate inner frames. A missing or failed share image stays a short line until a real image loads. The tab strip keeps drag, touch, and keyboard access, and adds a scroll meter, edge fades, and a hint that can be dismissed in the existing local storage.

UX-6 keeps that card. JSON-LD uses `<details>` so a closed branch is not mounted. Depth stops at 8 and each node shows at most 40 children. Formatted JSON is a parse, and the source copy stays the captured text. Link groups follow the existing classification only: internal, external, or other. Attribute flags stay on the row. Search reveals groups with matches and restores the previous open state when cleared. Social spacing uses the existing 16px space token between the preview, Full values, and the notes. A wide report uses the same rows as the popup, with Show more after 40, rather than a second table.

## Site Explorer

The crawl coordinator stays in TypeScript because fetch, permissions, and HTML parsing are browser APIs. Each fetched HTML page is scored by the existing Rust page audit. Cross-page duplicate titles and descriptions, and whether a fetched link returned an error, are comparisons in TypeScript. They do not create a second score.

The crawler identity is `rankmiso` when robots.txt has that group. A matching group replaces `*`. It does not merge with it. The page audit's robots check remains Googlebot-specific. The extension cannot set the request User-Agent, so the browser sends its own.

Default scope is the exact origin. Optional host permission is requested only when Start is clicked, and only in Chromium. Firefox does not receive the network module, so the Firefox package does not contain the robots address. A failed robots.txt read allows no further fetches. A 404 allows them. Closing the report aborts the session. One stored session is a local record, not a resumed crawl.

## History

Saved comparisons stay in `chrome.storage.local` under `rankmiso.savedReports`, capped at 20. New records are schema version 2 and are written with `JSON.stringify`, so a Vue proxy is not stored. A record that already has the original summary fields is kept even when it has no history block, and even when its schema version is newer than 2. Unknown extra fields are dropped on the next write. A history block with a broken findings list is kept as counts only, and individual issues are then “Cannot determine”, not an empty resolved list.

A score change is comparable only when both saves record the same rule-set version and the same number of measured checks. Category changes also require the same applicable-check count for that category. The chart is an SVG of those saved points. It is not a second score.

## Sitemaps

The Sitemaps report reads files the user asks for. Chromium fetches only the approved page origin, with cookies omitted, redirects that leave the origin refused, and a stop at 8 files, 500 URLs, and 512 KB per file. XML is extracted in the browser and rejected if it has a DOCTYPE. Rust decides the findings. A nested index is a compatibility warning and is not followed. Firefox does not receive the robots address module and has no optional host permission. The older site check still reads only the first listed sitemap.

## Firefox

The Firefox package is Manifest V3 via `wxt build -b firefox --mv3`. The id is `rankmiso@rankmiso.extension`. The first accepted addons.mozilla.org upload locks it. Changing it after that makes Firefox treat the add-on as a different extension. `data_collection_permissions.required` is `none`.

Chromium optional host permissions stay out of the required set. **Run optional checks** requests the current origin, then fetches headers, robots.txt, the first listed sitemap, and at most 20 public links per batch. Private and local addresses are skipped. Chromium PageSpeed Insights requires an explicit user action and Google host permission; it sends the selected page URL and user-provided key to Google. Its results stay separate from the local score. Firefox ships neither external request feature, requests no optional host access, and declares no data collection. The JSON-LD rich-result row is a local field list and does not change the score, because that category weight is 0.

## Popup shell

UX-9R replaces the popup’s horizontal tab strip with a vertical rail. The report and the sidebar keep the earlier navigation. Popup destinations are `flatNav`, so Export and Settings are on the rail. The rail and the workspace scroll separately. The header and Open full report stay visible. Performance, International, and Accessibility use the short captions Perf, Intl, and A11y. The accessible name stays the full label. The health hero is a dark surface even in the light theme. Its number is the Rust score. An unavailable score is not shown as zero.

UX-9R.2 keeps that shell and restyles the other popup destinations around the same audit. A destination may show a navy summary only from values the audit already measured. The popup does not start a crawl, fetch a sitemap, or save history by being opened. Optional network checks stay in the report.

The UX-9R.2 exact pass follows the corrected prototype package. The popup Export shows JSON, CSV, and HTML report; the other CSV files are in the report. The popup Settings has no Rules row and no clear button; the report keeps both. Site and Sitemaps show the prototype layout, but their actions open the report because a popup closes when it loses focus. The popup resets Chrome's extension-page `font-size:75%` so it renders like the prototype.
