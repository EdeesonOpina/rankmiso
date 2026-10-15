# Contributing

RankMiso stays local, honest about what it measured, and free of accounts. Changes should keep that shape.

## Setup

Install Rust stable, the `wasm32-unknown-unknown` target, `wasm-bindgen-cli` 0.2.100, Node.js 22 or newer, and pnpm 10.

```bash
pnpm install
pnpm build:wasm
pnpm --filter @rankmiso/extension dev
```

Load the unpacked extension from `apps/extension/.output/chrome-mv3` after a production build, or use the development directory printed by `pnpm dev`.

## Checks

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
pnpm --filter @rankmiso/report-formats test
pnpm --filter @rankmiso/extension test
pnpm --filter @rankmiso/extension typecheck
```

## Product rules

- Do not add a backend, account system, telemetry, or paid feature.
- Do not invent search volume, keyword difficulty, traffic, or backlink counts.
- Do not treat an unavailable check as a pass.
- Keep brand strings in `apps/extension/src/config`.
- Keep SEO rules in the Rust crates. Vue renders results.
- Update `docs/development/progress.md` and `docs/development/handoff.md` when you stop.

## Conduct

See `CODE_OF_CONDUCT.md`.
