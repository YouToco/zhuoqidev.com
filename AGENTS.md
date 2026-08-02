# zhuoqidev.com repository instructions

## GitHub Actions dependency policy

- Before adding or changing any `uses:` entry, query the action's official GitHub
  releases/tags and select the latest stable GA release. Do not guess a version
  from model memory and do not treat a beta, release candidate, or unreleased
  major as stable.
- Pin every action to its immutable full 40-character commit SHA and add the exact
  release tag as an inline comment. Do not use floating refs such as `@main`,
  `@v6`, or `@v5` in committed workflow files.
- Re-check the official release at edit time. The versions below are a verified
  baseline, not a permanent instruction to stay on them:
  - `actions/checkout` v6.0.2:
    `de0fac2e4500dabe0009e67214ff5f5447ce83dd`
  - `actions/cache`, including its `save` and `restore` actions, v5.0.5:
    `27d5ce7f107fe9357f9df03efb73ab90386fccae`
  - `cloudflare/wrangler-action` v4.0.0:
    `ebbaa1584979971c8614a24965b4405ff95890e0`; also pin its
    `wranglerVersion` input to the latest verified stable Wrangler CLI rather
    than accepting the action's moving `latest` default (4.118.0 on 2026-08-02).
- When upgrading an action, sweep every workflow for sibling references so the
  repository does not mix old and new runtimes.
- Node 24 actions require a sufficiently recent Actions runner. GitHub-hosted
  runners are managed by GitHub; for self-hosted runners, verify the minimum
  runner version in the action's release notes before upgrading.
- Run `python -m unittest discover -s tests -p "test_*.py" -v` after workflow
  changes. The tests enforce the currently verified immutable SHAs for GitHub's
  checkout and cache actions.
