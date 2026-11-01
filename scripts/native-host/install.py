#!/usr/bin/env python3
"""Register the local RankMiso native host for a Linux user profile."""

import argparse
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile

HOST_NAME = "com.misoecosystem.rankmiso"
FIREFOX_ID = "rankmiso@rankmiso.extension"
HOST_CONFIG = "native-host.json"


def config_root() -> Path:
    base = os.environ.get("CHROME_CONFIG_HOME") or os.environ.get(
        "XDG_CONFIG_HOME", Path.home() / ".config"
    )
    return Path(base).expanduser()


def browser_manifest_dir(browser: str, user_data_dir: str | None = None) -> Path:
    if browser == "firefox":
        if user_data_dir:
            raise ValueError("--user-data-dir is only supported for Chromium browsers")
        return Path.home() / ".mozilla" / "native-messaging-hosts"
    if user_data_dir:
        profile = Path(user_data_dir).expanduser().resolve(strict=True)
        if not profile.is_dir() or profile.is_symlink():
            raise ValueError("--user-data-dir must name an existing real directory")
        return profile / "NativeMessagingHosts"
    if browser == "chrome-for-testing":
        return config_root() / "google-chrome-for-testing" / "NativeMessagingHosts"
    if browser == "chromium":
        return config_root() / "chromium" / "NativeMessagingHosts"
    return config_root() / "google-chrome" / "NativeMessagingHosts"


def regular_file(path: Path) -> bool:
    try:
        mode = path.lstat().st_mode
        return stat.S_ISREG(mode)
    except FileNotFoundError:
        return False


def write_private(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if path.parent.is_symlink() or not path.parent.is_dir():
        raise ValueError(f"Unsafe configuration directory: {path.parent}")
    fd, temp_name = tempfile.mkstemp(prefix=".rankmiso-", dir=path.parent)
    temp_path = Path(temp_name)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb") as target:
            target.write(content)
            target.flush()
            os.fsync(target.fileno())
        # link() publishes the complete file atomically and refuses to replace
        # an existing manifest or configuration.
        os.link(temp_path, path)
    finally:
        try:
            temp_path.unlink()
        except FileNotFoundError:
            pass


def install(args: argparse.Namespace) -> None:
    executable = Path(args.executable).expanduser().resolve(strict=True)
    audit_dir = Path(args.audit_dir).expanduser().resolve(strict=True)
    if not executable.is_file() or not os.access(executable, os.X_OK):
        raise ValueError("--executable must name an executable file")
    if not audit_dir.is_dir():
        raise ValueError("--audit-dir must name an existing directory")
    if args.browser == "firefox":
        if args.extension_id != FIREFOX_ID:
            raise ValueError(f"Firefox add-on ID must be exactly {FIREFOX_ID}")
        allowlist = {"allowed_extensions": [FIREFOX_ID]}
    else:
        if not re.fullmatch(r"[a-p]{32}", args.extension_id):
            raise ValueError("Provide the exact 32-character Chrome extension ID; wildcards are not allowed")
        allowlist = {"allowed_origins": [f"chrome-extension://{args.extension_id}/"]}

    config_path = config_root() / "rankmiso-mcp" / HOST_CONFIG
    if config_path.exists() or config_path.is_symlink():
        if not regular_file(config_path) or config_path.is_symlink():
            raise ValueError("Existing native-host configuration is not a regular file")
        config = json.loads(config_path.read_text(encoding="utf-8"))
        if config.get("auditDir") != str(audit_dir):
            raise ValueError("Existing native-host config uses a different audit directory; edit it explicitly before reinstalling")
    else:
        write_private(config_path, json.dumps({"auditDir": str(audit_dir)}, separators=(",", ":")).encode())

    manifest = {
        "name": HOST_NAME,
        "description": "RankMiso local audit sharing companion",
        "path": str(executable),
        "type": "stdio",
        **allowlist,
    }
    manifest_path = browser_manifest_dir(args.browser, args.user_data_dir) / f"{HOST_NAME}.json"
    if manifest_path.exists() or manifest_path.is_symlink():
        raise FileExistsError(f"A native host registration already exists at {manifest_path}; inspect it before replacing")
    write_private(manifest_path, json.dumps(manifest, indent=2).encode() + b"\n")
    print(f"Registered {args.browser} native host at {manifest_path}")
    print(f"Audit directory: {audit_dir}")


def uninstall(args: argparse.Namespace) -> None:
    path = browser_manifest_dir(args.browser, args.user_data_dir) / f"{HOST_NAME}.json"
    if path.is_symlink() or (path.exists() and not regular_file(path)):
        raise ValueError("Native host registration is not a regular file; refusing to remove it")
    if path.exists():
        value = json.loads(path.read_text(encoding="utf-8"))
        if value.get("name") != HOST_NAME:
            raise ValueError("Registration does not belong to RankMiso; refusing to remove it")
        path.unlink()
        print(f"Removed {args.browser} registration at {path}")
    else:
        print("RankMiso native host is not registered for this browser")
    print("Shared audit files and native-host configuration were left unchanged.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    add = subparsers.add_parser("install", help="register a user-level Linux native host")
    add.add_argument("--browser", choices=("chrome", "chrome-for-testing", "chromium", "firefox"), required=True)
    add.add_argument("--extension-id", required=True, help="exact browser extension ID; no wildcards")
    add.add_argument("--executable", required=True, help="absolute path to rankmiso-mcp-native-host")
    add.add_argument("--audit-dir", required=True, help="existing configured MCP audit directory")
    add.add_argument("--user-data-dir", help="existing Chromium profile directory (isolated test profiles)")
    remove = subparsers.add_parser("uninstall", help="remove a user-level browser registration")
    remove.add_argument("--browser", choices=("chrome", "chrome-for-testing", "chromium", "firefox"), required=True)
    remove.add_argument("--user-data-dir", help="existing Chromium profile directory (isolated test profiles)")
    args = parser.parse_args()
    try:
        install(args) if args.command == "install" else uninstall(args)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"rankmiso-native-host: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
