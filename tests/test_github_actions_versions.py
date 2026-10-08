import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"

CHECKOUT_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1"
CHECKOUT_TAG = "v7.0.1"
SETUP_NODE_SHA = "820762786026740c76f36085b0efc47a31fe5020"
SETUP_NODE_TAG = "v7.0.0"


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

    def test_setup_node_uses_verified_stable_immutable_release(self) -> None:
        text = self.workflow_text()
        refs = re.findall(r"actions/setup-node@([^\s#]+)(?:\s+#\s+([^\s]+))?", text)

        self.assertTrue(refs)
        self.assertEqual({(SETUP_NODE_SHA, SETUP_NODE_TAG)}, set(refs))

    def test_runners_are_pinned(self) -> None:
        # A floating image changes tools under us; the build also lays out CJK text in the
        # runner's Chrome.
        for path in sorted(WORKFLOWS.glob("*.y*ml")):
            text = path.read_text(encoding="utf-8")
            with self.subTest(workflow=path.name):
                self.assertRegex(text, r"runs-on: ubuntu-\d+\.\d+\n")
                self.assertNotIn("ubuntu-latest", text)

    def test_site_workflows_build_with_cjk_fonts_and_verify(self) -> None:
        for name in ("ci.yml", "deploy.yml"):
            text = (WORKFLOWS / name).read_text(encoding="utf-8")
            with self.subTest(workflow=name):
                self.assertIn("node-version-file: .nvmrc", text)
                self.assertIn("fonts-noto-cjk", text)
                self.assertIn("npm ci", text)
                self.assertIn("npm run check", text)
                self.assertIn("npm test", text)
                self.assertIn("npm run build", text)
                self.assertIn("npm run verify", text)
                self.assertNotIn("hugo", text.lower())

    def test_deploy_publishes_dist_from_main_only(self) -> None:
        text = (WORKFLOWS / "deploy.yml").read_text(encoding="utf-8")

        self.assertIn("if: github.ref == 'refs/heads/main'", text)
        self.assertIn("oss sync dist/ oss://zhuoqidev/", text)
        # More than ossutil's 3 uploads at a time; the type fix-up skips directory objects.
        self.assertIn("--jobs 32", text)
        self.assertIn("--disable-dir-object", text)
        self.assertIn("--connect-timeout 10 --max-time 20", text)
        self.assertIn("pages deploy dist/", text)
        self.assertNotIn("public/", text)
        self.assertNotIn("cache: npm", text)

    def test_deprecated_floating_major_refs_do_not_return(self) -> None:
        text = self.workflow_text()

        self.assertNotRegex(text, r"actions/checkout@v\d+(?:\s|$)")

    def test_expected_workflows_are_present(self) -> None:
        workflows = sorted(path.name for path in WORKFLOWS.glob("*.y*ml"))

        self.assertEqual(["cert-renew.yml", "ci.yml", "deploy.yml", "stats-cn.yml"], workflows)

    def test_mainland_stats_import_is_scheduled_and_safe(self) -> None:
        text = (WORKFLOWS / "stats-cn.yml").read_text(encoding="utf-8")

        self.assertIn("schedule:", text)
        self.assertIn("node-version-file: .nvmrc", text)
        self.assertIn("node scripts/stats-cn.ts --day", text)
        # Runs harmlessly until the token exists, and never splices user input into the script.
        self.assertIn("if [[ -z $STATS_ADMIN_TOKEN ]]", text)
        run_blocks = re.findall(r"run: \|\n((?:\s{10}.*\n?)+)", text)
        self.assertTrue(run_blocks)
        for block in run_blocks:
            self.assertNotIn("${{", block)

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
