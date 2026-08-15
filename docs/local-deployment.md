# Local site deployment

GitHub Actions no longer builds or publishes the site. Releases run from the
Mac checkout and publish the same build to Alibaba Cloud OSS/CDN and Cloudflare
Pages, then verify the exact Git commit through a public deployment manifest on
both providers. The repository-scoped VPS workflow remains only for certificate
renewal.

## Prerequisites

- macOS with `curl`, `pkgutil`, Git, Python 3, the Alibaba Cloud CLI, and
  Cloudflare Wrangler.
- The `default` Alibaba Cloud CLI profile must be authenticated for OSS
  synchronization, CDN refresh, and STS identity checks. The OSS plugin bundled
  with Aliyun CLI 3.4.8 does not accept the newer global `--profile` flag.
- Wrangler must be authenticated through `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`, with access to the `zhuoqidev` Pages project.
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
operation, Cloudflare deployment, CDN purge request, or public verification.
OSS is mirrored with deletion enabled, so files removed from `public/` are also
removed from the bucket. Successful completion means the exact local commit is
served from both Alibaba Cloud CDN edge hostnames and
`https://zhuoqidev.pages.dev/deploy-manifest.json` within three minutes.
Alibaba verification connects directly to its CDN CNAMEs, so intelligent DNS
cannot accidentally validate the Cloudflare copy.
