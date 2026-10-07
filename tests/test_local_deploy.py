import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "deploy-local.sh"
PACKAGE = ROOT / "package.json"
NVMRC = ROOT / ".nvmrc"
HEADERS = ROOT / "public" / "_headers"
WRANGLER = ROOT / "wrangler.jsonc"


class LocalDeployTests(unittest.TestCase):
    def script(self) -> str:
        return SCRIPT.read_text(encoding="utf-8")

    def test_node_version_is_pinned_and_enforced(self) -> None:
        version = NVMRC.read_text(encoding="utf-8").strip()

        self.assertRegex(version, r"^\d+\.\d+\.\d+$")
        self.assertIn("wanted_node=$(<.nvmrc)", self.script())

    def test_dependencies_are_exact_versions(self) -> None:
        package = json.loads(PACKAGE.read_text(encoding="utf-8"))

        for group in ("dependencies", "devDependencies"):
            for name, version in package[group].items():
                with self.subTest(package=name):
                    self.assertRegex(version, r"^\d+\.\d+\.\d+$")

    def test_build_chains_cards_and_search_index(self) -> None:
        package = json.loads(PACKAGE.read_text(encoding="utf-8"))

        self.assertEqual(
            "astro build && node scripts/og-images.mjs && pagefind --site dist",
            package["scripts"]["build"],
        )
        self.assertEqual("node scripts/verify-dist.mjs", package["scripts"]["verify"])

    def test_release_requires_clean_synced_main(self) -> None:
        script = self.script()

        self.assertIn("refusing to deploy from a branch other than main", script)
        self.assertIn("refusing to deploy when local main differs from origin/main", script)
        self.assertIn("refusing to build or deploy from a dirty working tree", script)

    def test_build_runs_every_gate_before_publishing(self) -> None:
        script = self.script()
        gates = [
            "npm ci",
            'python3 -m unittest discover -s tests -p "test_*.py" -v',
            "npm run check",
            "npm run build",
            "npm run verify",
            "aliyun oss sync dist/",
        ]
        positions = [script.index(gate) for gate in gates]

        self.assertEqual(sorted(positions), positions)

    def test_publish_mirrors_oss_and_refreshes_both_providers(self) -> None:
        script = self.script()
        sync_command = script[
            script.index("aliyun oss sync"):script.index("refresh_paths=")
        ]

        self.assertIn('aliyun oss sync dist/ "oss://${oss_bucket}/"', script)
        self.assertNotIn("--profile", sync_command)
        self.assertIn('--exclude "_headers"', script)
        self.assertIn("--delete", script)
        self.assertIn("--disable-ignore-error", script)
        self.assertIn("aliyun cdn RefreshObjectCaches", script)
        self.assertIn("--ObjectType Directory", script)
        self.assertIn("wrangler pages deployment list", script)
        self.assertIn("wrangler pages deploy dist/", script)
        self.assertIn('--commit-hash "$commit_sha"', script)
        self.assertIn("cloudflare_url=https://zhuoqidev.pages.dev", script)
        self.assertIn("dist/deploy-manifest.json", script)
        self.assertIn('--connect-to "$primary_domain:443:$primary_edge:443"', script)
        self.assertIn('--connect-to "$san_domain:443:$san_edge:443"', script)
        self.assertIn('cloudflare_sha == "$commit_sha"', script)

    def test_text_twins_declare_utf8_on_both_providers(self) -> None:
        script = self.script()
        headers = HEADERS.read_text(encoding="utf-8")

        self.assertIn('aliyun oss cp dist/ "oss://${oss_bucket}/"', script)
        self.assertIn('--meta "Content-Type:${rule#*|}"', script)
        self.assertIn('"*.md|text/markdown; charset=utf-8"', script)
        self.assertIn('"*.txt|text/plain; charset=utf-8"', script)
        self.assertIn("/*.md\n  Content-Type: text/markdown; charset=utf-8", headers)
        self.assertIn("/*.txt\n  Content-Type: text/plain; charset=utf-8", headers)

    def test_cloudflare_project_publishes_the_astro_output(self) -> None:
        self.assertIn('"pages_build_output_dir": "dist"', WRANGLER.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
