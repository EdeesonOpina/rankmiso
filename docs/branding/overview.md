# Brand

RankMiso is a free, open-source SEO browser extension in the Miso ecosystem.

The line on the product is **Every page. Every detail.** The wider Miso idea is powerful tools with less overhead.

## What is settled

The name, the tagline, and the promise are settled: free, open source, no subscription, no telemetry, no ads, and no required backend.

`apps/extension/src/config/brand.config.ts` is the only place those words are defined. Components and the manifest read it from there.

## What is still in progress

The palette in `packages/design-tokens` is a temporary Miso-inspired set. It is configurable. It is not a finished visual system.

The mark in the toolbar and the header is the fox sticker supplied for this project. The black field was removed and the file was reduced to a small 8-bit PNG so the icon stays light at 16 pixels. Treat it as the artwork in use, not as a signed-off mascot.

`pnpm icons` would replace that fox with the older geometric M. Use it only when you want the placeholder back. To drop in a new PNG, follow `asset-replacement.md`.

## Where to look

| Topic | File |
| --- | --- |
| Name and links | `apps/extension/src/config/brand.config.ts` |
| Colors and type | [design-tokens.md](design-tokens.md) |
| Replacing the PNG | [asset-replacement.md](asset-replacement.md) |
| How the UI reads the brand | [../design-system/branding.md](../design-system/branding.md) |
