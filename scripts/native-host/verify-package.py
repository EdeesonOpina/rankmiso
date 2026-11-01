#!/usr/bin/env python3
"""Verify a built archive, then exercise install/upgrade/uninstall in isolated user paths."""

import hashlib
import json
import ntpath
import os
import shutil
import stat
import struct
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

EXPECTED = {
    "LICENSE",
    "README-INSTALL.md",
    "rankmiso-mcp" + (".exe" if os.name == "nt" else ""),
    "rankmiso-mcp-native-host" + (".exe" if os.name == "nt" else ""),
    "rankmiso-setup" + (".exe" if os.name == "nt" else ""),
}
HOST = "com.misoecosystem.rankmiso"
CHROME_ID = "gdklhfalmmahhgimegjlfnhmacimeonl"
FIREFOX_ID = "rankmiso@rankmiso.extension"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def safe_name(name):
    normalized = name.removeprefix("./")
    path = PurePosixPath(normalized)
    require(not path.is_absolute() and ".." not in path.parts, f"unsafe archive path: {name}")
    return normalized


def same_path(left, right, windows=None):
    left = os.fspath(left)
    right = os.fspath(right)
    if windows is None:
        windows = os.name == "nt"
    if windows:
        def key(value):
            value = ntpath.normcase(ntpath.normpath(value))
            if value.startswith("\\\\?\\unc\\"):
                return "\\\\" + value[8:]
            return value[4:] if value.startswith("\\\\?\\") else value

        return key(left) == key(right)
    return os.path.realpath(left) == os.path.realpath(right)


def extract_archive(archive, destination):
    names = set()
    if zipfile.is_zipfile(archive):
        with zipfile.ZipFile(archive) as package:
            for item in package.infolist():
                if item.is_dir():
                    continue
                name = safe_name(item.filename)
                require(name not in names, f"duplicate archive entry: {name}")
                names.add(name)
                mode = item.external_attr >> 16
                require(not mode or stat.S_IFMT(mode) in (0, stat.S_IFREG), f"non-regular archive entry: {name}")
                (destination / name).write_bytes(package.read(item))
    else:
        import tarfile

        with tarfile.open(archive, "r:gz") as package:
            for item in package.getmembers():
                if item.isdir():
                    continue
                name = safe_name(item.name)
                require(item.isfile(), f"non-regular archive entry: {name}")
                require(name not in names, f"duplicate archive entry: {name}")
                names.add(name)
                source = package.extractfile(item)
                require(source is not None, f"cannot read archive entry: {name}")
                (destination / name).write_bytes(source.read())
                if os.name != "nt":
                    (destination / name).chmod(item.mode & 0o777)
    require(names == EXPECTED, f"unexpected archive contents: {sorted(names)}")
    if os.name != "nt":
        for name in EXPECTED:
            if name.startswith("rankmiso-"):
                (destination / name).chmod(0o700)


def isolated_environment(root):
    env = os.environ.copy()
    env.pop("RANKMISO_MCP_AUDIT_DIR", None)
    env.pop("RANKMISO_MCP_NATIVE_CONFIG", None)
    home = root / "home"
    home.mkdir()
    env.update(HOME=str(home), USERPROFILE=str(home))
    if os.name == "nt":
        env.update(LOCALAPPDATA=str(root / "local-app-data"), APPDATA=str(root / "roaming-app-data"))
    elif sys.platform == "darwin":
        pass
    else:
        env.update(
            XDG_DATA_HOME=str(root / "xdg-data"),
            XDG_CONFIG_HOME=str(root / "xdg-config"),
            CHROME_CONFIG_HOME=str(root / "chrome-config"),
        )
    return env


def run(command, env, **kwargs):
    result = subprocess.run(command, env=env, text=True, capture_output=True, timeout=60, **kwargs)
    require(result.returncode == 0, f"{command[0]} failed ({result.returncode}): {result.stdout}\n{result.stderr}")
    return result


