# Site deployment

Every push or merge to `main` runs `.github/workflows/deploy.yml`: it builds the
Astro site once and publishes the same `dist/` to Alibaba Cloud OSS behind
Alibaba Cloud CDN (readers in mainland China) and to Cloudflare Pages (everyone
else), then verifies the exact Git commit through a public deployment manifest
on both providers. Pull requests run `.github/workflows/ci.yml`, which builds and
checks without publishing. `scripts/deploy-local.sh` performs the same release
from a workstation when GitHub Actions is unavailable.

## What a release does

1. `npm ci`, shell syntax checks, repository tests, `npm run check` (TypeScript).
2. `npm run build`: `astro build`, social cards (`scripts/og-images.mjs`, which
   screenshots build-time card pages in Chrome), Pagefind search index.
3. `npm run verify`: legacy URLs, links, anchors, hreflang, JSON-LD, images,
   Markdown twins, search index.
4. `aliyun oss sync dist/ oss://zhuoqidev/ --delete`, then `aliyun oss cp --meta`
   re-uploads `*.md` and `*.txt` with a UTF-8 charset (OSS omits it, which turns
   Chinese text into mojibake in browsers). Cloudflare gets the same types from
   `public/_headers`.
5. `wrangler pages deploy dist/`, Alibaba Cloud CDN directory refresh, and
   polling until both Alibaba CDN hostnames and `zhuoqidev.pages.dev` serve the
   new `deploy-manifest.json`; the GitHub workflow also checks the text content
   types on both providers.

## Prerequisites for the local fallback

- Node.js at the version in `.nvmrc`, Git, Python 3, Google Chrome
  (`MERMAID_CHROME` overrides the path; macOS is detected automatically) and CJK
  fonts (`fonts-noto-cjk` on Linux).
- Alibaba Cloud CLI at the version `scripts/install-aliyun.sh` pins (3.5.1), with
  an authenticated `default` profile for OSS sync, `cp`, CDN refresh and STS
  identity checks. OSS commands run without `--profile`, so they use `default`.
- Wrangler authenticated through `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`, with access to the `zhuoqidev` Pages project.
- For `--deploy`, a clean local `main` that exactly matches `origin/main`.

No credential is read from this repository.

## Build without publishing

```bash
scripts/deploy-local.sh --build-only
```

While developing on a feature branch, use the explicit local-only override:

```bash
scripts/deploy-local.sh --build-only --allow-dirty
```

## Publish manually

From a clean, synchronized `main` branch:

```bash
scripts/deploy-local.sh --deploy
```

The command stops on any failed check, build step, OSS object operation,
Cloudflare deployment, CDN purge request, or public verification. OSS is
mirrored with deletion enabled, so files removed from `dist/` are also removed
from the bucket. Alibaba verification connects directly to its CDN CNAMEs, so
intelligent DNS cannot accidentally validate the Cloudflare copy.
