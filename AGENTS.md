# zhuoqidev.com repository instructions

## Editorial audience policy

- Before creating or substantially revising an article, read
  `docs/editorial-audience.md` and follow its reader contract and publication
  checklist.
- Before writing, pick one primary reader from **Reader personas** below (and
  at most one secondary) and say which in the PR description. The primary is
  A or B; C is primary only for Tinkering posts and beginner editions, and D
  is never primary (see **Priority**). The default, when nothing else fits, is
  `agent-engineer-source-transition`: an
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

## Reader personas

Who actually reads the site, from the 2026-10-27 snapshot of the last 30 days
(Cloudflare Web Analytics + Aliyun CDN logs, the owner's own visits removed):
about 550 people, 69% on the mainland line (Beijing, Jiangsu / Shanghai /
Zhejiang, Guangdong), two thirds on a Windows desktop during working hours,
70% typing the address or following a shared link, the rest from Bing and
Google (Baidu almost none, WeChat almost none). Most read one article and
leave (about 1.1 pages each), so every article must work as someone's first
and only page on the site. ChatGPT and Perplexity also fetched pages about
1,800 times on people's behalf. Refresh these numbers when they are a few
months old; the personas change only when the readers do.

Each persona says who they are, what brings them here, what they need, and
what makes them give up. Write for the primary one; the secondary one must not
be lost, but need not be served first.

### Priority

The site exists to build the author's technical reputation and to back the CV
(Agent engineering), so personas are ranked by what their reading does for
that, not by how many of them come (owner's decision, 2026-10-31):

1. **A and B, equal: what articles are written for.** A is the reader of the
   roles the author applies for, and is usually the interviewer too. B is the
   reader the author's first-hand vendor, cost and reliability measurements
   serve, which few others can publish; it is also who decides and pays.
2. **D: a check on every article, never the target.** Writing for an
   interviewer turns into self-promotion; an article that convinces A or B
   convinces D. Every article still passes D's test (what was done, what was
   measured, where the evidence is, corrections kept visible).
3. **C: the way in, not the goal.** Keep writing Tinkering posts and beginner
   editions for search traffic, but each one links, in its body and at its
   end, to at least one A or B article it leads into. A C article with nowhere
   to go next is not finished.

Judge the site by what this ranking is for, not by visitor counts: readers
who go on from an article to /about/ or /projects/ or a second article,
returning readers, citations by AI assistants, stars on the open-source
projects, and messages to the contact address.

### A. Agent engineer (`agent-engineer-source-transition`, the default)

- **Who**: an application engineer (Python / TypeScript / Java / Go) who has
  built or configured an Agent and now wants to know how one works inside.
  Knows what a prompt, a context window and a tool call are; does not read
  Rust, does not know the project's source tree.
- **Arrives** from a search for a specific mechanism ("Codex tool_search",
  "Claude programmatic tool calling", "agent memory") or a link shared in a
  group. Reads at a desk, often at work.
- **Needs** the mental model before the identifiers, one input traced end to
  end, which details are essential and which replaceable, and a design they
  can reuse in their own stack. The full contract is
  `docs/editorial-audience.md`.
- **Gives up** when the first screen is a class name, a feature flag or a
  diagram whose labels are source identifiers.
- **Typical posts**: AI Agent 工程 / Agent Engineering; codex-first-request-tools,
  claude-programmatic-tool-calling-dynamic-filter, agent-plugins-inside.
- **Knows**: calling an LLM over an HTTP API, prompt, context window, token,
  tool / function call, JSON, async code, Git, reading Python or TypeScript;
  the major AI vendors and products by name (OpenAI, Anthropic, ChatGPT,
  Claude, Codex, Cursor) and MCP as a way to plug external tools into an
  Agent.
- **Does not know**: Rust syntax, the project's source tree and its type,
  function and flag names, wire formats of a specific product (Responses,
  Codex internals), retrieval algorithms such as BM25 by name.

### B. Tech lead choosing a tool (`tech-lead-choosing`)

- **Who**: the person who has to pick an inference engine, a workflow engine,
  a memory system, a cloud or a vendor, and defend the choice to a team or a
  boss. Technical, short on time, judged on the outcome.
- **Arrives** from a search such as "vLLM vs SGLang", "Temporal vs Celery",
  "Cloudflare vs Aliyun cost", often with a deadline.
- **Needs** the recommendation and the conditions under which it flips in the
  first screen, a decision table, real costs and limits with the date they
  were checked, and what was measured versus what was read in docs.
- **Gives up** when the answer is "it depends" without saying on what, when
  numbers have no date or source, or when the comparison is a feature list
  copied from vendor pages.
- **First-hand data**: measurements from the author's day job are this
  persona's main draw. Never name the employer or its products; ask the
  owner before writing anything drawn from that work.
- **Typical posts**: 深度调研 / Deep Dives; llm-inference-engine-selection,
  why-temporal-not-celery, memory-choice-framework,
  model-gateway-cloudflare-vs-china-cloud, verify-llm-relay-api.
- **Knows**: what the options in the comparison are for, servers and cloud
  bills, latency, throughput, availability, team cost, reading a benchmark
  table.
- **Does not know**: the internals of each option, the author's test setup,
  vendor-specific units (a "CU", a "credit") until converted to money or
  requests, which numbers were measured here and which come from docs.

### C. Someone with one practical question (`practical-searcher`)

- **Who**: not necessarily an engineer. Wants to get a ChatGPT plan cheaper,
  decide whether a Mac can run a model, or understand why a GPU is slower
  than advertised. The largest single group: the ChatGPT Business promo post
  gets more readers than any other page, almost all from search.
- **Arrives** from Google / Bing with the question as the query, sometimes
  from a deals forum or an AI assistant's citation; often on a phone.
- **Needs** the answer in the first paragraph in everyday words, then the
  steps, the risks and what to do if their case differs. Terms are explained
  where they first appear, not in a glossary at the end; charts instead of
  number tables.
- **Gives up** at the first unexplained acronym, a wall of commands, or an
  answer that only appears after the method.
- **Then**: once answered, offer the one A or B article that goes deeper on
  the same subject (see **Priority**); this is how the site keeps them.
- **Typical posts**: 折腾记录 / Tinkering and the beginner editions;
  chatgpt-business-promo-investigation, mac-for-local-llms,
  nvidia-tensor-half-speed-explained, agent-plugins-explained.
- **Knows**: using ChatGPT or a similar app, a browser, paying for a
  subscription, roughly what a GPU or a Mac is.
- **Does not know**: API, token, context window, model weights, VRAM,
  FP16 / FP8, CUDA, command lines, Git, any acronym not in everyday use.

### D. Hiring manager or interviewer (`hiring-reviewer`)

- **Who**: someone deciding whether to interview or hire the author, opening
  the site from a CV or a profile link. Skims for a few minutes.
- **Arrives** on the home page, /about/ or /projects/, then opens one or two
  articles.
- **Needs** to see within a minute what the author built or found, at what
  scale, with what evidence (measurements, merged PRs, production numbers),
  and how the author reasons about trade-offs and mistakes.
- **Gives up** on claims without evidence, framework name lists, or articles
  that read like reworded documentation.
- **Applies to** every article as a check, not as the reader it is written
  for (see **Priority**): the opening says what was done and what was
  learned, and corrections are kept visible rather than silently rewritten.
- **Knows**: general software engineering, the names of common AI products.
- **Does not know**: the author's employer's internals, the projects' history,
  why a number matters unless the article says so.

### Machine readers

AI assistants (ChatGPT, Perplexity, Claude) fetch `index.md` and quote parts of
it to someone who asked a question. Keep each article's first paragraph a
complete answer on its own, put dates and version scope next to the claims
they limit, and never leave a key number only inside an image.

### Before publishing: a closed-book review by persona

A model that knows the subject fills every gap with its own knowledge and then
reports that the article is clear. So the reviewer is never asked whether it
understood; it must produce evidence from the text that can be checked, and
its own knowledge never counts as evidence.

1. **Reviewer**: a fresh agent (never a fork of the writing session) given only
   the built `dist/<path>/index.md` and the primary persona's block above,
   including its Knows / Does not know lists. No drafting notes, sources or
   conversation. Tell it: "If you can explain a term but the article does not,
   that is a gap. Quote, do not paraphrase."
2. **Term audit**: list every technical term, acronym, product or source name
   in order of first appearance. For each: is it on the persona's Knows list?
   If not, quote the sentence at or before its first use that explains it in
   words the persona knows. No such sentence → gap. Terms only inside code,
   source-verification sections or `<details>` appendices are exempt when the
   surrounding prose still makes sense without them (the deletion test in
   `docs/editorial-audience.md`).
3. **Cite-only answer**: answer the persona's question (what brought them here)
   as a chain of steps, each step quoting the sentence it rests on. A step that
   needs a fact the article does not state → gap.
4. **Read in order**: first give only the text up to the first `##` heading and
   ask what the reader can conclude and act on; it must already contain the
   answer (C, B) or the outcome and scope (A). Then, section by section, list
   what each section assumes the reader already knows and compare it with the
   Knows list, without letting later sections explain earlier ones.
5. **Report** every gap with its quote and location. Fix them, rerun steps 2–4
   once, then run them once for the secondary persona. Put the persona, the
   number of gaps found and fixed, and any gap left on purpose (with the reason)
   in the PR description.

For persona C, also run step 3 with a smaller model (Haiku): it stalls where a
newcomer stalls. It still knows many terms, so it adds to steps 2–4 and does not
replace them.

**Calibrate the review before trusting it, and again after changing this
procedure.** Run it for persona A on the first version of the Codex tools
article (`git show 00f25b8:content/posts/codex-first-request-tools.md`), whose
first screen leads with `tool_mode`, `code_mode_only`, `additional_tools` and
Responses Lite, and on the current
`src/content/posts/codex-first-request-tools/zh.md`. The review must flag
those first-screen terms in the old version and find far fewer gaps per
thousand characters in the current one; if it does not, fix the procedure
before using it on new articles. Baseline from the first run (2026-10-31):
old version about 45 gaps in 13.6 KB with a first screen led by flags; current
version about 26 gaps in 51 KB, its first conclusion readable and its second
one carrying four unexplained terms.

## Site stack (Astro 7 + TypeScript)

- Articles live in `src/content/posts/<slug>/{zh,en}.md` with their images in the
  same folder; projects and the privacy page follow the same layout under
  `src/content/projects/` and `src/content/pages/`. Every article must exist in
  both languages: the build fails on a missing edition.
- Write portable Markdown, not framework components: GitHub alerts
  (`> [!NOTE]`), `![alt](./image.png "caption")` for figures, ```` ```mermaid ````
  fences (shown as hand-drawn Excalidraw sketches, see below) and ```` ```html demo height=320 ````
  fences for live CSS demos. The same source is served to agents as `index.md`.
- Numbers that compare things go in a chart, not in prose or a wall of table cells:
  a ```` ```chart ```` fence holds JSON for `bars` (with `panels` behind tabs),
  `stack`, `line`, `stats` (a row of number cards for the few headline numbers),
  `dumbbell` (before → after per row on one scale, with the change in words) or
  `meter` (how much of a limit is used); the types and fields are in
  `src/lib/markdown/chart.ts`. Pick by the shape of the claim: one or a few numbers →
  `stats`, before / after → `dumbbell`, share of a limit → `meter`. It is
  drawn at build time as plain HTML (an SVG only for lines) with no script, and
  `index.md` shows it as a Markdown table. Keep prose to one or two numbers per
  paragraph, name scales in plain words ("1 billion requests a month") rather than
  coined labels like T1/T2/T3, and fold commands and full reference tables into a
  `<details>` appendix. A JSON error fails the build.
- Code blocks over three lines start folded behind their bar (language, title, line count;
  the copy button works while folded). Mark a fence `open` (```` ```ts open ````) when the
  reader must see it without a click, or `fold` to fold a short one; `index.md` drops the
  mark. When the first line is a comment it becomes the bar's title, so begin a long block
  with a one-line comment that says what it shows.
