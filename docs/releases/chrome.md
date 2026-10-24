# Chrome release

RankMiso is available in the Chrome Web Store. The repository is being prepared for v0.2.0; that version has not been submitted or published.

The product name is already RankMiso. Icons are already generated from the fox sticker.

When you are ready:

1. Confirm `apps/extension/package.json` is version `0.2.0`, then run `pnpm build:wasm` and `pnpm --filter @rankmiso/extension build`.
2. Load `apps/extension/.output/chrome-mv3` as an unpacked extension and repeat the same page checks used for Firefox.
3. Zip that folder so `manifest.json` is at the root of the archive.
4. Confirm manifest version 3, permissions `storage`, `activeTab`, `scripting`, and `sidePanel`, optional host permissions only, and a `.wasm` file inside the zip.
5. Publish the same privacy text as `PRIVACY.md` at a public HTTPS URL. The Chrome Web Store listing has to point at that URL.
6. Update the listing to describe local browser observations, explicit page-scoped INP capture, and the optional, user-triggered PageSpeed Insights request accurately. Do not claim rankings, field metrics, or official rich-result eligibility.
