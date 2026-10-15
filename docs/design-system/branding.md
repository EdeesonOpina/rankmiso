# Branding in the interface

RankMiso’s name, tagline, and asset paths live in `apps/extension/src/config/brand.config.ts`. The manifest, the popup, and the report read that file. Do not hardcode the product name in a component.

`wxt.config.ts` copies `identity.name`, `identity.description`, and the Firefox id into the manifest. HTML titles in the entrypoints are a static copy of the name, because those files are not generated from the TypeScript config. Change both when the name changes.

Colors and type live in `packages/design-tokens/src/tokens.css`. The fox mark is the icon in use. `pnpm brand:icons` turns `apps/extension/public/brand/icon.png` into the toolbar sizes. Steps are in `docs/branding/asset-replacement.md`.

Interface copy lives in `apps/extension/src/locales/en.ts`. Rule sentences stay in Rust, with a stable `titleKey`.

Website, GitHub, documentation, and support links are `null` until those destinations exist.
