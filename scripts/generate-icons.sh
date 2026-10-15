#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRAND="$ROOT/apps/extension/public/brand"
ASSETS="$ROOT/apps/extension/assets/brand"
mkdir -p "$BRAND"
convert -background none "$ASSETS/mark.svg" -resize 256x256 "$BRAND/logo-light.png"
convert -background none "$ASSETS/mark-dark.svg" -resize 256x256 "$BRAND/logo-dark.png"
convert -background none "$ASSETS/icon.svg" -resize 256x256 "$BRAND/icon.png"
bash "$ROOT/scripts/brand-icons.sh"
