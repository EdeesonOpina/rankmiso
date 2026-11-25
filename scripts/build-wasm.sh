#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi
cargo build -p seo-wasm --release --target wasm32-unknown-unknown --target-dir target
mkdir -p apps/extension/src/wasm/pkg
# The name section only serves debuggers (about 200 KB); shipped builds do not need it.
wasm-bindgen \
  --target web \
  --remove-name-section \
  --remove-producers-section \
  --out-dir apps/extension/src/wasm/pkg \
  target/wasm32-unknown-unknown/release/seo_wasm.wasm
