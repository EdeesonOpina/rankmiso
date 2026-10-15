#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/apps/extension/public/brand/icon.png"
OUT="$ROOT/apps/extension/public"

if [[ ! -f "$SOURCE" ]]; then
  echo "Missing icon source: $SOURCE" >&2
  echo "Place a PNG at apps/extension/public/brand/icon.png, then run pnpm brand:icons." >&2
  exit 1
fi

if ! command -v identify >/dev/null || ! command -v convert >/dev/null; then
  echo "ImageMagick identify and convert are required." >&2
  exit 1
fi

width="$(identify -format '%w' "$SOURCE")"
height="$(identify -format '%h' "$SOURCE")"
if (( width < 128 || height < 128 )); then
  echo "icon.png must be at least 128x128. Found ${width}x${height}." >&2
  exit 1
fi

for size in 16 32 48 128; do
  convert "$SOURCE" \
    -filter Lanczos \
    -resize "${size}x${size}" \
    -colors 256 \
    -depth 8 \
    -strip \
    -define png:compression-level=9 \
    "PNG8:$OUT/icon-${size}.png"
  echo "Wrote $OUT/icon-${size}.png ($(identify -format '%wx%h %b' "$OUT/icon-${size}.png"))"
done
