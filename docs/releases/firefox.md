# Firefox release

Not ready for addons.mozilla.org.

Build with:

```bash
pnpm build:wasm
pnpm --filter @rankmiso/extension build:firefox
```

The script passes `--mv3`. Confirm `apps/extension/.output/firefox-mv3/manifest.json` says manifest version 3 before packaging.

Replace `rankmiso@local.dev` with a permanent extension id before submission. Keep `data_collection_permissions.required` as `none` unless a later feature truly collects data, in which case the privacy policy and this setting must change together.

Load a local build from `about:debugging` → **This Firefox** → **Load Temporary Add-on**, and select `manifest.json` inside `apps/extension/.output/firefox-mv3`. The maintainer has used that package on live pages. The sidebar entry is declared and has not been checked in a Firefox window.

Firefox's sidebar uses `sidebar_action`. Do not describe the side panel as identical to Chrome until both have been installed and checked.
