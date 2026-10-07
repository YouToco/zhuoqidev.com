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

## Site stack (Astro 7 + TypeScript)

- Articles live in `src/content/posts/<slug>/{zh,en}.md` with their images in the
  same folder; projects and the privacy page follow the same layout under
  `src/content/projects/` and `src/content/pages/`. Every article must exist in
  both languages: the build fails on a missing edition.
- Write portable Markdown, not framework components: GitHub alerts
  (`> [!NOTE]`), `![alt](./image.png "caption")` for figures, ```` ```mermaid ````
  fences (shown as hand-drawn Excalidraw sketches, see below) and ```` ```html demo height=320 ````
  fences for live CSS demos. The same source is served to agents as `index.md`.
- `npm run build` runs `astro build`, subsets the CJK display fonts per page
  (`scripts/subset-fonts.mjs`), screenshots the social cards
  (`scripts/og-images.mjs`) and builds the Pagefind search index.
  `npm run verify` then checks every legacy Hugo URL, internal link and anchor,
  hreflang pair, JSON-LD block, image size, font subset and Markdown twin.
  `npm run check` is the strict TypeScript gate. Run all three before pushing.
- Fonts: Inter, JetBrains Mono and Caveat (Latin) come from Astro's font API and
  are inlined by `src/components/Fonts.astro`. The CJK display faces are not:
  `"ZQ Serif"` (Noto Serif SC, weights 700/900) and `"ZQ Hand"` (Long Cang) are
  cut per page to the characters that page draws in them and inlined as
  `<style data-zq-fonts>`. Google's unicode-range slices cost 0.4–1.3 MB per page
  and took mobile Lighthouse down to the 50s. Use those family names through
  `--f-serif` / `--f-hand*` in CSS; text inserted at run time falls back to the
  system serif (the search pages also lazy-load every title's characters). Source
  fonts are pinned by commit and sha256 and cached in `node_modules/.cache/zq-fonts/`.
- Accessibility is part of the bar: Lighthouse accessibility is 100 on every page
  type. Small text needs 4.5:1 contrast in both themes, including text on the
  dark code / terminal surfaces.
- Mermaid diagrams and social cards render in Google Chrome
  (`/usr/bin/google-chrome`, override with `MERMAID_CHROME`) and need CJK fonts
  (`fonts-noto-cjk` on Linux) so Chinese labels are measured correctly.
- Diagrams are drawn ahead of time, not at build time: after adding or editing a
  ```` ```mermaid ```` fence, run `npm run diagrams` and commit what it writes.
  Each fence gets `diagrams/<id>.excalidraw` (the editable scene) and
  `public/diagrams/<id>.svg` (what the page shows), where the id is a hash of the
  fence text (`src/lib/markdown/diagram-id.ts`); the Markdown keeps the Mermaid
  text for `index.md`. `npm run verify` fails while any fence lacks a drawing.
  To touch up a drawing by hand, open its `.excalidraw` file on excalidraw.com,
  save it back over the file and run `npm run diagrams` again (it re-exports the
  SVG); `-- --force` redraws everything from Mermaid and discards such edits. The
  generator lives in `tools/diagrams/` with its own dependencies (installed on
  first run, never in CI); mermaid-to-excalidraw cannot draw mindmaps, so
  `tools/diagrams/mindmap.js` lays those out itself.
- After changing a remark/rehype plugin or Markdown config, delete
  `node_modules/.astro/data-store.json`; the content layer otherwise reuses the
  previously rendered HTML.
- Never read `width`/`height` of an imported image directly in server code: it
  marks the 4K original as used and copies it into `dist/`. Read them from
  `img.clone` (see `imageUrl` in `src/lib/content.ts`).
- URLs are a contract. Chinese pages live at the root and English pages under
  `/en/`; old Hugo paths are kept as redirects (`src/lib/redirects.ts`, post
  `aliases`, taxonomy pages) and listed in `tests/fixtures/hugo-urls.txt`.

## GitHub Actions dependency policy

- Before adding or changing any `uses:` entry, query the action's official GitHub
  releases/tags and select the latest stable GA release. Do not guess a version
  from model memory and do not treat a beta, release candidate, or unreleased
  major as stable.
- Pin every action to its immutable full 40-character commit SHA and add the exact
  release tag as an inline comment. Do not use floating refs such as `@main`,
  `@v6`, or `@v5` in committed workflow files.
- Re-check the official release at edit time; the workflow tests pin the
  currently verified SHAs (`tests/test_github_actions_versions.py`).
- When upgrading an action, sweep every workflow for sibling references so the
  repository does not mix old and new runtimes.
- Node 24 actions require a sufficiently recent Actions runner. GitHub-hosted
  runners are managed by GitHub; for self-hosted runners, verify the minimum
  runner version in the action's release notes before upgrading.
- Run `python3 -m unittest discover -s tests -p "test_*.py" -v` after workflow
  changes. Pushing or merging to `main` runs `.github/workflows/deploy.yml`, which
  builds once and publishes the same `dist/` to Alibaba Cloud OSS/CDN (mainland
  China) and Cloudflare Pages (everywhere else), then verifies the exact commit on
  both. Pull requests run `ci.yml` (build and checks only). The deploy job refuses
  to run from any branch other than `main`. `scripts/deploy-local.sh` is the
  manual fallback for the same release.
