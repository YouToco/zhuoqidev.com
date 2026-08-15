# Local site deployment

GitHub Actions no longer builds or publishes the site. Releases run from the
Mac checkout and publish directly to Alibaba Cloud OSS, then purge Alibaba
Cloud CDN and verify the exact Git commit through a public deployment manifest.
The repository-scoped VPS workflow remains only for certificate renewal.

## Prerequisites

- macOS with `curl`, `pkgutil`, Git, Python 3, and the Alibaba Cloud CLI.
- The `default` Alibaba Cloud CLI profile must be authenticated for OSS
  synchronization, CDN refresh, and STS identity checks. The OSS plugin bundled
  with Aliyun CLI 3.4.8 does not accept the newer global `--profile` flag.
- The local `main` branch must be clean and exactly match `origin/main`.

No credential is read from this repository. The script downloads Hugo Extended
0.161.1 into the ignored `.local-tools/` directory and verifies the official
package SHA-256 before execution.

## Build without publishing

```bash
scripts/deploy-local.sh --build-only
```

While developing on a feature branch, use the explicit local-only override:

```bash
scripts/deploy-local.sh --build-only --allow-dirty
```

## Publish

From a clean, synchronized `main` branch:

```bash
scripts/deploy-local.sh --deploy
```

The command stops on any failed syntax check, unit test, Hugo build, OSS object
operation, CDN purge request, or public verification. OSS is mirrored with
deletion enabled, so files removed from `public/` are also removed from the
bucket. Successful completion means `https://zhuoqidev.com/deploy-manifest.json`
served the exact local commit from both Alibaba Cloud CDN edge hostnames within
three minutes. Verification connects directly to the Alibaba Cloud CNAMEs, so
an unrelated DNS or Cloudflare route cannot produce a false success.
