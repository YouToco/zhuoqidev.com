#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"

tool_root="$repo_root/.local-tools"
aliyun_profile=default
oss_bucket=${OSS_BUCKET:-zhuoqidev}
oss_endpoint=${OSS_ENDPOINT:-oss-cn-shenzhen.aliyuncs.com}
aliyun_region=${ALIYUN_REGION:-cn-shenzhen}
site_url=https://zhuoqidev.com
primary_domain=zhuoqidev.com
primary_edge=zhuoqidev.com.queniuaa.com
san_domain=www.zhuoqidev.com
san_edge=www.zhuoqidev.com.w.kunlunaq.com
cloudflare_project=zhuoqidev
cloudflare_url=https://zhuoqidev.pages.dev

mode=
allow_dirty=false

usage() {
  echo "Usage: scripts/deploy-local.sh --build-only [--allow-dirty]" >&2
  echo "       scripts/deploy-local.sh --deploy" >&2
}

while (($#)); do
  case "$1" in
    --build-only)
      mode=build
      ;;
    --deploy)
      mode=deploy
      ;;
    --allow-dirty)
      allow_dirty=true
      ;;
    *)
      usage
      exit 2
      ;;
  esac
  shift
done

if [[ -z $mode ]]; then
  usage
  exit 2
fi

# Build-time diagrams and social cards render in Google Chrome (see astro.config.ts).
if [[ -z ${MERMAID_CHROME:-} && $(uname -s) == Darwin ]]; then
  export MERMAID_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi
chrome=${MERMAID_CHROME:-/usr/bin/google-chrome}
if [[ ! -x $chrome ]]; then
  echo "Google Chrome is required at $chrome (set MERMAID_CHROME to override)" >&2
  exit 1
fi

wanted_node=$(<.nvmrc)
if [[ $(node --version 2>/dev/null) != "v$wanted_node" ]]; then
  echo "Node.js v$wanted_node is required (see .nvmrc); found $(node --version 2>/dev/null || echo none)" >&2
  exit 1
fi

if [[ $allow_dirty != true ]] && [[ -n $(git status --porcelain --untracked-files=normal) ]]; then
  echo "refusing to build or deploy from a dirty working tree" >&2
  exit 1
fi

if [[ $mode == deploy ]]; then
  if [[ $(git branch --show-current) != main ]]; then
    echo "refusing to deploy from a branch other than main" >&2
    exit 1
  fi

  git fetch --quiet origin main
  if [[ $(git rev-parse HEAD) != $(git rev-parse origin/main) ]]; then
    echo "refusing to deploy when local main differs from origin/main" >&2
    exit 1
  fi
fi

mkdir -p "$tool_root"
npm ci
bash -n \
  scripts/install-aliyun.sh \
  scripts/renew-cert.sh \
  scripts/deploy-local.sh
python3 -m unittest discover -s tests -p "test_*.py" -v
npm run check
npm run build
npm run verify

commit_sha=$(git rev-parse HEAD)
built_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
printf '{"commit":"%s","built_at":"%s"}\n' "$commit_sha" "$built_at" \
  > dist/deploy-manifest.json

if [[ $mode == build ]]; then
  echo "local build passed for $commit_sha"
  exit 0
fi

command -v aliyun >/dev/null || {
  echo "aliyun CLI is required; scripts/install-aliyun.sh pins the version CI uses" >&2
  exit 1
}
command -v wrangler >/dev/null || {
  echo "Wrangler is required: npm install --global wrangler" >&2
  exit 1
}

aliyun sts GetCallerIdentity \
  --profile "$aliyun_profile" \
  --RegionId "$aliyun_region" >/dev/null
aliyun oss ls "oss://${oss_bucket}/" \
  --endpoint "$oss_endpoint" \
  --region "$aliyun_region" \
  --limited-num 1 \
  --short-format >/dev/null
wrangler pages deployment list \
  --project-name "$cloudflare_project" >/dev/null

