# Chrome release

Do this after the Firefox upload in [firefox.md](firefox.md). The Chrome package is a separate store, a separate developer account, and a separate review.

The product name is already RankMiso. Icons are already generated from the fox sticker.

When you are ready:

1. Run `pnpm build:wasm` and `pnpm --filter @rankmiso/extension build`.
2. Load `apps/extension/.output/chrome-mv3` as an unpacked extension and repeat the same page checks used for Firefox.
3. Zip that folder so `manifest.json` is at the root of the archive.
4. Confirm manifest version 3, permissions `storage`, `activeTab`, `scripting`, and `sidePanel`, optional host permissions only, and a `.wasm` file inside the zip.
5. Publish the same privacy text as `PRIVACY.md` at a public HTTPS URL. The Chrome Web Store listing has to point at that URL.
6. Use the same listing boundaries as Firefox: no rankings, no PageSpeed Insights, and no claim that Largest Contentful Paint, Cumulative Layout Shift, or Interaction to Next Paint are measured.

Nothing has been uploaded to the Chrome Web Store.
