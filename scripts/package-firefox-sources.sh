#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
archive_path="${1:-$repo_root/apps/extension/.output/release-candidate/rankmiso-v0.4.0-firefox-sources.zip}"

python3 - "$repo_root" "$archive_path" <<'PY'
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
import os
import stat
import sys

root = Path(sys.argv[1]).resolve()
archive = Path(sys.argv[2]).resolve()
archive.parent.mkdir(parents=True, exist_ok=True)
excluded_dirs = {
    ".git", ".wxt", "node_modules", "target", ".output", "dist", "coverage",
    "playwright-report", "test-results", "captures", "output",
}
excluded_prefixes = {"docs/design/reviews/", "marketing/captures/", "marketing/output/"}
excluded_names = {".DS_Store"}
excluded_suffixes = {".log"}

with ZipFile(archive, "w", compression=ZIP_DEFLATED, compresslevel=9) as bundle:
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.resolve() == archive:
            continue
        rel = path.relative_to(root).as_posix()
        parts = Path(rel).parts
        if any(part in excluded_dirs for part in parts):
            continue
        if any(rel.startswith(prefix) for prefix in excluded_prefixes):
            continue
        if path.name in excluded_names or path.suffix in excluded_suffixes or path.name.startswith(".env"):
            continue
        info = ZipInfo(rel, date_time=(2020, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.create_system = 3
        info.external_attr = (stat.S_IMODE(path.stat().st_mode) & 0xFFFF) << 16
        bundle.writestr(info, path.read_bytes())

print(archive)
PY