- Walk-throughs: a ```` ```steps ```` fence holds JSON (`steps` of `{ title, text, chart? }`, `loop`,
  `caption`; `src/lib/markdown/steps.ts`) for a process read one stage at a time, and for a loop,
  which a ring diagram draws badly. 2 to 8 stages, each with an optional `chart` spec. Built from
  radio buttons like the chart tabs, so it needs no script; `index.md` gets a numbered list.
- Live demos (```` ```html demo ````) get the site colours as CSS variables (`--paper`, `--card`,
  `--ink`, `--ink-2`, `--ink-3`, `--line`, `--seal`, `--blue`, `--green`, `--gold`, `--gray`,
  copied from `global.css` into `remark-demo.ts`; keep the two in step) and follow the day / night
  switch: the page posts its theme into each frame (`src/scripts/site.ts`). Draw with those
  variables, not fixed colours, so a demo works in both themes.
  The fence's `height=` is the minimum: a frame whose content wraps taller (a phone, a narrow
  reading width) reports its height and grows to fit (`remark-demo.ts` → `site.ts`), so size the fence
  for the desktop layout and check the phone width still reads well.
- Comics: a ```` ```comic ```` fence holds a script (optional `# title` first, `---` between
  panels, one `> narration` per panel, `[Name] line` bubbles, `[Name!]` highlighted, `cols=N` panels
  per row at most). It is drawn at build time as HTML panels (`src/lib/markdown/comic.ts` parses,
  `comic-html.ts` draws), so the dialogue is real text. The cast is fixed and plain-spoken, never a
  metaphor readers must decode: `用户` / `User`, `你的服务` / `Your service`, `大模型` / `LLM`,
  `云厂商` / `Cloud` (carries flying money: it sends the bill) and `你` / `You`. Their pictures are
  Microsoft Fluent Emoji 3D (MIT, `public/comics/LICENSE.txt`), self-hosted as 128px webp; the
  dialogue face is LXGW WenKai Screen, subset per page as "ZQ Comic" like the other CJK faces.
