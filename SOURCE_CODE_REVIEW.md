# Firefox source code review — RankMiso v0.4.0

This source archive is for Mozilla review of the RankMiso v0.4.0 candidate. It is paired with `rankmiso-v0.4.0-firefox.zip`; it is not a store submission. The source includes the Rust workspace, generated-WASM build script, Vue/TypeScript extension, WXT configuration, `Cargo.lock`, `pnpm-lock.yaml`, and workspace package manifests. It excludes build caches, `node_modules`, Rust `target`, extension `.output`, credentials, and unrelated working-tree marketing changes.

## Tested environment

- Ubuntu Linux x86_64
- Node.js 22.23.3
- pnpm 10.27.0 (repository `packageManager` pin)
- Rust 1.99.1 (the build used the repository's stable toolchain)
- Rust target `wasm32-unknown-unknown`
- `wasm-bindgen-cli` 0.2.100 (must match the exact crate version)

The build uses open-source Cargo and pnpm dependencies locked by the included lockfiles. No `.env` file or secret is required.

## Reproduce the Firefox extension

From the archive root:

```sh
pnpm install --frozen-lockfile
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.100 --locked
pnpm build:wasm
pnpm --filter @rankmiso/extension exec wxt build -b firefox --mv3
```

The extension output is `apps/extension/.output/firefox-mv3/`. Verify its `manifest.json` version is `0.4.0`, its Gecko ID remains `rankmiso@rankmiso.extension`, and its required host permissions remain absent. Firefox data collection remains `required: ["none"]`.

To generate WXT's Firefox extension archive:

```sh
pnpm --filter @rankmiso/extension exec wxt zip -b firefox --mv3
```

For the complete Mozilla source archive, use the repository's source-packaging script from the isolated release snapshot (not from a developer's dirty checkout):

```sh
bash scripts/package-firefox-sources.sh /tmp/rankmiso-v0.4.0-firefox-sources.zip
```

The script includes the monorepo workspace and Rust inputs while excluding Git metadata, dependencies, build outputs, test artifacts, UX review screenshots, generated marketing captures, and environment files. The archive root is the repository root.

The Firefox Site Explorer implementation uses the shared, user-started crawler. Firefox standalone sitemap discovery, PageSpeed Insights, and optional technical probes remain disabled. No submission command is part of these instructions.

## Matching check

The release engineer should extract the source ZIP into a clean directory, install locked dependencies, run the WASM and Firefox build commands above, and compare the generated `.output/firefox-mv3` files with the Firefox extension ZIP. ZIP timestamps and archive ordering may differ; extracted extension file paths and contents should match. The source reproduction result is recorded in the release QA report.
