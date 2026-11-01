import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("install.py")
FIREFOX_ID = "rankmiso@rankmiso.extension"


class RegistrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="rankmiso-native-register-")
        self.root = Path(self.temp.name)
        self.home = self.root / "home"
        self.home.mkdir()
        self.xdg = self.root / "config"
        self.audit = self.root / "audits"
        self.audit.mkdir()
        self.executable = self.root / "native-host"
        self.executable.write_text("synthetic executable", encoding="utf-8")
        self.executable.chmod(0o700)
        self.env = {**os.environ, "HOME": str(self.home), "XDG_CONFIG_HOME": str(self.xdg)}

    def tearDown(self):
        self.temp.cleanup()

    def run_helper(self, *args, expected=0):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            env=self.env,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, expected, result.stderr)
        return result

    def install_args(self, browser, extension_id):
        return (
            "install",
            "--browser", browser,
            "--extension-id", extension_id,
            "--executable", str(self.executable),
            "--audit-dir", str(self.audit),
        )

    def test_generates_exact_browser_allowlists_and_keeps_shared_config(self):
        chrome_id = "a" * 32
        self.run_helper(*self.install_args("chrome", chrome_id))
        chrome_manifest = self.xdg / "google-chrome/NativeMessagingHosts/com.misoecosystem.rankmiso.json"
        chrome_for_testing_manifest = self.xdg / "google-chrome-for-testing/NativeMessagingHosts/com.misoecosystem.rankmiso.json"
        chromium_manifest = self.xdg / "chromium/NativeMessagingHosts/com.misoecosystem.rankmiso.json"
        for browser, path in (
            ("chrome-for-testing", chrome_for_testing_manifest),
            ("chromium", chromium_manifest),
        ):
            self.run_helper(*self.install_args(browser, chrome_id))
            manifest = json.loads(path.read_text())
            self.assertEqual(manifest["name"], "com.misoecosystem.rankmiso")
            self.assertEqual(manifest["type"], "stdio")
            self.assertEqual(manifest["path"], str(self.executable.resolve()))
            self.assertEqual(manifest["allowed_origins"], [f"chrome-extension://{chrome_id}/"])
        self.run_helper(*self.install_args("firefox", FIREFOX_ID))
        firefox_manifest = self.home / ".mozilla/native-messaging-hosts/com.misoecosystem.rankmiso.json"
        self.assertEqual(json.loads(firefox_manifest.read_text())["allowed_extensions"], [FIREFOX_ID])
        config = self.xdg / "rankmiso-mcp/native-host.json"
        self.assertEqual(json.loads(config.read_text())["auditDir"], str(self.audit))
        self.assertEqual(config.stat().st_mode & 0o777, 0o600)

        self.run_helper("uninstall", "--browser", "chrome")
        self.assertFalse(chrome_manifest.exists())
        for browser, path in (
            ("chrome-for-testing", chrome_for_testing_manifest),
            ("chromium", chromium_manifest),
        ):
            self.run_helper("uninstall", "--browser", browser)
            self.assertFalse(path.exists())
        self.assertTrue(firefox_manifest.exists())
        self.assertTrue(config.exists())

    def test_refuses_wildcard_ids_existing_registration_and_different_audit_dir(self):
        self.run_helper(*self.install_args("chrome", "*"), expected=1)
        args = self.install_args("chrome", "a" * 32)
        self.run_helper(*args)
        self.run_helper(*args, expected=1)
        other = self.root / "other-audits"
        other.mkdir()
        self.run_helper(*(args[:-1] + (str(other),)), expected=1)

    def test_refuses_incorrect_firefox_extension_identity(self):
        self.run_helper(*self.install_args("firefox", "development@example.test"), expected=1)

    def test_chrome_config_home_overrides_xdg_config_home(self):
        chrome_config = self.root / "chrome-config"
        self.env["CHROME_CONFIG_HOME"] = str(chrome_config)
        self.run_helper(*self.install_args("chrome-for-testing", "a" * 32))
        manifest = chrome_config / "google-chrome-for-testing/NativeMessagingHosts/com.misoecosystem.rankmiso.json"
        self.assertTrue(manifest.is_file())

    def test_chromium_profile_registration_uses_profile_native_host_directory(self):
        profile = self.root / "isolated-profile"
        profile.mkdir()
        args = self.install_args("chrome", "a" * 32) + ("--user-data-dir", str(profile))
        self.run_helper(*args)
        manifest = profile / "NativeMessagingHosts/com.misoecosystem.rankmiso.json"
        self.assertTrue(manifest.is_file())
        self.run_helper("uninstall", "--browser", "chrome", "--user-data-dir", str(profile))
        self.assertFalse(manifest.exists())


if __name__ == "__main__":
    unittest.main()
