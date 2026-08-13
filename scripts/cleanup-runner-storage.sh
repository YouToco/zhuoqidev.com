#!/usr/bin/env bash
set -euo pipefail

runner_root=${RUNNER_ROOT:-/opt/actions-runner-zhuoqidev-cert}
if [[ $runner_root != "/opt/actions-runner-zhuoqidev-cert" ]]; then
  echo "refusing unexpected runner root: $runner_root" >&2
  exit 1
fi

diag_dir="$runner_root/_diag"
temp_dir="$runner_root/_work/_temp"

if [[ -d $diag_dir ]]; then
  find "$diag_dir" -xdev -type f -mtime +30 -delete
  find "$diag_dir" -xdev -mindepth 1 -type d -empty -delete
fi

if [[ -d $temp_dir ]]; then
  find "$temp_dir" -xdev -mindepth 1 -type f -mmin +2880 -delete
  find "$temp_dir" -xdev -mindepth 1 -type l -mmin +2880 -delete
  find "$temp_dir" -xdev -mindepth 1 -depth -type d -empty -delete
fi

du -sh "$runner_root"
