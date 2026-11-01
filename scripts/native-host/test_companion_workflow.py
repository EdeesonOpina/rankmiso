#!/usr/bin/env python3
"""Guard the native companion workflow's production-only artifact policy."""

from pathlib import Path
import re
import unittest


WORKFLOW = Path(__file__).resolve().parents[2] / ".github/workflows/mcp-companion.yml"


class CompanionWorkflowPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = WORKFLOW.read_text(encoding="utf-8")

    def test_native_matrix_is_limited_to_master_prs_and_manual_runs(self):
        pull_request = re.search(
            r"(?ms)^  pull_request:\n(?P<body>.*?)(?=^  [a-z_]+:|^permissions:)",
            self.text,
        )
        self.assertIsNotNone(pull_request)
        self.assertIn("branches: [master]", pull_request.group("body"))
        self.assertNotIn("develop", pull_request.group("body"))
        self.assertIn("  workflow_dispatch:\n", self.text)
        self.assertNotRegex(self.text.split("permissions:", 1)[0], r"(?m)^  push:")

    def test_manual_artifact_upload_is_opt_in_and_expires_after_one_day(self):
        self.assertRegex(
            self.text,
            r"(?s)upload_artifacts:\n\s+description:.*?\n\s+required: true\n\s+default: false\n\s+type: boolean",
        )
        self.assertIn(
            "if: ${{ github.event_name == 'workflow_dispatch' && inputs.upload_artifacts }}",
            self.text,
        )
        self.assertEqual(self.text.count("uses: actions/upload-artifact@"), 1)
        self.assertIn("retention-days: 1", self.text)

    def test_workflow_permissions_remain_read_only(self):
        self.assertRegex(self.text, r"(?m)^permissions:\n  contents: read$")


if __name__ == "__main__":
    unittest.main()
