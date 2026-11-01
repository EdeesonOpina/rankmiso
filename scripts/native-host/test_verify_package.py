import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).with_name("verify-package.py")
SPEC = importlib.util.spec_from_file_location("verify_package", SCRIPT)
VERIFY_PACKAGE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(VERIFY_PACKAGE)


class WindowsPathComparisonTests(unittest.TestCase):
    def test_extended_and_regular_windows_paths_compare_case_insensitively(self):
        self.assertTrue(
            VERIFY_PACKAGE.same_path(
                r"\\?\C:\Users\RunnerAdmin\AppData\Local\rankmiso\host.exe",
                r"c:/users/runneradmin/appdata/local/rankmiso/host.exe",
                windows=True,
            )
        )

    def test_extended_unc_and_regular_unc_paths_compare(self):
        self.assertTrue(
            VERIFY_PACKAGE.same_path(
                r"\\?\UNC\runner\share\rankmiso\host.exe",
                r"\\runner\share\rankmiso\host.exe",
                windows=True,
            )
        )

    def test_different_windows_paths_do_not_compare_equal(self):
        self.assertFalse(
            VERIFY_PACKAGE.same_path(
                r"C:\Users\RunnerAdmin\rankmiso\host.exe",
                r"C:\Users\RunnerAdmin\other\host.exe",
                windows=True,
            )
        )


if __name__ == "__main__":
    unittest.main()
