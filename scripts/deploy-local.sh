#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"

hugo_version=0.161.1
hugo_pkg=hugo_extended_${hugo_version}_darwin-universal.pkg
hugo_url="https://github.com/gohugoio/hugo/releases/download/v${hugo_version}/${hugo_pkg}"
hugo_sha256=ffa5333f0733b21a5c2501cf6fa8b6a99ef3f1953d047f5dc9b47f7cc35da768
blowfish_version=2.105.0
blowfish_sha=4afcd32b9950f16afbd686175b0f49a906d87626
tool_root="$repo_root/.local-tools"
hugo_bin="$tool_root/hugo-${hugo_version}/hugo"
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

if [[ $(uname -s) != Darwin ]]; then
  echo "local release currently supports macOS only" >&2
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

mkdir -p "$tool_root/hugo-${hugo_version}" "$tool_root/downloads"

if [[ ! -x $hugo_bin ]] || [[ $($hugo_bin version 2>/dev/null || true) != *"v${hugo_version}"* ]]; then
  pkg_path="$tool_root/downloads/$hugo_pkg"
  expanded_path="$tool_root/downloads/hugo-${hugo_version}-expanded"
  curl --fail --location --silent --show-error -o "$pkg_path.tmp" "$hugo_url"
  printf '%s  %s\n' "$hugo_sha256" "$pkg_path.tmp" | shasum -a 256 --check --status
  mv "$pkg_path.tmp" "$pkg_path"
  if [[ ! -f $expanded_path/Payload/hugo ]]; then
    pkgutil --expand-full "$pkg_path" "$expanded_path"
  fi
  install -m 0755 "$expanded_path/Payload/hugo" "$hugo_bin"
fi

git submodule update --init --recursive --depth 1
if [[ $(git -C themes/blowfish rev-parse HEAD) != "$blowfish_sha" ]]; then
  echo "Blowfish must be pinned to v${blowfish_version} ($blowfish_sha)" >&2
  exit 1
fi
bash -n \
  scripts/install-aliyun.sh \
  scripts/renew-cert.sh \
  scripts/deploy-local.sh
python3 -m unittest discover -s tests -p "test_*.py" -v

"$hugo_bin" --minify --cleanDestinationDir
test -s public/index.html
test -s public/llms.txt
test -s public/en/llms.txt
grep -q "https://zhuoqidev.com/posts/" public/llms.txt
grep -q "https://zhuoqidev.com/en/posts/" public/en/llms.txt

commit_sha=$(git rev-parse HEAD)
built_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
printf '{"commit":"%s","built_at":"%s"}\n' "$commit_sha" "$built_at" \
  > public/deploy-manifest.json

if [[ $mode == build ]]; then
  echo "local build passed for $commit_sha"
  exit 0
fi

command -v aliyun >/dev/null || {
  echo "aliyun CLI is required; install it with: brew install aliyun-cli" >&2
  exit 1
}
command -v wrangler >/dev/null || {
  echo "Wrangler is required; install it with: brew install cloudflare-wrangler" >&2
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

aliyun oss sync public/ "oss://${oss_bucket}/" \
  --endpoint "$oss_endpoint" \
  --region "$aliyun_region" \
  --delete \
  --update \
  --force \
  --disable-ignore-error \
  --output-dir "$tool_root/ossutil-output" \
  --checkpoint-dir "$tool_root/ossutil-checkpoint"

commit_message=$(git log -1 --pretty=%s)
wrangler pages deploy public/ \
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
  primary_sha=$(curl --fail --silent --show-error \
    --connect-to "$primary_domain:443:$primary_edge:443" \
    -H 'Cache-Control: no-cache' \
    "https://$primary_domain/deploy-manifest.json?verify=$commit_sha" \
    | python3 -c \
      'import json,sys; print(json.load(sys.stdin).get("commit", ""))' \
    2>/dev/null || true)
  san_sha=$(curl --fail --silent --show-error \
    --connect-to "$san_domain:443:$san_edge:443" \
    -H 'Cache-Control: no-cache' \
    "https://$san_domain/deploy-manifest.json?verify=$commit_sha" \
    | python3 -c \
      'import json,sys; print(json.load(sys.stdin).get("commit", ""))' \
    2>/dev/null || true)
  cloudflare_sha=$(curl --fail --silent --show-error \
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
