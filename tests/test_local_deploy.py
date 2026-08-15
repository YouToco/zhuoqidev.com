import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "deploy-local.sh"
THEME_PACKAGE = ROOT / "themes" / "blowfish" / "package.json"
THEME_CONFIG = ROOT / "themes" / "blowfish" / "config.toml"
CUSTOM_HEAD = ROOT / "layouts" / "partials" / "head.html"


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

    def test_blowfish_is_pinned_and_supports_the_hugo_version(self) -> None:
        script = self.script()
        package = THEME_PACKAGE.read_text(encoding="utf-8")
        config = THEME_CONFIG.read_text(encoding="utf-8")

        self.assertIn("blowfish_version=2.105.0", script)
        self.assertIn(
            "blowfish_sha=4afcd32b9950f16afbd686175b0f49a906d87626",
            script,
        )
        self.assertIn('"version": "2.105.0"', package)
        self.assertIn('min = "0.158.0"', config)
        self.assertIn('max = "0.164.0"', config)

    def test_custom_head_uses_the_current_blowfish_fuse_bundle(self) -> None:
        head = CUSTOM_HEAD.read_text(encoding="utf-8")

        self.assertIn('resources.Get "lib/fuse/fuse.min.cjs"', head)
        self.assertIn('resources.FromString "lib/fuse/fuse.min.js"', head)
        self.assertIn('replace $fuseRaw.Content "module.exports=" "window.Fuse="', head)
        self.assertIn('{{ partial "language-redirect.html" . }}', head)

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

    def test_publish_mirrors_oss_and_refreshes_both_providers(self) -> None:
        script = self.script()
        sync_command = script[
            script.index("aliyun oss sync"):script.index("refresh_paths=")
        ]

        self.assertIn('aliyun oss sync public/ "oss://${oss_bucket}/"', script)
        self.assertNotIn("--profile", sync_command)
        self.assertIn("--delete", script)
        self.assertIn("--disable-ignore-error", script)
        self.assertIn("aliyun cdn RefreshObjectCaches", script)
        self.assertIn("--ObjectType Directory", script)
        self.assertIn("wrangler pages deployment list", script)
        self.assertIn("wrangler pages deploy public/", script)
        self.assertIn('--commit-hash "$commit_sha"', script)
        self.assertIn("cloudflare_url=https://zhuoqidev.pages.dev", script)
        self.assertIn("deploy-manifest.json", script)
        self.assertIn('--connect-to "$primary_domain:443:$primary_edge:443"', script)
        self.assertIn('--connect-to "$san_domain:443:$san_edge:443"', script)
        self.assertIn('cloudflare_sha == "$commit_sha"', script)


if __name__ == "__main__":
    unittest.main()
