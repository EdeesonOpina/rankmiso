# WASM boundary

`analyze_page(snapshot_json, options_json)` returns an audit JSON string or throws a JSON error with `code` and `message`.

The extension loads `seo_wasm_bg.wasm` from the extension package with the web target of `wasm-bindgen` 0.2.100. Extension pages set `script-src 'self' 'wasm-unsafe-eval'`.

`analyzedAt` is the snapshot's `collectedAt`. The engine does not read a clock, so the same snapshot produces the same audit.

Errors:

- `INVALID_JSON` when the snapshot cannot be parsed
- `SCHEMA_UNSUPPORTED` when `schemaVersion` is not 1
- `INVALID_OPTIONS` when the options JSON is present and invalid

Empty options use the default stop-word list and term limit.