- Opening scenes: an ```` ```opener ```` fence holds JSON (`word`, `headline`, optional `sub`,
  `device: "mac-mini"`, `readouts` with `tone: "bad"`, `note`; see `src/lib/markdown/opener.ts`). It is
  drawn at build time as plain HTML with a CSS-drawn device, and `src/scripts/site.ts` plays it once
  (big word → device rises → headline → readouts) when half of it is on screen; without the script or
  with reduced motion the reader sees the last frame. `index.md` gets the headline and the readouts as
  a quote. Use at most one per article, at the top, for the single claim the article proves.
- Glyphs: every article and project names one drawn object in its front matter (`glyph: mac-mini`,
  the same in both editions). The objects are plain shapes on a 100 x 100 grid in `src/data/glyphs.ts`;
  `src/lib/glyphs.ts` draws each one twice at build time with no script: a rough pen sketch
  (rough.js with fixed seeds, two frames that take turns while the card is hovered) under the
  date in the post and project lists, and the same shapes inked bold on a pastel tile taped to the
  top right of the article or project page. Pick an object the article is actually about, not a generic icon; mark shapes
  that sit on an inked area `onInk` so the tile can draw them in paper color. A new article
  without a glyph simply shows none.
- Readers pick the article width (narrow / default / wide / full) in the rail; it is
  stored as `zq-width` and applied by the head script in `Base.astro`. Charts, tables
  and diagrams must work from a 640 px column up to a full-width one.
- `pnpm run build` runs `astro build`, subsets the CJK display fonts per page
  (`scripts/subset-fonts.mjs`), screenshots the social cards
  (`scripts/og-images.mjs`) and builds the Pagefind search index.
  `pnpm run verify` then checks every legacy Hugo URL, internal link and anchor,
  hreflang pair, JSON-LD block, image size, font subset and Markdown twin.
  `pnpm run check` is the strict TypeScript gate and `pnpm run lint` the ESLint one
  (`eslint.config.js`: typescript-eslint strict type-checked plus the Astro rules; each
  exception there says why). `pnpm run format` applies Prettier to code and config
  (`.prettierignore` says what it leaves alone and why); CI fails on unformatted code.
  Run build, verify, check, lint and `pnpm run format:check` before pushing.
- Dependencies: pnpm, at the version in `package.json` `"packageManager"` (Corepack or
  `pnpm/action-setup` picks it up); install with `pnpm install --frozen-lockfile`, add
  with `pnpm add --save-exact`. `pnpm-workspace.yaml` sets the supply-chain policy: only
  versions public for a day, no release whose publishing evidence is weaker than its
  predecessors', and no dependency install scripts unless listed in `allowBuilds`. When
  an install stops on one of these, check the package before adding an exception, and
  write the reason next to it as the existing entries do. The strict `node_modules` only
  exposes declared packages: import nothing that is not in `package.json`.
- Fonts: Inter and JetBrains Mono (Latin) come from Astro's font API and
  are inlined by `src/components/Fonts.astro`. The display faces are not:
  `"ZQ Serif"` (Noto Serif SC, weights 700/900; `"ZQ Serif Text"` is its 400
  weight, used only by `/status/`), `"ZQ Hand"` (Long Cang) and
  `"ZQ Caveat"` (Caveat, weights 500/700) are cut per page to the characters
  that page draws in them and inlined as `<style data-zq-fonts>`. Text a page
  only sets at run time needs its characters drawn somewhere at build time:
  `/status/` keeps them in a hidden type case (`.np-case`). Caveat moved
  there because its full Latin file (73 KB) loaded on every page for a few words
  and held back first paint on mobile; it goes first in the hand stacks, so Latin
  letters draw in Caveat and CJK ones fall through to Long Cang. `"ZQ Comic"`
  (the TL;DR note and comic dialogue) is `font-display: optional` and preloaded:
  swapping it in late re-wrapped the Latin words in those CJK lines (mobile CLS
  0.06–0.08). Without the preload a per-page subset never makes the optional
  window and readers never see WenKai; with it they do on any decent connection,
  and a very slow first load keeps the system face without a shift. Google's unicode-range slices cost 0.4–1.3 MB per page
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
  ```` ```mermaid ```` fence, run `pnpm run diagrams` and commit what it writes.
  Each fence gets `diagrams/<id>.excalidraw` (the editable scene) and
  `public/diagrams/<id>.svg` (what the page shows), where the id is a hash of the
  fence text (`src/lib/markdown/diagram-id.ts`); the Markdown keeps the Mermaid
  text for `index.md`, and the page keeps it too, folded under each drawing
  (`details.diagram-src`, with a copy button), so an agent reading the HTML gets the
  structure, not just the labels in the alt text. `pnpm run verify` fails while any
  fence lacks a drawing.
  To touch up a drawing by hand, open its `.excalidraw` file on excalidraw.com,
  save it back over the file and run `pnpm run diagrams` again (it re-exports the
  SVG); `--force` redraws everything from Mermaid and discards such edits. The
  generator lives in `tools/diagrams/` with its own dependencies (installed on
  first run, never in CI); mermaid-to-excalidraw cannot draw mindmaps, so
  `tools/diagrams/mindmap.js` lays those out itself, and a flowchart with a
  `%% layout: tree` line is drawn as an indented outline by
  `tools/diagrams/tree.js` (for decision trees, which Mermaid's columns make
  too wide). Draw diagrams as Mermaid, not as ASCII art in a code block.
