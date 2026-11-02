"""Tests for the RankMiso Claude Code / Codex plugin launcher.

Run `cargo build -p rankmiso-mcp --bins` first. The end-to-end tests install
locally built companion binaries from a test archive into a throwaway HOME,
with every download check still applied.
"""

import io
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tarfile
import tempfile
import unittest
import hashlib

ROOT = Path(__file__).resolve().parents[2]
PLUGIN = ROOT / "plugins/rankmiso"
LAUNCHER = PLUGIN / "bin/rankmiso"
BUILD = ROOT / "target/debug"
AUDIT = Path(__file__).with_name("fixtures") / "shared-audit.json"
BINARIES = ["rankmiso-mcp", "rankmiso-mcp-native-host", "rankmiso-setup"]
HOST_NAME = "com.misoecosystem.rankmiso"
CHROME_ORIGIN = "chrome-extension://gdklhfalmmahhgimegjlfnhmacimeonl/"


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


class ManifestTests(unittest.TestCase):
    def test_both_hosts_launch_the_same_launcher_in_mcp_mode(self):
        claude = load("plugins/rankmiso/.mcp.json")["mcpServers"]["rankmiso"]
        self.assertEqual(claude, {"command": "sh", "args": ["${CLAUDE_PLUGIN_ROOT}/bin/rankmiso", "mcp"]})
        codex = load("plugins/rankmiso/mcp.json")["mcpServers"]["rankmiso"]
        self.assertEqual(codex["type"], "stdio")
        self.assertEqual(codex["command"], "sh")
        self.assertEqual(codex["args"], ["./bin/rankmiso", "mcp"])
        self.assertEqual(codex["cwd"], "./")

    def test_manifests_agree_and_marketplaces_point_at_the_plugin(self):
        claude = load("plugins/rankmiso/.claude-plugin/plugin.json")
        codex = load("plugins/rankmiso/.codex-plugin/plugin.json")
        self.assertEqual(claude["name"], "rankmiso")
        self.assertEqual(codex["name"], "rankmiso")
        self.assertEqual(claude["version"], codex["version"])
        self.assertIn(f"PLUGIN_VERSION={claude['version']}\n", LAUNCHER.read_text())
        self.assertEqual(codex["mcpServers"], "./mcp.json")
        self.assertTrue((PLUGIN / codex["interface"]["composerIcon"]).is_file())
        claude_market = load(".claude-plugin/marketplace.json")
        self.assertEqual(claude_market["plugins"][0]["source"], "./plugins/rankmiso")
        codex_market = load(".agents/plugins/marketplace.json")
        self.assertEqual(codex_market["plugins"][0]["source"], {"source": "local", "path": "./plugins/rankmiso"})

    def test_every_skill_has_name_and_description(self):
        skills = sorted(p.parent.name for p in (PLUGIN / "skills").glob("*/SKILL.md"))
        self.assertEqual(skills, ["analyze-audit", "connect", "fix-seo", "troubleshoot"])
        for name in skills:
            head = (PLUGIN / "skills" / name / "SKILL.md").read_text().split("---")[1]
            self.assertIn(f"name: {name}\n", head)
            self.assertIn("description: ", head)


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="rankmiso-plugin-")
        self.root = Path(self.temp.name)
        self.home = self.root / "home"
        self.home.mkdir()
        self.shim = self.root / "shim"
        self.shim.mkdir()
        self.tmp = self.root / "tmp"
        self.tmp.mkdir()
        self.env = {"HOME": str(self.home), "PATH": f"{self.shim}:/usr/bin:/bin", "TMPDIR": str(self.tmp)}
        self.data = self.home / ".local/share/rankmiso-mcp"
        self.audits = self.data / "audits"
        self.chrome = self.home / f".config/google-chrome/NativeMessagingHosts/{HOST_NAME}.json"
        self.firefox = self.home / f".mozilla/native-messaging-hosts/{HOST_NAME}.json"

    def tearDown(self):
        for path in self.root.rglob("*"):
            if path.is_dir() and not path.is_symlink():
                path.chmod(0o700)
        self.temp.cleanup()

    def run_launcher(self, *args, env=None, expected=0, stdin=subprocess.DEVNULL):
        result = subprocess.run(
            ["sh", str(LAUNCHER), *args],
            env={**self.env, **(env or {})},
            stdin=stdin,
            capture_output=True,
            text=True,
            timeout=60,
        )
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return result.stdout + result.stderr

    def shim_command(self, name, script):
        path = self.shim / name
        path.write_text("#!/bin/sh\n" + script)
        path.chmod(0o700)

    def archive(self, members=None):
        """Builds a release-shaped archive. `members` maps name -> TarInfo tweaks."""
        path = self.root / "companion.tar.gz"
        with tarfile.open(path, "w:gz") as tar:
            for name in ["LICENSE", "README-INSTALL.md"]:
                data = b"text"
                info = tarfile.TarInfo(f"./{name}")
                info.size = len(data)
                tar.addfile(info, io.BytesIO(data))
            for name in BINARIES:
                tar.add(BUILD / name, arcname=f"./{name}")
            for info, data in members or []:
                tar.addfile(info, io.BytesIO(data) if data else None)
        return path, hashlib.sha256(path.read_bytes()).hexdigest()

    def offline_install_env(self, archive=None):
        path, digest = archive or self.archive()
        return {"RANKMISO_TEST_ARCHIVE": str(path), "RANKMISO_TEST_SHA256": digest}

    def require_build(self):
        if not all((BUILD / name).is_file() for name in BINARIES):
            self.skipTest("run `cargo build -p rankmiso-mcp --bins` first")

    def assert_nothing_installed(self):
        self.assertFalse(self.data.exists())
        self.assertFalse(self.chrome.exists())
        self.assertEqual(list(self.tmp.iterdir()), [], "temporary download was not cleaned up")

    # Missing and unsupported setups

    def test_missing_companion_gives_guidance_and_plan_changes_nothing(self):
        self.assertIn("NOT INSTALLED", self.run_launcher("status", expected=1))
        self.assertIn("Connect RankMiso", self.run_launcher("mcp", expected=1))
        plan = self.run_launcher("connect")
        self.assertIn("no changes made yet", plan)
        self.assertIn("8d3766354cad5329a66bbc217383d65d3dad0e449113adc9877006e8fb33f81a", plan)
        self.assertIn("rankmiso connect --yes", plan)
        self.assertEqual(list(self.home.iterdir()), [])

    def test_unsupported_platform_is_reported_clearly(self):
        self.shim_command("uname", 'case "$1" in -s) echo Linux;; -m) echo aarch64;; esac\n')
        out = self.run_launcher("connect", "--yes", expected=2)
        self.assertIn("no Linux ARM64 companion build", out)
        self.assertIn("no Linux ARM64", self.run_launcher("mcp", expected=2))
        self.assertEqual(list(self.home.iterdir()), [])

    def test_offline_download_fails_without_changes(self):
        self.shim_command("curl", "echo 'curl: (6) Could not resolve host' >&2; exit 6\n")
        out = self.run_launcher("connect", "--yes", expected=1)
        self.assertIn("Download failed", out)
        self.assert_nothing_installed()

    # Download verification

    def test_checksum_mismatch_is_rejected(self):
        self.require_build()
        path, _ = self.archive()
        out = self.run_launcher("connect", "--yes", env={"RANKMISO_TEST_ARCHIVE": str(path), "RANKMISO_TEST_SHA256": "0" * 64}, expected=1)
        self.assertIn("Checksum mismatch", out)
        self.assert_nothing_installed()

    def test_unsafe_archive_members_are_rejected(self):
        self.require_build()
        cases = {}
        info = tarfile.TarInfo("../escape")
        info.size = 1
        cases["traversal"] = [(info, b"x")]
        info = tarfile.TarInfo("/tmp/absolute")
        info.size = 1
        cases["absolute"] = [(info, b"x")]
        info = tarfile.TarInfo("./link")
        info.type = tarfile.SYMTYPE
        info.linkname = "/etc/passwd"
        cases["symlink"] = [(info, None)]
        info = tarfile.TarInfo("./extra")
        info.size = 1
        cases["extra file"] = [(info, b"x")]
        for label, members in cases.items():
            with self.subTest(label):
                out = self.run_launcher("connect", "--yes", env=self.offline_install_env(self.archive(members)), expected=1)
                self.assertIn("does not contain exactly the expected RankMiso files", out)
                self.assert_nothing_installed()

    def test_symlinked_binary_member_is_rejected(self):
        self.require_build()
        path = self.root / "companion.tar.gz"
        with tarfile.open(path, "w:gz") as tar:
            for name in ["LICENSE", "README-INSTALL.md", "rankmiso-mcp", "rankmiso-mcp-native-host"]:
                tar.add(BUILD / name if name.startswith("rankmiso") else LAUNCHER, arcname=f"./{name}")
            info = tarfile.TarInfo("./rankmiso-setup")
            info.type = tarfile.SYMTYPE
            info.linkname = "/bin/sh"
            tar.addfile(info)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        out = self.run_launcher("connect", "--yes", env={"RANKMISO_TEST_ARCHIVE": str(path), "RANKMISO_TEST_SHA256": digest}, expected=1)
        self.assertIn("does not contain exactly the expected RankMiso files", out)
        self.assert_nothing_installed()

    # Install, reuse, repair, upgrade safety, uninstall

    def test_fresh_install_is_ready_repeatable_and_reused(self):
        self.require_build()
        out = self.run_launcher("connect", "--yes", env=self.offline_install_env())
        self.assertIn("Status: READY", out)
        self.assertIn("MCP Server: Ready (5 read-only tools)", out)
        self.assertIn("Chrome: Registered", out)
        self.assertIn("Firefox: Registered", out)
        self.assertIn("Shared Audit: None yet", out)
        self.assertNotIn("configure codex", out)
        self.assertEqual(self.data.stat().st_mode & 0o777, 0o700)
        chrome = json.loads(self.chrome.read_text())
        self.assertEqual(chrome["allowed_origins"], [CHROME_ORIGIN])
        self.assertEqual(chrome["path"], str((self.data / "bin/rankmiso-mcp-native-host").resolve()))

        before = {name: (self.data / "bin" / name).stat().st_mtime_ns for name in BINARIES}
        # No archive and no network: a second connect must not need either.
        self.shim_command("curl", "exit 99\n")
        out = self.run_launcher("connect", "--yes")
        self.assertIn("was reused; nothing was changed", out)
        self.assertEqual(before, {name: (self.data / "bin" / name).stat().st_mtime_ns for name in BINARIES})
        self.run_launcher("status")

    def test_missing_registration_is_repaired_without_download_and_audits_kept(self):
        self.require_build()
        self.run_launcher("connect", "--yes", env=self.offline_install_env())
        kept = self.audits / "rankmiso-shared-keep.json"
        kept.write_text("keep")
        self.firefox.unlink()
        self.assertIn("Firefox: Not registered", self.run_launcher("status", expected=1))
        self.assertIn("Repair the existing companion", self.run_launcher("connect"))
        self.shim_command("curl", "exit 99\n")
        self.assertIn("Status: READY", self.run_launcher("connect", "--yes"))
        self.assertEqual(kept.read_text(), "keep")

    def test_wrong_extension_identity_is_reported_invalid(self):
        self.require_build()
        self.run_launcher("connect", "--yes", env=self.offline_install_env())
        manifest = json.loads(self.chrome.read_text())
        manifest["allowed_origins"] = ["chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/"]
        self.chrome.write_text(json.dumps(manifest, indent=2))
        self.assertIn("Chrome: Invalid", self.run_launcher("status", expected=1))
        self.run_launcher("connect", "--yes")
        self.assertEqual(json.loads(self.chrome.read_text())["allowed_origins"], [CHROME_ORIGIN])

    def test_foreign_registration_is_left_unchanged(self):
        self.require_build()
        self.chrome.parent.mkdir(parents=True)
        foreign = json.dumps({"name": HOST_NAME, "description": "other", "path": "/opt/other/host", "type": "stdio", "allowed_origins": [CHROME_ORIGIN]})
        self.chrome.write_text(foreign)
        out = self.run_launcher("connect", "--yes", env=self.offline_install_env(), expected=1)
        self.assertIn("left unchanged", out)
        self.assertEqual(self.chrome.read_text(), foreign)

    def test_incompatible_companion_is_not_overwritten(self):
        self.require_build()
        self.run_launcher("connect", "--yes", env=self.offline_install_env())
        mcp = self.data / "bin/rankmiso-mcp"
        mcp.write_text("#!/bin/sh\necho 'rankmiso-mcp 9.0.0'\n")
        out = self.run_launcher("connect", "--yes", env=self.offline_install_env(), expected=1)
        self.assertIn("does not support", out)
        self.assertIn("9.0.0", mcp.read_text())
        self.assertIn("not compatible", self.run_launcher("mcp", expected=1))
        self.assertIn("MCP Companion: Incompatible", self.run_launcher("status", expected=1))

    def stub_version(self, binary, version):
        (self.data / "bin" / binary).write_text(f"#!/bin/sh\necho '{binary} {version}'\n")

    def test_v050_host_is_reported_as_blocking_browser_sharing(self):
        self.require_build()
        self.run_launcher("connect", "--yes", env=self.offline_install_env())
        self.stub_version("rankmiso-mcp-native-host", "0.1.0")
        self.assertIn("Browser sharing: Blocked", self.run_launcher("status", expected=1))
        out = self.run_launcher("connect", "--yes", expected=1)
        self.assertIn("needs a newer companion", out)
        self.assertIn("0.1.0", (self.data / "bin/rankmiso-mcp-native-host").read_text())

    def test_outdated_companion_upgrades_only_after_verification(self):
        self.require_build()
        self.run_launcher("connect", "--yes", env=self.offline_install_env())
        kept = self.audits / "rankmiso-shared-keep.json"
        kept.write_text("keep")
        for binary in ["rankmiso-mcp", "rankmiso-mcp-native-host"]:
            self.stub_version(binary, "0.1.0")
        path, _ = self.archive()
        newer = {"RANKMISO_TEST_ARCHIVE": str(path), "RANKMISO_TEST_PINNED_PATCH": "1"}
        self.assertIn("Replace the installed rankmiso-mcp 0.1.0", self.run_launcher("connect", env=newer))
        # A failed download or checksum leaves the working install alone.
        self.run_launcher("connect", "--yes", env={**newer, "RANKMISO_TEST_SHA256": "0" * 64}, expected=1)
        self.assertIn("0.1.0", (self.data / "bin/rankmiso-mcp").read_text())
        out = self.run_launcher("connect", "--yes", env={**newer, "RANKMISO_TEST_SHA256": hashlib.sha256(path.read_bytes()).hexdigest()})
        self.assertIn("Status: READY", out)
        self.assertIn("rankmiso-mcp 0.1.1", out)
        self.assertEqual(kept.read_text(), "keep")

    def test_failed_upgrade_restores_the_previous_binaries(self):
        self.require_build()
        self.run_launcher("connect", "--yes", env=self.offline_install_env())
        for binary in ["rankmiso-mcp", "rankmiso-mcp-native-host"]:
            self.stub_version(binary, "0.1.0")
        old = {name: (self.data / "bin" / name).read_bytes() for name in BINARIES}
        # A foreign Firefox registration makes the new installer fail after
        # it has already replaced the binaries.
        self.firefox.write_text(json.dumps({"name": HOST_NAME, "description": "other", "path": "/opt/other", "type": "stdio", "allowed_extensions": ["x@y"]}))
        path, digest = self.archive()
        out = self.run_launcher("connect", "--yes", env={"RANKMISO_TEST_ARCHIVE": str(path), "RANKMISO_TEST_SHA256": digest, "RANKMISO_TEST_PINNED_PATCH": "1"}, expected=1)
        self.assertIn("previous companion binaries were restored", out)
        self.assertEqual(old, {name: (self.data / "bin" / name).read_bytes() for name in BINARIES})
        self.assertEqual(sorted(p.name for p in (self.data / "bin").iterdir()), sorted(BINARIES))

    def test_permission_denied_fails_cleanly(self):
        self.require_build()
        share = self.home / ".local/share"
        share.mkdir(parents=True)
        share.chmod(0o500)
        out = self.run_launcher("connect", "--yes", env=self.offline_install_env(), expected=1)
        self.assertIn("Cannot create", out)
        self.assertFalse(self.chrome.exists())
        self.assertEqual(list(self.tmp.iterdir()), [])

    def test_uninstall_needs_approval_and_keeps_audits(self):
        self.require_build()
        self.run_launcher("connect", "--yes", env=self.offline_install_env())
        kept = self.audits / "rankmiso-shared-keep.json"
        kept.write_text("keep")
        self.assertIn("uninstall --yes", self.run_launcher("uninstall"))
        self.assertTrue((self.data / "bin/rankmiso-mcp").exists())
        self.run_launcher("uninstall", "--yes")
        self.assertFalse((self.data / "bin/rankmiso-mcp").exists())
        self.assertFalse(self.chrome.exists())
        self.assertEqual(kept.read_text(), "keep")

    # Shared audit retrieval through the plugin's MCP entry point

    def test_browser_share_is_readable_through_the_plugin_mcp_server(self):
        self.require_build()
        self.run_launcher("connect", "--yes", env=self.offline_install_env())
        host = json.loads(self.chrome.read_text())["path"]
        request = json.dumps({"protocolVersion": 1, "requestId": "s1", "type": "share_audit", "audit": json.loads(AUDIT.read_text())}).encode()
        # Chrome starts the registered host with the caller origin as argument.
        shared = subprocess.run([host, CHROME_ORIGIN], input=struct.pack("=I", len(request)) + request, capture_output=True, env=self.env, timeout=30)
        reply = json.loads(shared.stdout[4:])
        self.assertTrue(reply["ok"], reply)
        self.assertIn("Shared Audit: 1 available", self.run_launcher("status"))

        messages = [
            {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}}},
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "rankmiso_list_audits", "arguments": {}}},
        ]
        proc = subprocess.Popen(["sh", str(LAUNCHER), "mcp"], env=self.env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        responses = {}
        for message in messages:
            proc.stdin.write(json.dumps(message) + "\n")
            proc.stdin.flush()
            if "id" in message:
                response = json.loads(proc.stdout.readline())
                responses[response["id"]] = response
        listed = responses[2]["result"]["structuredContent"]
        audit_id = listed["items"][0]["id"]
        proc.stdin.write(json.dumps({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "rankmiso_get_issues", "arguments": {"audit_id": audit_id}}}) + "\n")
        proc.stdin.flush()
        issues = json.loads(proc.stdout.readline())["result"]
        proc.stdin.close()
        proc.wait(timeout=10)
        proc.stdout.close()
        self.assertEqual(responses[1]["result"]["serverInfo"]["name"], "rankmiso-mcp")
        self.assertEqual(listed["items"][0]["pageUrl"], "https://example.test/pricing")
        self.assertFalse(issues.get("isError"), issues)
        self.assertGreater(issues["structuredContent"]["total"], 0)


if __name__ == "__main__":
    unittest.main()
