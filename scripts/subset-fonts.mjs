// Gives every page its own tiny copy of the CJK display faces. Google's unicode-range slices
// made a typical page download 0.4–1.3 MB of Noto Serif SC / Long Cang (about 70 KB per slice,
// and a title touches many slices); here each page gets one file per face with exactly the
// characters it renders in that face, usually a few dozen KB.
//
// Runs after `astro build`, before og-images (the social cards use the same faces):
//   1. download the pinned source fonts (cached in node_modules/.cache/zq-fonts, sha256-checked);
//   2. open every page in Chrome and collect the characters drawn in "ZQ Serif" / "ZQ Hand";
//   3. subset with HarfBuzz and inline the @font-face rules into the page's <head>.
// Text that only exists at run time (search results) falls back to the system serif, except on
// the search pages, which also get a lazily loaded face covering every title in their language.
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, sep } from "node:path";
import { chromium } from "playwright";
import subsetFont from "subset-font";

const DIST = new URL("../dist/", import.meta.url).pathname;
const CACHE = new URL("../node_modules/.cache/zq-fonts/", import.meta.url).pathname;
const GOOGLE_FONTS = "https://raw.githubusercontent.com/google/fonts";

// Families as global.css names them. Weights map every requested weight onto an instance we ship
// (the variable serif is pinned per subset).
const FACES = {
  "ZQ Serif": {
    slug: "serif",
    source: {
      file: "NotoSerifSC-VF.ttf",
      url: `${GOOGLE_FONTS}/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf`,
      sha256: "050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9",
    },
    weight: (w) => (w >= 800 ? 900 : 700),
    variable: true,
  },
  "ZQ Hand": {
    slug: "hand",
    source: {
      file: "LongCang-Regular.ttf",
      url: `${GOOGLE_FONTS}/35e5529ffaf259a96693b048d9d97cdaa76b6837/ofl/longcang/LongCang-Regular.ttf`,
      sha256: "e5bf2c3f24ef2327c6f136d8f73e2f9dfdf44896fdbeb35a9515f44777bb91bc",
    },
    weight: () => 400,
    variable: false,
  },
  // comic dialogue (src/lib/markdown/comic-html.ts): LXGW WenKai Screen, GB glyph forms, OFL
  "ZQ Comic": {
    slug: "comic",
    source: {
      file: "LXGWWenKaiGBScreen.ttf",
      url: "https://github.com/lxgw/LxgwWenKai-Screen/releases/download/v1.522/LXGWWenKaiGBScreen.ttf",
      sha256: "23ec023913e1851925eb94462c4b0ccd1d78bb89533745aaa8cc682ccd339dc0",
    },
    weight: () => 400,
    variable: false,
  },
};

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const sources = new Map();
const source = (face) => {
  if (!sources.has(face)) sources.set(face, load(face));
  return sources.get(face);
};

