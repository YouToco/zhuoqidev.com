import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
RENEW_WORKFLOW = ROOT / ".github" / "workflows" / "cert-renew.yml"
INSTALL_SCRIPT = ROOT / "scripts" / "install-aliyun.sh"
RENEW_SCRIPT = ROOT / "scripts" / "renew-cert.sh"

CHECKOUT_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1"
ALIYUN_SHA256 = (
    "3a9a45b9c7899228074135612d2b7ebbf32abb97826d825787cb454cd3011bdc"
)
ACME_COMMIT = "3661fd86b6304115e42f43910e6dd452ab9866d6"


class CertificateWorkflowTests(unittest.TestCase):
    def test_schedule_is_weekly_and_away_from_hour_boundary(self) -> None:
        workflow = RENEW_WORKFLOW.read_text(encoding="utf-8")

        self.assertIn('cron: "17 3 * * 1"', workflow)
        self.assertIn("workflow_dispatch:", workflow)
        self.assertNotIn("pull_request:", workflow)
        self.assertNotIn("push:\n", workflow)

    def test_workflow_is_least_privilege_and_serialized(self) -> None:
        workflow = RENEW_WORKFLOW.read_text(encoding="utf-8")

        self.assertRegex(workflow, r"permissions:\n  contents: read\n")
        self.assertIn("group: zhuoqidev-certificate-renewal", workflow)
        self.assertIn("cancel-in-progress: false", workflow)
        self.assertIn("runs-on: ubuntu-26.04", workflow)
        self.assertIn("environment: production-certificate", workflow)

    def test_workflow_pins_checkout_and_uses_only_secrets(self) -> None:
        workflow = RENEW_WORKFLOW.read_text(encoding="utf-8")

        self.assertIn(f"actions/checkout@{CHECKOUT_SHA}", workflow)
        self.assertIn("persist-credentials: false", workflow)
        self.assertIn("secrets.ALIYUN_ACCESS_KEY_ID", workflow)
        self.assertIn("secrets.ALIYUN_ACCESS_KEY_SECRET", workflow)
        self.assertIn("secrets.ACME_ACCOUNT_EMAIL", workflow)
        self.assertNotIn("actions/cache", workflow)

class CertificateScriptTests(unittest.TestCase):
    def test_installer_pins_version_and_archive_digest(self) -> None:
        script = INSTALL_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("version=3.5.1", script)
        self.assertIn(ALIYUN_SHA256, script)
        self.assertIn("sha256sum --check --status", script)
        self.assertIn('actual_version=$("$install_dir/aliyun" version)', script)

    def test_workflows_run_the_installed_cli_version(self) -> None:
        # The installer unpacks into aliyun-<version>; a stale path would fail only at deploy time.
        script = INSTALL_SCRIPT.read_text(encoding="utf-8")
        version = re.search(r"^version=(\S+)$", script, re.MULTILINE)[1]
        for name in ("cert-renew.yml", "deploy.yml"):
            text = (RENEW_WORKFLOW.parent / name).read_text(encoding="utf-8")
            with self.subTest(workflow=name):
                self.assertEqual({version}, set(re.findall(r"aliyun-(\d+\.\d+\.\d+)/aliyun", text)))

    def test_matrix_covers_every_domestic_cdn_domain(self) -> None:
        workflow = RENEW_WORKFLOW.read_text(encoding="utf-8")

        self.assertIn("fail-fast: false", workflow)
        self.assertIn("max-parallel: 1", workflow)
        self.assertIn("domains: zhuoqidev.com www.zhuoqidev.com", workflow)
        self.assertIn(
            "edges: zhuoqidev.com.queniuaa.com www.zhuoqidev.com.w.kunlunaq.com",
            workflow,
        )
        self.assertIn("domains: argus.zhuoqidev.com\n", workflow)
        self.assertIn("edges: argus.zhuoqidev.com.w.kunlunaq.com\n", workflow)
        self.assertIn("CERT_DOMAINS: ${{ matrix.domains }}", workflow)
        self.assertIn("CERT_EDGES: ${{ matrix.edges }}", workflow)

    def test_domains_and_edges_are_validated(self) -> None:
        script = RENEW_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("CERT_DOMAINS and CERT_EDGES must list the same number of names", script)
        self.assertIn(r"^([a-z0-9-]+\.)?zhuoqidev\.com$", script)
        self.assertIn('[[ ${edges[i]} == "${domains[i]}".* ]]', script)

    def test_renewal_is_gated_by_every_remote_expiry(self) -> None:
        script = RENEW_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("renew_threshold_days=${CERT_RENEW_THRESHOLD_DAYS:-30}", script)
        self.assertIn('days=$(remote_certificate_days "$domain")', script)
        self.assertIn("((days <= renew_threshold_days))", script)
        gate = script.index("certificate renewal is not needed")
        issuance = script.index("--issue")
        self.assertLess(gate, issuance)

    def test_issuance_and_publication_cover_every_domain(self) -> None:
        script = RENEW_SCRIPT.read_text(encoding="utf-8")

        self.assertIn(f"acme_commit={ACME_COMMIT}", script)
        self.assertIn("--dns dns_ali", script)
        self.assertIn('domain_args+=(--domain "$domain")', script)
        self.assertIn('"${domain_args[@]}"', script)
        self.assertIn('-checkhost "$domain"', script)
        self.assertIn('publish_domain "$domain"', script)
        self.assertEqual(script.count("SetCdnDomainSSLCertificate"), 1)

    def test_private_key_is_ephemeral_and_not_logged(self) -> None:
        workflow = RENEW_WORKFLOW.read_text(encoding="utf-8")
        script = RENEW_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("umask 077", script)
        self.assertIn('work_dir=$(mktemp -d "$RUNNER_TEMP/', script)
        self.assertIn('rm -rf -- "$work_dir"', script)
        self.assertNotIn("actions/cache", workflow)
        self.assertIsNone(re.search(r"echo .*ALIYUN_ACCESS_KEY", script))
        self.assertIsNone(re.search(r"echo .*private_key", script))

    def test_success_requires_exact_edge_and_cleanup_gates(self) -> None:
        script = RENEW_SCRIPT.read_text(encoding="utf-8")

        self.assertIn('edge_fingerprint == "$local_fingerprint"', script)
        self.assertIn('verify_edge "${domains[i]}" "${edges[i]}"', script)
        self.assertIn('verify_https "${domains[i]}" "${edges[i]}"', script)
        self.assertIn("--SearchMode COMBINATION", script)
        self.assertIn("assert_dns_challenge_removed _acme-challenge\n", script)
        self.assertIn(
            'assert_dns_challenge_removed "_acme-challenge.${domains[i]%.zhuoqidev.com}"',
            script,
        )


if __name__ == "__main__":
    unittest.main()
