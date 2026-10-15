# Edge release

Not ready for the Edge Add-ons store.

```bash
pnpm build:wasm
pnpm --filter @rankmiso/extension build:edge
```

Edge uses the Chromium Manifest V3 package. Load `apps/extension/.output/edge-mv3` unpacked before any store upload. This session did not complete a separate Edge install test.
