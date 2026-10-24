# Handoff

Date: 2026-10-24

## Repository

The project is this repository.

The directory was renamed from `seo-toolkit`. The old directory no longer exists. The git remote is `https://github.com/EdeesonOpina/rankmiso.git` and is private. The v0.2.0 release-preparation branch is `release/v0.2.0`, based on the current `master` branch. Do not commit, push, or change visibility unless the maintainer asks.

## Product identity

RankMiso, in the Miso ecosystem. Tagline: “Every page. Every detail.”

`apps/extension/src/config/brand.config.ts` is the only brand source. The manifest name, description, and Firefox id `rankmiso@rankmiso.extension` come from it. `packages/design-tokens/src/tokens.css` holds `--miso-color-*` and `--miso-font-*`. Existing Tailwind names alias those tokens.

The toolbar icon and header mark are the supplied fox sticker, saved as a transparent 8-bit PNG. `pnpm icons` would replace it with the geometric M. Replacement steps are in `docs/branding/asset-replacement.md`.

Workspace packages are `rankmiso`, `@rankmiso/extension`, `@rankmiso/design-tokens`, and `@rankmiso/report-formats`.

These names stay technical:

- Rust crates `seo-core`, `seo-rules`, `seo-scoring`, `seo-wasm`
- `ENGINE_NAME` = `seo-toolkit` in audit JSON
- Theme storage key `seoToolkit.theme`
- Page markers `data-seo-toolkit-mark`, `seo-toolkit-highlight`, and `data-seo-toolkit-generation`

## Environment

- Rust 1.99.0 through rustup. Source `$HOME/.cargo/env` before Cargo commands.
- `wasm32-unknown-unknown` and `wasm-bindgen` 0.2.100.
- Node 24 and pnpm 10.27.0.
- ImageMagick `convert` and `identify` are required for `pnpm brand:icons`.
- `esbuild` is listed under `pnpm.onlyBuiltDependencies`.

## What still works

The analysis slice is unchanged: popup tabs (Overview, JSON-LD, Headings, Links, Images, Social), dashboard report, confirmed exports, copy actions, thousands separators, readable JSON-LD, share cards, horizontal image rows, and light/dark/system theme. Dashboard field labels and status badges now use `src/locales/en.ts`.

## Verified on 2026-10-15 after the move

- Rust format, Clippy, and 26 tests passed (23 rules, 3 scoring).
- Extension tests: 17 passed. `vue-tsc` and ESLint passed.
- Firefox MV3 production build passed and includes the local WASM file. Gecko id is `rankmiso@rankmiso.extension`.
- Chrome was not rebuilt in this pass.

## Release status

RankMiso is available in both the Chrome Web Store and Firefox Add-ons. Version 0.2.0 is being prepared on `release/v0.2.0`; it has not been submitted or published. Follow `docs/releases/chrome.md` and `docs/releases/firefox.md` for build and store preparation. The verification notes above describe earlier builds and are historical; verify the currently published versions before relying on them for browser-specific behavior.

## Not verified

- Firefox runtime installation and Edge installation automation. Playwright checks the Firefox package metadata and assets but loads only the Chromium extension.
- Highlight and clear on a live page.
- Whether every remote share image loads inside the extension page.

Chrome and Firefox are published. The maintainer previously loaded the unpacked Chrome extension and used its popup and side panel on a live page.

Reload the extension after rebuilding. Firefox temporary add-ons disappear when Firefox quits. Load `apps/extension/.output/firefox-mv3/manifest.json` from `about:debugging`.

## Remaining product work

1. Decide whether Firefox and Edge need automated install coverage beyond manual checks.
2. Continue SERP work carefully: the current metadata preview is approximate and editable, and does not simulate location or report rankings.
3. Compare local benchmark results on the same machine before drawing performance conclusions.
4. The local schema field list remains informational. The existing Google validator link is the official eligibility handoff.
5. MCP is planned only. Review Phase 7 in `docs/development/implementation-plan.md`; no MCP server or extension bridge exists yet.

## Do not

- Add host permissions to the default manifest to make development easier.
- Mark unavailable checks as passes.
- Copy visual layouts or text from reference extensions.
- Upgrade `wasm-bindgen` without upgrading the CLI in the same change.
- Put `color: inherit` on `button` outside `@layer`.
- Leave bare `border` or `border-b` on `currentColor`. Default border color is the `--border` token.
- Hardcode the product name or hex colors in Vue components.
- Treat the geometric M or the current palette as the final Miso identity.

## Useful entry points

- `apps/extension/src/config/brand.config.ts`
- `packages/design-tokens/src/tokens.css`
- `scripts/brand-icons.sh`
- `docs/branding/asset-replacement.md`
- `crates/seo-rules/src/lib.rs` — `analyze`
- `apps/extension/src/extraction/page-tool.ts` — `runPageTool`
- `apps/extension/src/composables/useAudit.ts`
- `apps/extension/entrypoints/popup/App.vue`
- `apps/extension/src/components/AnalysisApp.vue`
