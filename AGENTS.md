# zhuoqidev.com repository instructions

## Editorial audience policy

- Before creating or substantially revising an article, read
  `docs/editorial-audience.md` and follow its reader contract and publication
  checklist.
- The default reader profile is `agent-engineer-source-transition`: an
  engineer who understands basic LLM tool calling and can read Python or
  TypeScript, but is not assumed to know Rust, the target project's source
  tree, or project-specific type/function names.
- Explain the system concept before introducing source identifiers. Use the
  sequence: problem -> mental model -> glossary -> pseudocode/data flow ->
  real source -> concrete example -> limitations and evidence.
- A glossary does not make jargon-led prose accessible. Give unavoidable source
  terms precise plain-language names, use those plain names in the main
  narrative, and keep exact identifiers in source-verification sections. The
  explanation must survive deleting parenthetical source names.
- Source depth must not be removed to make an article accessible. Instead,
  provide the conceptual stairs needed to reach it. No internal identifier may
  carry an unexplained architectural claim.
- Derive the architecture from first-principle constraints before presenting
  repository details. State the smallest causal chain, identify which details
  are essential versus replaceable, and translate important techniques into
  reusable input/output/state contracts.
- For reusable algorithms or framework patterns, show how they transfer across
  application languages or providers. For model replacement, distinguish
  transport, wire protocol, capability metadata, and eval compatibility; do
  not describe a model as drop-in based only on a matching endpoint shape.
- Whenever an article contrasts request or protocol formats, identify which
  contract is public and documented versus product-internal, show complete
  minimal payloads side by side, compare the fields that moved or disappeared,
  and end with a decision table for readers building a new Agent. Never turn a
  model-catalog choice inside one client into general API guidance.
- Chinese and English editions must preserve the same claims, caveats, code,
  examples, version scope, and visual meaning.
- Technical images are evidence-bearing content. Validate their labels and
  implied behavior against the article; aesthetics never override accuracy.

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
- When upgrading an action, sweep every workflow for sibling references so the
  repository does not mix old and new runtimes.
- Node 24 actions require a sufficiently recent Actions runner. GitHub-hosted
  runners are managed by GitHub; for self-hosted runners, verify the minimum
  runner version in the action's release notes before upgrading.
- Run `python3 -m unittest discover -s tests -p "test_*.py" -v` after workflow
  changes. The tests enforce the currently verified immutable checkout SHA and
  the absence of CI/CD workflows. Site builds and releases run locally through
  `scripts/deploy-local.sh`; only certificate renewal remains in GitHub Actions.
