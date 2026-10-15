#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi
cargo build -p seo-wasm --release --target wasm32-unknown-unknown --target-dir target
mkdir -p apps/extension/src/wasm/pkg
wasm-bindgen \
  --target web \
  --out-dir apps/extension/src/wasm/pkg \
  target/wasm32-unknown-unknown/release/seo_wasm.wasm
