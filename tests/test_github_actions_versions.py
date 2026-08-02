import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"

CHECKOUT_SHA = "de0fac2e4500dabe0009e67214ff5f5447ce83dd"
CHECKOUT_TAG = "v6.0.2"
CACHE_SHA = "27d5ce7f107fe9357f9df03efb73ab90386fccae"
CACHE_TAG = "v5.0.5"


class GitHubActionsVersionTests(unittest.TestCase):
    def workflow_text(self) -> str:
        return "\n".join(
            path.read_text(encoding="utf-8")
            for path in sorted(WORKFLOWS.glob("*.y*ml"))
        )

    def test_checkout_uses_verified_stable_immutable_release(self) -> None:
        text = self.workflow_text()
        refs = re.findall(r"actions/checkout@([^\s#]+)(?:\s+#\s+([^\s]+))?", text)

        self.assertTrue(refs)
        self.assertEqual({(CHECKOUT_SHA, CHECKOUT_TAG)}, set(refs))

    def test_cache_actions_use_verified_stable_immutable_release(self) -> None:
        text = self.workflow_text()
        refs = re.findall(
            r"actions/cache/(?:save|restore)@([^\s#]+)(?:\s+#\s+([^\s]+))?",
            text,
        )

        self.assertTrue(refs)
        self.assertEqual({(CACHE_SHA, CACHE_TAG)}, set(refs))

    def test_deprecated_floating_major_refs_do_not_return(self) -> None:
        text = self.workflow_text()

        self.assertNotRegex(text, r"actions/checkout@v\d+(?:\s|$)")
        self.assertNotRegex(text, r"actions/cache(?:/(?:save|restore))?@v\d+(?:\s|$)")


if __name__ == "__main__":
    unittest.main()
