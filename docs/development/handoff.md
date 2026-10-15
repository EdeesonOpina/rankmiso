# Handoff

Date: 2026-10-15

## Repository

`/home/lenovo/Projects/Rust/rankmiso`

The directory was renamed from `/home/lenovo/Projects/Rust/seo-toolkit` on the same filesystem. The old path no longer exists. The project is not a git repository and has no remote. Do not commit, push, or create a remote unless the maintainer asks.

## Product identity

RankMiso, in the Miso ecosystem. Tagline: “Every page. Every detail.”

`apps/extension/src/config/brand.config.ts` is the only brand source. The manifest name, description, and Firefox id `rankmiso@local.dev` come from it. `packages/design-tokens/src/tokens.css` holds `--miso-color-*` and `--miso-font-*`. Existing Tailwind names alias those tokens.

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

- Rust format, Clippy, and 18 tests passed.
- Frozen pnpm install passed.
- Report-format tests: 4 passed. Extension tests: 14 passed.
- `vue-tsc`, Prettier, and ESLint passed.
- Chrome MV3 and Firefox MV3 production builds passed and include the local WASM file, brand PNGs, and 16/32/48/128 icons.
- Built manifest name is RankMiso. Firefox id is `rankmiso@local.dev`.

## Not verified

- Chrome, Edge, or Firefox after this rename. A compiled bundle is not a browser test.
- Chrome side panel and Firefox sidebar on a live window.
- Highlight and clear on a live page.
- Whether every remote share image loads inside the extension page.

Reload the extension after rebuilding. Firefox temporary add-ons disappear when Firefox quits. Load `apps/extension/.output/firefox-mv3/manifest.json` from `about:debugging`.

## Next tasks

1. Add a Playwright test that loads the built extension only after the manual path stays stable.
2. Design the opt-in network client for broken links before implementing it. Include timeouts, concurrency, scheme limits, and private-network blocking.
3. Re-check the Chrome side panel and Firefox sidebar on a live window.
4. Replace `rankmiso@local.dev` before any store submission.

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