- After changing a remark/rehype plugin or Markdown config, delete
  `node_modules/.astro/data-store.json`; the content layer otherwise reuses the
  previously rendered HTML.
- Never read `src` of an imported image in server code unless the 4K original
  should ship: reading it marks the original as used and copies it into
  `dist/`. Since Astro 7.4 `width`/`height` are plain fields that mark nothing
  (and `img.clone` is gone); pass the image itself to `getImage` (see
  `imageUrl` in `src/lib/content.ts`).
- URLs are a contract. Chinese pages live at the root and English pages under
  `/en/`; old Hugo paths are kept as redirects (`src/lib/redirects.ts`, post
  `aliases`, taxonomy pages) and listed in `tests/fixtures/hugo-urls.txt`.
- The 3D scene on the Argus project page (`scene: argus` in its front matter,
  `src/components/ArgusStory.astro`) must not cost the first load anything: the
  poster render is the LCP image and the fallback, the step script starts after
  `load` and never reads layout while the page loads, and three.js plus the model
  load only after the reader's first scroll, tap or key press. The model is code
  (`src/scripts/argus-story-model.ts`); after changing it, render the poster, its
  camera and label spots again with `pnpm run poster` (`tools/models/README.md`).
  The step text lives in `src/data/argus-story.ts` and follows the recorded run in
  `tools/models/argus-story-run.json`. After changing any of it,
  compare mobile Lighthouse on that page with `main`.

