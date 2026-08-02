import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
RENEW_WORKFLOW = ROOT / ".github" / "workflows" / "cert-renew.yml"
CI_WORKFLOW = ROOT / ".github" / "workflows" / "ci.yml"
INSTALL_SCRIPT = ROOT / "scripts" / "install-aliyun.sh"
RENEW_SCRIPT = ROOT / "scripts" / "renew-cert.sh"

CHECKOUT_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1"
ALIYUN_SHA256 = (
    "b9edbcc21236f14bfeebbd5e272dde6f36fd946af5802fa677475ff69839ed84"
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
        self.assertIn("runs-on: ubuntu-24.04", workflow)
        self.assertIn("environment: production-certificate", workflow)

    def test_workflow_pins_checkout_and_uses_only_secrets(self) -> None:
        workflow = RENEW_WORKFLOW.read_text(encoding="utf-8")

        self.assertIn(f"actions/checkout@{CHECKOUT_SHA}", workflow)
        self.assertIn("persist-credentials: false", workflow)
        self.assertIn("secrets.ALIYUN_ACCESS_KEY_ID", workflow)
        self.assertIn("secrets.ALIYUN_ACCESS_KEY_SECRET", workflow)
        self.assertIn("secrets.ACME_ACCOUNT_EMAIL", workflow)
        self.assertNotIn("actions/cache", workflow)

    def test_ci_validates_both_scripts_and_invariants(self) -> None:
        workflow = CI_WORKFLOW.read_text(encoding="utf-8")

        self.assertIn(f"actions/checkout@{CHECKOUT_SHA}", workflow)
        self.assertIn("bash -n scripts/install-aliyun.sh scripts/renew-cert.sh", workflow)
        self.assertIn("python3 -m unittest discover", workflow)


class CertificateScriptTests(unittest.TestCase):
    def test_installer_pins_version_and_archive_digest(self) -> None:
        script = INSTALL_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("version=3.4.10", script)
        self.assertIn(ALIYUN_SHA256, script)
        self.assertIn("sha256sum --check --status", script)
        self.assertIn('actual_version=$("$install_dir/aliyun" version)', script)

    def test_renewal_is_gated_by_both_remote_expiries(self) -> None:
        script = RENEW_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("renew_threshold_days=${CERT_RENEW_THRESHOLD_DAYS:-30}", script)
        self.assertIn('primary_days=$(remote_certificate_days "$primary_domain")', script)
        self.assertIn('san_days=$(remote_certificate_days "$san_domain")', script)
        self.assertIn(
            "primary_days > renew_threshold_days && san_days > renew_threshold_days",
            script,
        )
        gate = script.index("certificate renewal is not needed")
        issuance = script.index("--issue")
        self.assertLess(gate, issuance)

    def test_issuance_and_publication_cover_both_domains(self) -> None:
        script = RENEW_SCRIPT.read_text(encoding="utf-8")

        self.assertIn(f"acme_commit={ACME_COMMIT}", script)
        self.assertIn("--dns dns_ali", script)
        self.assertIn('--domain "$primary_domain"', script)
        self.assertIn('--domain "$san_domain"', script)
        self.assertIn('publish_domain "$primary_domain" root', script)
        self.assertIn('publish_domain "$san_domain" www', script)
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
        self.assertIn('verify_edge "$primary_domain" "$primary_edge"', script)
        self.assertIn('verify_edge "$san_domain" "$san_edge"', script)
        self.assertIn('verify_https "$primary_domain" "$primary_edge"', script)
        self.assertIn('verify_https "$san_domain" "$san_edge"', script)
        self.assertIn("--SearchMode COMBINATION", script)
        self.assertIn("assert_dns_challenge_removed _acme-challenge", script)
        self.assertIn("assert_dns_challenge_removed _acme-challenge.www", script)


if __name__ == "__main__":
    unittest.main()
