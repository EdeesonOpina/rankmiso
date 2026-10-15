# Chrome release

Not ready for the Chrome Web Store.

When it is ready:

1. Set the final name in `brand.config.ts` and regenerate icons.
2. Run `pnpm build:wasm` and `pnpm --filter @rankmiso/extension build`.
3. Zip `apps/extension/.output/chrome-mv3`.
4. Confirm the manifest version is 3, permissions are the required set, and the WASM file is inside the zip.
5. Publish the privacy text from `PRIVACY.md`.

This session produced a local MV3 build only.