## Design library (/design/)

- A gallery of UI pieces worth keeping: buttons, navigation, cards, whole pages, visual styles,
  motion, charts and 3D. Each entry is one self-contained demo page that readers try in a frame,
  copy in one click, or hand to their coding agent.
- An entry is `src/content/design/<slug>/{zh,en}.md` (schema in `src/content.config.ts`: `category`
  is one of button / navigation / card / layout / style / motion / visual; `origin: recreated` plus
  `inspiredBy` credits an effect rebuilt from someone else's work) and its demo in
  `public/design/demos/<slug>/` (`files` lists what the source viewer shows, the first is the demo).
  Both editions must agree on the demo fields; `src/lib/design.ts` fails the build otherwise.
- Demos are served as they are: one HTML file that opens on a double-click, inline CSS and JS,
  third-party libraries only from a CDN with an exact version, sample data inside the page, light
  and dark through `prefers-color-scheme` (the entry page rewrites those media rules to follow the
  site's own theme switch), no horizontal scroll at 375 px, `prefers-reduced-motion` respected.
  Only our own code (MIT); other people's work is a link in `src/data/design-links.ts`.
- Write the notes as `## 看点 / 怎么用 / 坑` (en: What makes it work / How to use it / Pitfalls):
  they go, with the full source, into `/design/<slug>/index.md` for agents and into `prompt.md`,
  which is what "copy agent prompt" copies (a short "please recreate this" brief in front).
  `/design/index.md` and both `llms.txt` list every entry.
- After adding or changing a demo run `node scripts/design-covers.mjs [slug…]` (Chrome; small
  pieces are shot close up, `POSES` puts a demo in its telling state) and commit `cover.webp`.
- `subset-fonts.mjs` and `verify-dist.mjs` skip the site checks for `/design/demos/` (those pages
  have no site frame); `verify` still checks their links and that each entry has a demo, `index.md`
  and `prompt.md`.

## Guestbook and visit counts (Pages Functions + D1)

- The site stays static; the only server code is `functions/` (Cloudflare Pages Functions) with one
  D1 database (binding `DB`, schema in `migrations/`). Shared code lives in `server/`: `bots.ts` is
  dependency-free so both the Functions and Node scripts use it. Node runs the `.ts` files directly
  (`pnpm test` = `node --test`); `pnpm run check` also type-checks `functions/` + `server/` against
  `@cloudflare/workers-types` (`functions/tsconfig.json`).
- Two hosting lines, two ways of counting. Overseas visitors reach Cloudflare Pages, where
  `functions/_middleware.ts` counts crawler page requests by User-Agent (line `cf`). Mainland visitors
  reach Aliyun CDN, which never runs Functions, so `.github/workflows/stats-cn.yml` runs
  `scripts/stats-cn.ts` every morning to count crawlers in Aliyun's CDN logs (line `cn`). People are
  counted by `src/components/Analytics.astro`: pages from Cloudflare carry `Server-Timing: line;desc=cf`
  (added by the middleware) and send the beacon (POST `/api/hit` → `visit_daily`, placed by Cloudflare;
  no IP is stored and visitor hashes use a salt deleted the next day). Pages from Aliyun fetch
  `/hit.gif` instead, because a beacon from the mainland to Cloudflare was often lost; the same daily
  import counts those requests in the CDN logs, places the IPs with ip2region (`scripts/ip2region.ts`,
  data files pinned by commit and hash in the workflow) and replaces that day in `visit_daily_cn`.
  Everything that reads visits sums both tables (`ALL_VISITS` in `server/stats.ts`). Browsers without
  `serverTiming` always send the beacon.
- Articles are counted one by one too, for the "popular lately" lists (`migrations/0003_page_counts.sql`):
  `page_daily` holds views and visitors per day, line and article slug, `page_seen` today's visitor
  hashes per slug (deleted with `visitor_seen`). Only the slug is kept, never the path or the IP, and
  both languages count toward the same slug (`slugOf` in `server/pages.ts` accepts only
  `/posts/<slug>/` and `/en/posts/<slug>/`). The beacon posts `/api/hit?p=<path>` and `recordView` adds
  the article under the same daily cap (line `cf`); on the mainland line the page that fetched `/hit.gif`
  is the request's Referer in the CDN log, so `scripts/stats-cn.ts` (`aggregatePages`, same
  corroboration and cap as visits) sends `pages` with the daily import, which replaces that day's
  `cn` rows (imports without `pages` still work).
- `/hot.json` is the ranking: article slugs by visitors over the last 30 Beijing days, both lines
  summed, empty until the counts cover 7 days (`hotSlugs` in `server/pages.ts`), never a count. On
  Cloudflare it is `functions/hot.json.ts` (cached an hour; also answered on `api.zhuoqidev.com`).
  Aliyun runs no Functions, so `stats-cn.yml` copies it to OSS after each import and refreshes both CDN
  domains (a failure is only a warning), and `deploy.yml` / `scripts/deploy-local.sh` write
  `dist/hot.json` before the OSS sync (whose `--delete` would remove it) and drop it before the
  Cloudflare upload. Pages read it from their own origin (`src/components/HotScript.astro`) and keep
  their built cards when it is empty or fails. The featured articles are `src/data/featured.ts`.
- The only third-party tracker is Cloudflare Web Analytics (no cookies, no local storage), loaded by
  `Analytics.astro` after first paint together with the site's own count. Google Analytics and Baidu
  Tongji were removed on 2026-11-01; do not add another tracker without updating both privacy pages.
  Search-engine verification and push (Google Search Console by DNS TXT, Baidu 搜索资源平台, Bing
  webmaster, `robots.txt`, `sitemap.xml`) are separate from analytics and stay.
- The owner's own browser stays out of the site's counts: open any page with `?nocount=1` once (sets
  `zq-nocount` in localStorage; `?nocount=0` clears it) and `Analytics.astro` sends neither the beacon
  nor `/hit.gif`; Cloudflare Web Analytics still loads. This is for the owner only; readers are not told.
- The published pages call the API on `https://api.zhuoqidev.com` (`api` / `apiBase` in `src/site.ts`):
  a CNAME to `zhuoqidev.pages.dev` on every DNS line plus a custom domain on the Pages project, so
  readers on the mainland line reach it too. Local previews and `*.pages.dev` call their own origin.
  Page requests on `api.zhuoqidev.com` get a 301 to the site (`functions/_middleware.ts`).
- `public/_routes.json` keeps static assets out of Functions (assets are free and unmetered;
  Function calls count against the free 100,000 requests a day). The project is set to "fail open",
  so if the allowance runs out pages are still served and only the counts and guestbook stop.
- `/visitors/` is the public face of the counts: readers by country and, in China, by province
  (`server/regions.ts` turns Cloudflare's region names into the map's codes), on a 3D globe and a 3D
  map of China, plus crawlers by kind and by name. It reads `GET /api/stats?range=7|30|all`
  (`functions/api/stats.ts`, `server/public-stats.ts`), which Cloudflare caches for five minutes.
  City-level counts and anything per visitor stay on `/admin/`. The 3D scenes
  (`src/scripts/visitors-globe.ts`, `visitors-china.ts`) load after the reader's first input, like
  the Argus scene; their map data is built by `pnpm run geo` (tools/geo/README.md).
- `/admin/` (served by `functions/admin/index.ts`, page in `server/admin.html`) shows the counts and
  the guestbook review queue; it and `/api/admin/*` need the `ADMIN_TOKEN` Pages secret. Guestbook
  notes are text only, stay `pending` until approved there, and are rendered with `textContent` on
  both the wall and the admin page. Keep it that way.
- Local run: `pnpm run build`, put `ADMIN_TOKEN=<32+ random characters>` in `.dev.vars` (git-ignored),
  then `pnpm run dev:functions` (`wrangler` from devDependencies; applies migrations to a local D1 under `.wrangler/`)
  and open http://localhost:8788/. `node scripts/stats-cn.ts --day YYYY-MM-DD --dry-run` prints a
  mainland day's crawler counts (and, with `IP2REGION_DIR` set, its visits) without storing them.
- New migrations go in `migrations/` and are applied to the real database with
  `wrangler d1 migrations apply DB --remote` before the deploy that needs them. `0003_page_counts.sql`
  must be applied before the per-article counts deploy: until then article views are lost (the place
  count still lands) and every mainland import fails as a whole.
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