async function load(face) {
  const path = join(CACHE, face.source.file);
  let buf = existsSync(path) ? await readFile(path) : null;
  if (!buf || sha256(buf) !== face.source.sha256) {
    const res = await fetch(face.source.url);
    if (!res.ok) throw new Error(`subset-fonts: ${face.source.url} answered ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    if (sha256(buf) !== face.source.sha256) throw new Error(`subset-fonts: checksum mismatch for ${face.source.file}`);
    await mkdir(CACHE, { recursive: true });
    await writeFile(path, buf);
  }
  return buf;
}

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith(".html")) out.push(path);
  }
  return out;
}

// Runs in the page: every character drawn in a display family, keyed by "family|weight".
function collect(families) {
  const out = {};
  const add = (style, text) => {
    const family = style.fontFamily
      .split(",")
      .map((f) => f.trim().replace(/^["']|["']$/g, ""))
      .find((f) => families.includes(f));
    if (!family || !text) return;
    const key = `${family}|${parseInt(style.fontWeight, 10) || 400}`;
    out[key] = (out[key] ?? "") + text + text.toUpperCase() + text.toLowerCase();
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement && node.nodeValue.trim()) add(getComputedStyle(node.parentElement), node.nodeValue);
  }
  for (const el of document.body.querySelectorAll("*")) {
    for (const pseudo of ["::before", "::after"]) {
      const style = getComputedStyle(el, pseudo);
      const content = style.content;
      if (!content || content === "none" || content === "normal") continue;
      const strings = [...content.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join("");
      add(style, strings + (content.includes("counter") ? "0123456789" : ""));
    }
  }
  return out;
}

function unicodeRange(chars) {
  const cps = [...new Set([...chars].map((c) => c.codePointAt(0)))].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < cps.length; i++) {
    let j = i;
    while (j + 1 < cps.length && cps[j + 1] === cps[j] + 1) j++;
    const hex = (n) => n.toString(16).toUpperCase();
    parts.push(i === j ? `U+${hex(cps[i])}` : `U+${hex(cps[i])}-${hex(cps[j])}`);
    i = j;
  }
  return parts.join(",");
}

const visible = (chars) => [...new Set([...chars].filter((c) => c.trim()))].sort().join("");

// Content-addressed subsets: identical character sets share one file.
const written = new Map();
let bytes = 0;
async function subset(family, weight, chars, outDir) {
  const face = FACES[family];
  const name = `${face.slug}-${weight}-${sha256(`${face.source.sha256}|${weight}|${chars}`).slice(0, 12)}.woff2`;
  const path = join(outDir, name);
  if (!written.has(path)) {
    written.set(
      path,
      (async () => {
        const cached = join(CACHE, "subsets", name);
        let font = existsSync(cached) ? await readFile(cached) : null;
        if (!font) {
          const opts = face.variable ? { variationAxes: { wght: weight } } : {};
          font = await subsetFont(await source(face), chars, { targetFormat: "woff2", ...opts });
          await mkdir(dirname(cached), { recursive: true });
          await writeFile(cached, font);
        }
        await mkdir(outDir, { recursive: true });
        await writeFile(path, font);
        bytes += font.length;
        return font.length;
      })(),
    );
  }
  const size = await written.get(path);
  return { url: `/${relative(DIST, path).split(sep).join("/")}`, size };
}

const faceRule = (family, weight, url, range) =>
  `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;` +
  `src:url(${url}) format("woff2")${range ? `;unicode-range:${range}` : ""}}`;

// ---------------------------------------------------------------------------------------------

const files = [];
for (const file of await htmlFiles(DIST)) {
  const html = await readFile(file, "utf8");
  // Redirect stubs (meta refresh) draw nothing and would navigate away mid-collection.
  if (/<html[\s>]/i.test(html) && !/http-equiv="refresh"/i.test(html)) files.push({ file, html, path: `/${relative(DIST, file).split(sep).join("/")}` });
}

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
  const file = join(DIST, path.endsWith("/") ? `${path}index.html` : path);
  try {
    if (!file.startsWith(DIST)) throw new Error("outside dist");
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.MERMAID_CHROME ?? "/usr/bin/google-chrome" });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Only markup and styles matter for computed fonts.
  await context.route("**/*", (route) =>
    ["image", "font", "media"].includes(route.request().resourceType()) || !route.request().url().startsWith(base)
      ? route.abort()
      : route.continue(),
  );
  const queue = [...files];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      const page = await context.newPage();
      for (let job = queue.shift(); job; job = queue.shift()) {
        const res = await page.goto(base + job.path, { waitUntil: "load" });
        if (!res?.ok()) throw new Error(`subset-fonts: ${job.path} answered ${res?.status()}`);
        job.chars = await page.evaluate(collect, Object.keys(FACES));
      }
      await page.close();
    }),
  );
} finally {
  await browser.close();
  server.close();
}

// Per language, everything any page draws in each family: the search pages lazily load the rest.
const byLang = { zh: {}, en: {} };
for (const job of files) {
  const lang = job.path.startsWith("/en/") || job.path.startsWith("/og-cards/en/") ? "en" : "zh";
  for (const [key, chars] of Object.entries(job.chars)) {
    const family = key.split("|")[0];
    byLang[lang][family] = (byLang[lang][family] ?? "") + chars;
  }
}

let largest = { size: 0, path: "" };
for (const job of files) {
  const outDir = job.path.startsWith("/og-cards/") ? join(DIST, "og-cards", "_fonts") : join(DIST, "_fonts");
  const faces = new Map();
  for (const [key, chars] of Object.entries(job.chars)) {
    const [family, requested] = key.split("|");
    const weight = FACES[family].weight(Number(requested));
    const id = `${family}|${weight}`;
    faces.set(id, (faces.get(id) ?? "") + chars);
  }
  const rules = [];
  let pageBytes = 0;
  for (const [id, chars] of faces) {
    const [family, weight] = id.split("|");
    // Keep the spaces: a missing space glyph would fall back to the system font mid-title.
    const { url, size } = await subset(family, Number(weight), `${visible(chars)} \u00a0`, outDir);
    rules.push(faceRule(family, weight, url));
    pageBytes += size;
  }
  if (/^\/(en\/)?search\/index\.html$/.test(job.path)) {
    const lang = job.path.startsWith("/en/") ? "en" : "zh";
    const own = new Set(faces.get("ZQ Serif|700") ?? "");
    const rest = visible([...visible(byLang[lang]["ZQ Serif"] ?? "")].filter((c) => !own.has(c)).join(""));
    if (rest) {
      const { url } = await subset("ZQ Serif", 700, rest, outDir);
      rules.push(faceRule("ZQ Serif", 700, url, unicodeRange(rest)));
    }
  }
  if (pageBytes > largest.size) largest = { size: pageBytes, path: job.path };
  if (!rules.length) continue;
  const html = job.html.replace("</head>", `<style data-zq-fonts>${rules.join("")}</style></head>`);
  if (html === job.html) throw new Error(`subset-fonts: no </head> in ${job.path}`);
  await writeFile(job.file, html);
}

const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(
  `subset-fonts: ${files.length} pages, ${written.size} font files (${kb(bytes)}); ` +
    `heaviest page ${largest.path} loads ${kb(largest.size)}`,
);