def native_ping(host, env):
    request = json.dumps({"protocolVersion": 1, "requestId": "ci", "type": "ping"}).encode()
    result = subprocess.run(
        [str(host)], env=env, input=struct.pack("<I", len(request)) + request,
        capture_output=True, timeout=20,
    )
    require(result.returncode == 0 and not result.stderr, f"Native Messaging process failed: {result.stderr!r}")
    require(len(result.stdout) >= 4, "Native Messaging response has no frame")
    size = struct.unpack("<I", result.stdout[:4])[0]
    require(len(result.stdout) == size + 4, "Native Messaging response framing is invalid")
    response = json.loads(result.stdout[4:])
    require(response.get("ok") is True and response.get("result", {}).get("status") == "ready", "Native Messaging ping failed")


def expected_manifests(env, data_dir):
    if os.name == "nt":
        chrome = data_dir / f"{HOST}-chrome.json"
        firefox = data_dir / f"{HOST}-firefox.json"
    elif sys.platform == "darwin":
        base = Path(env["HOME"]) / "Library/Application Support"
        chrome = base / "Google/Chrome/NativeMessagingHosts" / f"{HOST}.json"
        firefox = base / "Mozilla/NativeMessagingHosts" / f"{HOST}.json"
    else:
        chrome = Path(env["CHROME_CONFIG_HOME"]) / "google-chrome/NativeMessagingHosts" / f"{HOST}.json"
        firefox = Path(env["HOME"]) / ".mozilla/native-messaging-hosts" / f"{HOST}.json"
    return {"chrome": chrome, "firefox": firefox}


def validate_manifests(env, data_dir, installed_host):
    for browser, path in expected_manifests(env, data_dir).items():
        manifest = json.loads(path.read_text(encoding="utf-8"))
        require(manifest["name"] == HOST and manifest["type"] == "stdio", f"bad {browser} manifest")
        require(
            same_path(manifest["path"], installed_host),
            f"bad {browser} executable path: {manifest['path']!r} != {installed_host}",
        )
        if browser == "chrome":
            require(manifest.get("allowed_origins") == [f"chrome-extension://{CHROME_ID}/"], "Chrome identity is not exact")
            require("allowed_extensions" not in manifest, "unexpected Chrome authorization field")
        else:
            require(manifest.get("allowed_extensions") == [FIREFOX_ID], "Firefox identity is not exact")
            require("allowed_origins" not in manifest, "unexpected Firefox authorization field")


def validate_windows_registry(expected):
    if os.name != "nt":
        return
    import winreg

    keys = {
        "chrome": rf"Software\Google\Chrome\NativeMessagingHosts\{HOST}",
        "firefox": rf"Software\Mozilla\NativeMessagingHosts\{HOST}",
    }
    for browser, subkey in keys.items():
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, subkey) as key:
                value, _ = winreg.QueryValueEx(key, None)
        except FileNotFoundError:
            raise RuntimeError(f"{browser} registry registration is missing")
        require(same_path(value, expected[browser]), f"{browser} registry path is wrong")


def require_windows_registry_keys_absent():
    if os.name != "nt":
        return
    import winreg

    for subkey in (rf"Software\Google\Chrome\NativeMessagingHosts\{HOST}", rf"Software\Mozilla\NativeMessagingHosts\{HOST}"):
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, subkey):
                raise RuntimeError(f"refusing to modify an existing registry key: {subkey}")
        except FileNotFoundError:
            pass


