import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "deploy-local.sh"


class LocalDeployTests(unittest.TestCase):
    def script(self) -> str:
        return SCRIPT.read_text(encoding="utf-8")

    def test_hugo_binary_is_version_and_digest_pinned(self) -> None:
        script = self.script()

        self.assertIn("hugo_version=0.161.1", script)
        self.assertIn(
            "ffa5333f0733b21a5c2501cf6fa8b6a99ef3f1953d047f5dc9b47f7cc35da768",
            script,
        )
        self.assertIn("shasum -a 256 --check --status", script)

    def test_release_requires_clean_synced_main(self) -> None:
        script = self.script()

        self.assertIn("refusing to deploy from a branch other than main", script)
        self.assertIn("refusing to deploy when local main differs from origin/main", script)
        self.assertIn("refusing to build or deploy from a dirty working tree", script)

    def test_build_runs_checks_and_validates_indexes(self) -> None:
        script = self.script()

        self.assertIn("git submodule update --init --recursive --depth 1", script)
        self.assertIn('python3 -m unittest discover -s tests -p "test_*.py" -v', script)
        self.assertIn('"$hugo_bin" --minify --cleanDestinationDir', script)
        self.assertIn("public/llms.txt", script)
        self.assertIn("public/en/llms.txt", script)

    def test_publish_mirrors_oss_and_refreshes_cdn(self) -> None:
        script = self.script()

        self.assertIn('aliyun oss sync public/ "oss://${oss_bucket}/"', script)
        self.assertIn("--delete", script)
        self.assertIn("--disable-ignore-error", script)
        self.assertIn("aliyun cdn RefreshObjectCaches", script)
        self.assertIn("--ObjectType Directory", script)
        self.assertIn("deploy-manifest.json", script)
        self.assertIn('--connect-to "$primary_domain:443:$primary_edge:443"', script)
        self.assertIn('--connect-to "$san_domain:443:$san_edge:443"', script)
        self.assertIn('primary_sha == "$commit_sha" && $san_sha == "$commit_sha"', script)


if __name__ == "__main__":
    unittest.main()
