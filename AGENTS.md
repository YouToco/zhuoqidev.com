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
  (`fonts-noto-cjk` on Linux) so Chinese labels are measured correctly. CI
  installs the same font files and fontconfig rules with
  `scripts/install-cjk-fonts.sh` (pinned upstream commit + sha256, no apt).
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
  `tools/diagrams/mindmap.js` lays those out itself, and a flowchart with a
  `%% layout: tree` line is drawn as an indented outline by
  `tools/diagrams/tree.js` (for decision trees, which Mermaid's columns make
  too wide). Draw diagrams as Mermaid, not as ASCII art in a code block.
- After changing a remark/rehype plugin or Markdown config, delete
  `node_modules/.astro/data-store.json`; the content layer otherwise reuses the
  previously rendered HTML.
- Never read `width`/`height` of an imported image directly in server code: it
  marks the 4K original as used and copies it into `dist/`. Read them from
  `img.clone` (see `imageUrl` in `src/lib/content.ts`).
- URLs are a contract. Chinese pages live at the root and English pages under
  `/en/`; old Hugo paths are kept as redirects (`src/lib/redirects.ts`, post
  `aliases`, taxonomy pages) and listed in `tests/fixtures/hugo-urls.txt`.
- The 3D scene on the Argus project page (`scene: argus` in its front matter,
  `src/components/ArgusStory.astro`) must not cost the first load anything: the
  poster render is the LCP image and the fallback, the step script starts after
  `load` and never reads layout while the page loads, and three.js plus the model
  load only after the reader's first scroll, tap or key press. The model is code
  (`src/scripts/argus-story-model.ts`); after changing it, render the poster, its
  camera and label spots again with `npm run poster` (`tools/models/README.md`).
  The step text lives in `src/data/argus-story.ts` and follows the recorded run in
  `tools/models/argus-story-run.json`. After changing any of it,
  compare mobile Lighthouse on that page with `main`.

## Guestbook and visit counts (Pages Functions + D1)

- The site stays static; the only server code is `functions/` (Cloudflare Pages Functions) with one
  D1 database (binding `DB`, schema in `migrations/`). Shared code lives in `server/`: `bots.ts` is
  dependency-free so both the Functions and Node scripts use it. Node runs the `.ts` files directly
  (`npm test` = `node --test`); `npm run check` also type-checks `functions/` + `server/` against
  `@cloudflare/workers-types` (`functions/tsconfig.json`).
- Two hosting lines, two ways of counting. Overseas visitors reach Cloudflare Pages, where
  `functions/_middleware.ts` counts crawler page requests by User-Agent (line `cf`). Mainland visitors
  reach Aliyun CDN, which never runs Functions, so `.github/workflows/stats-cn.yml` runs
  `scripts/stats-cn.ts` every morning to count crawlers in Aliyun's CDN logs (line `cn`). People are
  counted on both lines by the page beacon in `src/components/Analytics.astro` (POST `/api/hit`),
  by Cloudflare's IP location; no IP is stored and visitor hashes use a salt deleted the next day.
- The published pages call the API on `https://api.zhuoqidev.com` (`api` / `apiBase` in `src/site.ts`):
  a CNAME to `zhuoqidev.pages.dev` on every DNS line plus a custom domain on the Pages project, so
  readers on the mainland line reach it too. Local previews and `*.pages.dev` call their own origin.
  Page requests on `api.zhuoqidev.com` get a 301 to the site (`functions/_middleware.ts`).
- `public/_routes.json` keeps static assets out of Functions (assets are free and unmetered;
  Function calls count against the free 100,000 requests a day). The project is set to "fail open",
  so if the allowance runs out pages are still served and only the counts and guestbook stop.
- `/admin/` (served by `functions/admin/index.ts`, page in `server/admin.html`) shows the counts and
  the guestbook review queue; it and `/api/admin/*` need the `ADMIN_TOKEN` Pages secret. Guestbook
  notes are text only, stay `pending` until approved there, and are rendered with `textContent` on
  both the wall and the admin page. Keep it that way.
- Local run: `npm run build`, put `ADMIN_TOKEN=<32+ random characters>` in `.dev.vars` (git-ignored),
  then `npm run dev:functions` (global `wrangler`; applies migrations to a local D1 under `.wrangler/`)
  and open http://localhost:8788/. `node scripts/stats-cn.ts --day YYYY-MM-DD --dry-run` prints a
  mainland day's crawler counts without storing them.
- New migrations go in `migrations/` and are applied to the real database with
  `wrangler d1 migrations apply DB --remote` before the deploy that needs them.
- Anything that changes what is collected or shown must update both privacy pages.

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
