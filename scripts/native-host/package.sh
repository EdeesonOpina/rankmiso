#!/bin/sh
set -eu

triple=${1:?Rust target required}
target=${2:?target label required}
release_version=${3:?release version required}
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT HUP INT TERM

cp "$root/target/$triple/release/rankmiso-mcp" "$stage/"
cp "$root/target/$triple/release/rankmiso-mcp-native-host" "$stage/"
cp "$root/target/$triple/release/rankmiso-setup" "$stage/"
cp "$root/docs/mcp/INSTALL.md" "$stage/README-INSTALL.md"
cp "$root/LICENSE" "$stage/LICENSE"
chmod 700 "$stage/rankmiso-mcp" "$stage/rankmiso-mcp-native-host" "$stage/rankmiso-setup"

mkdir -p "$root/dist"
archive="$root/dist/rankmiso-mcp-companion-${release_version}-${target}.tar.gz"
tar -C "$stage" -czf "$archive" .
(cd "$root/dist" && shasum -a 256 "$(basename "$archive")" > "$(basename "$archive").sha256")
actual=$(tar -tzf "$archive" | sed 's#^\./##' | sed '/^$/d' | LC_ALL=C sort)
expected=$(printf '%s\n' LICENSE README-INSTALL.md rankmiso-mcp rankmiso-mcp-native-host rankmiso-setup | LC_ALL=C sort)
if [ "$actual" != "$expected" ]; then
  printf '%s\n' "Archive contents differ from the expected companion files:" "$actual" >&2
  exit 1
fi
(cd "$root/dist" && shasum -a 256 -c "$(basename "$archive").sha256")
printf '%s\n' "$archive" "$archive.sha256"