aliyun oss sync dist/ "oss://${oss_bucket}/" \
  --endpoint "$oss_endpoint" \
  --region "$aliyun_region" \
  --exclude "_headers" \
  --delete \
  --update \
  --force \
  --jobs 32 \
  --disable-ignore-error \
  --output-dir "$tool_root/ossutil-output" \
  --checkpoint-dir "$tool_root/ossutil-checkpoint"

# OSS omits the charset (and has no type for .md), so upload those files again with an explicit
# type. cp needs only PutObject, the permission sync already uses; Cloudflare reads public/_headers.
# The sync made the directory objects already, so cp skips them (else every pass rewrites ~470).
for rule in "*.md|text/markdown; charset=utf-8" "*.txt|text/plain; charset=utf-8" \
  "*.webmanifest|application/manifest+json"; do
  aliyun oss cp dist/ "oss://${oss_bucket}/" \
    --include "${rule%%|*}" \
    --meta "Content-Type:${rule#*|}" \
    --endpoint "$oss_endpoint" \
    --region "$aliyun_region" \
    --recursive \
    --force \
    --disable-dir-object \
    --jobs 16 \
    --disable-ignore-error \
    --output-dir "$tool_root/ossutil-output"
done

commit_message=$(git log -1 --pretty=%s)
wrangler pages deploy dist/ \
  --project-name "$cloudflare_project" \
  --branch main \
  --commit-hash "$commit_sha" \
  --commit-message "$commit_message" \
  --commit-dirty=false

refresh_paths=$(printf '%s/\n%s/\n' "$site_url" "https://www.zhuoqidev.com")
refresh_result=$(aliyun cdn RefreshObjectCaches \
  --profile "$aliyun_profile" \
  --ObjectPath "$refresh_paths" \
  --ObjectType Directory \
  --Force true)
refresh_task_id=$(python3 -c \
  'import json,sys; print(json.load(sys.stdin).get("RefreshTaskId", ""))' \
  <<<"$refresh_result")

if [[ -z $refresh_task_id ]]; then
  echo "Alibaba Cloud did not return a CDN refresh task id" >&2
  exit 1
fi
echo "CDN refresh accepted as task $refresh_task_id"

for attempt in $(seq 1 36); do
  primary_sha=$(curl --fail --silent --show-error --connect-timeout 10 --max-time 20 \
    --connect-to "$primary_domain:443:$primary_edge:443" \
    -H 'Cache-Control: no-cache' \
    "https://$primary_domain/deploy-manifest.json?verify=$commit_sha" \
    | python3 -c \
      'import json,sys; print(json.load(sys.stdin).get("commit", ""))' \
    2>/dev/null || true)
  san_sha=$(curl --fail --silent --show-error --connect-timeout 10 --max-time 20 \
    --connect-to "$san_domain:443:$san_edge:443" \
    -H 'Cache-Control: no-cache' \
    "https://$san_domain/deploy-manifest.json?verify=$commit_sha" \
    | python3 -c \
      'import json,sys; print(json.load(sys.stdin).get("commit", ""))' \
    2>/dev/null || true)
  cloudflare_sha=$(curl --fail --silent --show-error --connect-timeout 10 --max-time 20 \
    -H 'Cache-Control: no-cache' \
    "$cloudflare_url/deploy-manifest.json?verify=$commit_sha" \
    | python3 -c \
      'import json,sys; print(json.load(sys.stdin).get("commit", ""))' \
    2>/dev/null || true)
  if [[ $primary_sha == "$commit_sha" && \
        $san_sha == "$commit_sha" && \
        $cloudflare_sha == "$commit_sha" ]]; then
    echo "published and verified $commit_sha on Alibaba Cloud CDN and Cloudflare Pages"
    exit 0
  fi
  if [[ $attempt -lt 36 ]]; then
    sleep 5
  fi
done

echo "Alibaba Cloud CDN and Cloudflare Pages did not all serve $commit_sha within 180 seconds" >&2
exit 1
