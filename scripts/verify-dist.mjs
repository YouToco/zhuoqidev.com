// Post-build checks on dist/. Run after `astro build`: npm run verify
//
//  1. every URL the Hugo site published still answers (tests/fixtures/hugo-urls.txt)
//  2. every internal link, image and #anchor resolves
//  3. <html lang> matches the URL's language; hreflang alternates exist and point back
//  4. article text is in the static HTML (readable without JavaScript) and has a Markdown twin
//  5. JSON-LD parses; images carry alt, width and height; social cards exist
//  6. the search index was built and the card pages were removed
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const SITE = "https://zhuoqidev.com";
const errors = [];
const fail = (msg) => errors.push(msg);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith(".html"));
const urlOf = (file) => "/" + relative(DIST, file).replace(/index\.html$/, "").replace(/\\/g, "/");
const isRedirect = (html) => /<meta http-equiv="refresh"/.test(html);

/** Resolve a site path to a file in dist, or null. */
function resolvePath(path) {
  const clean = decodeURIComponent(path.split("#")[0].split("?")[0]);
  const p = join(DIST, clean);
  if (existsSync(p) && statSync(p).isFile()) return p;
  if (existsSync(join(p, "index.html"))) return join(p, "index.html");
  return null;
}

const pages = new Map(htmlFiles.map((f) => [urlOf(f), readFileSync(f, "utf8")]));
const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');

// 1. URL parity with the Hugo site
const legacy = readFileSync(new URL("../tests/fixtures/hugo-urls.txt", import.meta.url), "utf8").split("\n").filter(Boolean);
for (const u of legacy) if (!resolvePath(u)) fail(`missing legacy URL ${u}`);

let links = 0;
for (const [url, html] of pages) {
  const redirect = isRedirect(html);

  // 2. internal links, images and anchors (inline scripts hold templates, not links)
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  for (const m of markup.matchAll(/\s(href|src)="([^"]+)"/g)) {
    let target = decode(m[2]);
    if (/^(mailto:|tel:|data:|javascript:)/.test(target)) continue;
    if (target.startsWith(SITE)) target = target.slice(SITE.length) || "/";
    if (/^(https?:)?\/\//.test(target)) continue;
    const [pathPart, hash] = target.split("#");
    const abs = pathPart === "" ? url : new URL(pathPart, `${SITE}${url}`).pathname;
    links++;
    const file = resolvePath(abs);
    if (!file) {
      fail(`${url}: broken ${m[1]} → ${target}`);
      continue;
    }
    if (hash && file.endsWith(".html")) {
      const targetHtml = file === join(DIST, url, "index.html") ? html : readFileSync(file, "utf8");
      if (!ids(targetHtml).has(decodeURIComponent(hash))) fail(`${url}: missing anchor #${hash} in ${abs}`);
    }
  }
  if (redirect || url === "/404.html") continue;

  // 3. language and alternates
  const lang = /<html lang="([^"]+)"/.exec(html)?.[1];
  const want = url.startsWith("/en/") ? "en" : "zh-CN";
  if (lang !== want) fail(`${url}: <html lang="${lang}">, expected ${want}`);
  const alts = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)];
  const self = `${SITE}${encodeURI(url)}`;
  for (const [, hl, href] of alts) {
    const path = href.replace(SITE, "");
    const altFile = resolvePath(path);
    if (!altFile) fail(`${url}: hreflang ${hl} → ${href} does not exist`);
    else if (hl !== "x-default" && !readFileSync(altFile, "utf8").includes(`href="${self}"`)) {
      fail(`${url}: hreflang ${hl} → ${decodeURI(path)} does not link back`);
    }
  }
  if (!/<link rel="canonical" href="https:\/\/zhuoqidev\.com\//.test(html)) fail(`${url}: no canonical`);

  // 5. structured data and images
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch (e) {
      fail(`${url}: JSON-LD does not parse (${e.message})`);
    }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    if (!/\ssrc="/.test(tag)) continue; // placeholder filled by script (image viewer)
    if (!/\salt="/.test(tag)) fail(`${url}: <img> without alt: ${tag.slice(0, 80)}`);
    if (!/\swidth="/.test(tag) || !/\sheight="/.test(tag)) fail(`${url}: <img> without width/height: ${tag.slice(0, 80)}`);
  }
  // diagrams are hand-drawn ahead of time; rehype-mermaid only fills in blocks that were missed
  if (/<svg[^>]*\sid="mermaid/.test(html)) fail(`${url}: a Mermaid diagram has no hand-drawn version: run npm run diagrams`);
  if (/class="language-comic"/.test(html)) fail(`${url}: a comic fence was not drawn (src/lib/markdown/remark-comic.ts)`);
  const og = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
  if (!og) fail(`${url}: no og:image`);
  else if (og.startsWith(SITE) && !resolvePath(og.slice(SITE.length))) fail(`${url}: og:image ${og} does not exist`);
  // display-font subsets inlined by scripts/subset-fonts.mjs
  if (html.includes("/fonts.css")) fail(`${url}: still links /fonts.css`);
  const fontStyle = /<style data-zq-fonts>([\s\S]*?)<\/style>/.exec(html)?.[1];
  if (!/http-equiv="refresh"/.test(html) && !fontStyle) fail(`${url}: no <style data-zq-fonts>`);
  for (const m of (fontStyle ?? "").matchAll(/url\((\/[^)]+)\)/g)) {
    if (!existsSync(join(DIST, m[1]))) fail(`${url}: font subset ${m[1]} does not exist`);
  }
}

// 6. search index and leftovers
if (!existsSync(join(DIST, "pagefind", "pagefind.js"))) fail("dist/pagefind/ is missing: run pagefind --site dist");
if (existsSync(join(DIST, "og-cards"))) fail("dist/og-cards/ was not removed: run scripts/og-images.mjs");

// 4. article bodies are in the HTML and have Markdown twins
const text = (html) =>
  html
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "");
let posts = 0;
for (const [url, html] of pages) {
  if (!/^\/(en\/)?posts\/[^/]+\/$/.test(url) || isRedirect(html)) continue;
  posts++;
  const prose = /<div class="prose">([\s\S]*?)<footer class="post-end">/.exec(html)?.[1] ?? "";
  const md = resolvePath(`${url}index.md`);
  if (!md) {
    fail(`${url}: no index.md`);
    continue;
  }
  const mdBody = readFileSync(md, "utf8").split("\n---\n").slice(1).join("\n").replace(/```[\s\S]*?```/g, "").replace(/\s+/g, "");
  const ratio = text(prose).length / Math.max(1, mdBody.length);
  if (ratio < 0.6) fail(`${url}: static HTML has ${Math.round(ratio * 100)}% of the Markdown text`);
  if (!html.includes('type="text/markdown"')) fail(`${url}: no rel=alternate text/markdown`);
}
for (const lang of ["", "/en"]) {
  const llms = resolvePath(`${lang}/llms.txt`);
  const count = llms ? (readFileSync(llms, "utf8").match(/^- \[.*\/index\.md\):/gm) ?? []).length : 0;
  const expected = [...pages.keys()].filter((u) => new RegExp(`^${lang}/posts/[^/]+/$`).test(u) && !isRedirect(pages.get(u))).length;
  if (count !== expected) fail(`${lang || "/"} llms.txt lists ${count} posts, site has ${expected}`);
}

console.log(`checked ${pages.size} HTML files, ${links} internal links, ${legacy.length} legacy URLs, ${posts} articles`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n` + errors.slice(0, 80).map((e) => `  ✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log("✓ dist looks good");
