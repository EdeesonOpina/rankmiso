#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v google-chrome >/dev/null 2>&1; then
  printf '%s\n' "RankMiso MCP dev session requires Google Chrome on Linux." >&2
  exit 1
fi

cd "$ROOT_DIR"
printf '%s\n' "[1/4] Building the Rust MCP server and Native Messaging companion..."
cargo build --release -p rankmiso-mcp --locked
printf '%s\n' "[2/4] Building RankMiso WebAssembly..."
pnpm build:wasm
printf '%s\n' "[3/4] Building the Chrome extension..."
pnpm --filter @rankmiso/extension build
printf '%s\n' "[4/4] Opening an isolated Chrome MCP test session..."
cd "$ROOT_DIR/apps/extension"
pnpm exec node browser-tests/native-mcp-dev-session.mjs
