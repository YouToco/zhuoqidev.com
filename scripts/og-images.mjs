// Screenshots the build-time social cards (dist/og-cards/**) into og.png files, then deletes the
// card pages so they are never deployed. Runs after `astro build`, before Pagefind.
//
//   dist/og-cards/zh/<slug>/  →  dist/posts/<slug>/og.png
//   dist/og-cards/en/<slug>/  →  dist/en/posts/<slug>/og.png
//   dist/og-cards/site/       →  dist/og-default.png
//
// Chrome is the same one the Mermaid step uses (MERMAID_CHROME, default /usr/bin/google-chrome).
import { createServer } from "node:http";
import { existsSync, readdirSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const DIST = new URL("../dist/", import.meta.url).pathname;
const CARDS = join(DIST, "og-cards");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

if (!existsSync(CARDS)) {
  console.error("og-images: dist/og-cards/ is missing; run astro build first");
  process.exit(1);
}

const jobs = [];
for (const lang of ["zh", "en"]) {
  const dir = join(CARDS, lang);
  if (!existsSync(dir)) continue;
  for (const slug of readdirSync(dir)) {
    jobs.push({ page: `/og-cards/${lang}/${slug}/`, out: join(DIST, lang === "en" ? "en" : "", "posts", slug, "og.png") });
  }
}
jobs.push({ page: "/og-cards/site/", out: join(DIST, "og-default.png") });

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
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const job of jobs) {
    const res = await page.goto(base + job.page, { waitUntil: "networkidle" });
    if (!res?.ok()) throw new Error(`og-images: ${job.page} answered ${res?.status()}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: job.out, type: "png" });
  }
} finally {
  await browser.close();
  server.close();
}
await rm(CARDS, { recursive: true });
console.log(`og-images: wrote ${jobs.length} social cards`);
