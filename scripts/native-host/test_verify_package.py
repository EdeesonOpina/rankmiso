import ctypes
import importlib.util
import os
from pathlib import Path
import tempfile
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

    @unittest.skipUnless(os.name == "nt", "Windows short-path aliases require Windows")
    def test_long_and_short_aliases_of_the_same_temp_directory_compare(self):
        long_path = Path(tempfile.gettempdir())
        get_short_path_name = ctypes.windll.kernel32.GetShortPathNameW
        get_short_path_name.argtypes = (
            ctypes.c_wchar_p,
            ctypes.POINTER(ctypes.c_wchar),
            ctypes.c_uint32,
        )
        get_short_path_name.restype = ctypes.c_uint32
        required = get_short_path_name(str(long_path), None, 0)
        self.assertGreater(required, 0)
        buffer = ctypes.create_unicode_buffer(required + 1)
        written = get_short_path_name(str(long_path), buffer, len(buffer))
        self.assertGreater(written, 0)
        self.assertTrue(VERIFY_PACKAGE.same_path(long_path, buffer.value, windows=True))


if __name__ == "__main__":
    unittest.main()
