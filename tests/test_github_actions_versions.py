import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"

CHECKOUT_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1"
CHECKOUT_TAG = "v7.0.1"
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

    def test_deprecated_floating_major_refs_do_not_return(self) -> None:
        text = self.workflow_text()

        self.assertNotRegex(text, r"actions/checkout@v\d+(?:\s|$)")

    def test_expected_workflows_are_present(self) -> None:
        workflows = sorted(path.name for path in WORKFLOWS.glob("*.y*ml"))

        self.assertEqual(["cert-renew.yml", "ci.yml", "deploy.yml"], workflows)

    def test_every_action_is_immutable_and_release_labeled(self) -> None:
        text = self.workflow_text()
        refs = re.findall(
            r"^\s*uses:\s+([^@\s]+)@([^\s#]+)(?:\s+#\s+([^\s]+))?\s*$",
            text,
            flags=re.MULTILINE,
        )

        self.assertTrue(refs)
        for action, revision, release in refs:
            with self.subTest(action=action):
                self.assertRegex(revision, r"^[0-9a-f]{40}$")
                self.assertRegex(release, r"^v\d+(?:\.\d+){1,2}$")


if __name__ == "__main__":
    unittest.main()