def verify_checksum(archive):
    sidecar = Path(str(archive) + ".sha256")
    fields = sidecar.read_text(encoding="utf-8").strip().split()
    require(len(fields) == 2 and fields[1] == archive.name, "checksum sidecar must use the portable archive filename")
    actual = hashlib.sha256(archive.read_bytes()).hexdigest()
    require(actual == fields[0].lower(), "archive SHA-256 does not match")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    archive = Path(sys.argv[1]).resolve()
    upgrade_bin_dir = Path(sys.argv[2]).resolve()
    verify_checksum(archive)
    root = Path(tempfile.mkdtemp(prefix="rankmiso-package-ci-"))
    try:
        require_windows_registry_keys_absent()
        env = isolated_environment(root)
        extracted = root / "archive"
        extracted.mkdir()
        extract_archive(archive, extracted)
        setup = extracted / ("rankmiso-setup.exe" if os.name == "nt" else "rankmiso-setup")
        run([str(setup), "install"], env)
        installed_mcp = (Path(env["LOCALAPPDATA"]) if os.name == "nt" else (
            Path(env["HOME"]) / "Library/Application Support" if sys.platform == "darwin" else Path(env["XDG_DATA_HOME"])
        )) / "rankmiso-mcp" / "bin" / ("rankmiso-mcp.exe" if os.name == "nt" else "rankmiso-mcp")
        release_hash = sha256(installed_mcp)
        run([str(setup), "install"], env)
        require(sha256(installed_mcp) == release_hash, "repeat install changed the packaged MCP binary")
        for name in EXPECTED:
            if name.startswith("rankmiso-"):
                shutil.copy2(upgrade_bin_dir / name, extracted / name)
        run([str(setup), "install"], env)
        require(sha256(installed_mcp) != release_hash, "upgrade did not replace the installed MCP binary")
        data_base = Path(env["LOCALAPPDATA"]) if os.name == "nt" else (
            Path(env["HOME"]) / "Library/Application Support" if sys.platform == "darwin" else Path(env["XDG_DATA_HOME"])
        )
        data_dir = data_base / "rankmiso-mcp"
        bin_dir = data_dir / "bin"
        suffix = ".exe" if os.name == "nt" else ""
        installed_host = bin_dir / f"rankmiso-mcp-native-host{suffix}"
        validate_manifests(env, data_dir, installed_host)
        validate_windows_registry(expected_manifests(env, data_dir))
        native_ping(installed_host, env)
        config = Path(env["APPDATA"]) / "rankmiso-mcp/native-host.json" if os.name == "nt" else (
            data_dir / "native-host.json" if sys.platform == "darwin" else Path(env["XDG_CONFIG_HOME"]) / "rankmiso-mcp/native-host.json"
        )
        audit_dir = Path(json.loads(config.read_text(encoding="utf-8"))["auditDir"])
        marker = audit_dir / "rankmiso-shared-ci-preserve.json"
        marker.write_text('{"schemaVersion":1}', encoding="utf-8")
        run([str(setup), "uninstall"], env)
        require(marker.is_file() and config.is_file(), "uninstall removed user audit or configuration data")
        require(not installed_host.exists(), "uninstall left the host binary installed")
        require(all(not path.exists() for path in expected_manifests(env, data_dir).values()), "uninstall left a browser manifest")
        validate_windows_registry_absent()
        run([str(setup), "install"], env)
        require(marker.is_file(), "reinstall did not preserve existing audit data")
        native_ping(bin_dir / f"rankmiso-mcp-native-host{suffix}", env)
        run([str(setup), "uninstall"], env)
        require(marker.is_file(), "final uninstall removed user audit data")
        print(f"Verified checksum, archive, install/repeat/upgrade/uninstall, host ping, registration and data retention: {archive.name}")
    finally:
        if os.name == "nt":
            cleanup_windows_registry(root)
        shutil.rmtree(root, ignore_errors=True)


def validate_windows_registry_absent():
    if os.name != "nt":
        return
    import winreg

    for subkey in (rf"Software\Google\Chrome\NativeMessagingHosts\{HOST}", rf"Software\Mozilla\NativeMessagingHosts\{HOST}"):
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, subkey) as key:
                try:
                    winreg.QueryValueEx(key, None)
                except FileNotFoundError:
                    continue
                raise RuntimeError(f"uninstall left registry registration: {subkey}")
        except FileNotFoundError:
            continue


def cleanup_windows_registry(root):
    if os.name != "nt":
        return
    import winreg

    for subkey in (rf"Software\Google\Chrome\NativeMessagingHosts\{HOST}", rf"Software\Mozilla\NativeMessagingHosts\{HOST}"):
        delete_empty_key = False
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, subkey, 0, winreg.KEY_READ | winreg.KEY_WRITE) as key:
                try:
                    value, _ = winreg.QueryValueEx(key, None)
                    if str(root).lower() in str(value).lower():
                        winreg.DeleteValue(key, None)
                except FileNotFoundError:
                    pass
                subkeys, values, _ = winreg.QueryInfoKey(key)
                delete_empty_key = subkeys == 0 and values == 0
        except FileNotFoundError:
            pass
        except OSError:
            pass
        if delete_empty_key:
            try:
                winreg.DeleteKey(winreg.HKEY_CURRENT_USER, subkey)
            except OSError:
                pass


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"package verification failed: {error}", file=sys.stderr)
        raise SystemExit(1)
