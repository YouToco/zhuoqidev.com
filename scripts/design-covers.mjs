// Cover images for the design library: public/design/demos/<slug>/cover.webp, 800×500.
// Dev-time only (needs Google Chrome): run after adding or changing a demo, and commit the result.
//   node scripts/design-covers.mjs                 every demo without a cover, and shrink big ones
//   node scripts/design-covers.mjs stamp-button    (re)shoot these demos
// A pose (below) puts a demo in its most telling state before the shot, e.g. a menu opened.
import { existsSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const ROOT = new URL("../public/", import.meta.url).pathname;
const DEMOS = join(ROOT, "design", "demos");
const W = 800;
const H = 500;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".json": "application/json",
};

// Small pieces (buttons) are shot in a small window at 2× so they fill the card; pages at 1280×800.
const CLOSE_UP = new Set([
  "stamp-button",
  "highlighter-button",
  "copy-button",
  "magnetic-button",
  "pixel-dissolve-select",
  "agent-sleep-toggle",
  "status-icon-morph",
]);

/** @type {Record<string, (page: import("playwright").Page) => Promise<void>>} */
const POSES = {
  "stamp-button": async (page) => {
    for (const sel of [".stamp", ".stamp.round"]) {
      await page.click(sel);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(200);
  },
  "highlighter-button": async (page) => {
    await page.hover(".mk");
    await page.waitForTimeout(600);
  },
  "copy-button": async (page) => {
    await page.click(".row .copy");
    await page.waitForTimeout(600);
  },
  "magnetic-button": async (page) => {
    const box = await page.locator(".mag").first().boundingBox();
    if (box) await page.mouse.move(box.x + box.width + 30, box.y - 20, { steps: 8 });
    await page.waitForTimeout(500);
  },
  // A different group picked, so the dot, the shifted text and the page are all on show.
  "sidebar-active-dot": async (page) => {
    await page.click("text=嵌套圆角");
    await page.waitForTimeout(900);
  },
  // Mid-morph: the ring half drawn, the dots on their way round.
  "status-icon-morph": async (page) => {
    await page.goto(page.url() + "?t=1330");
    await page.addStyleTag({ content: ".bar { display: none }" });
    await page.waitForTimeout(300);
  },
  // Asleep, z's in the air.
  "agent-sleep-toggle": async (page) => {
    await page.click("#switch");
    await page.waitForTimeout(1500);
  },
  // Mid-genie: the menu bent into a funnel on its way into the name.
  "pixel-dissolve-select": async (page) => {
    await page.click(".pick-btn");
    await page.waitForTimeout(900);
    await page.click(".pick-menu li:nth-child(2)");
    await page.waitForTimeout(110);
  },
  // Scroll-built pages: shoot them once the pieces have gathered.
  "collab-canvas": async (page) => {
    await page.evaluate(() => scrollTo(0, innerHeight * 1.1));
    await page.waitForTimeout(700);
  },
  "brand-mosaic": async (page) => {
    await page.evaluate(() => scrollTo(0, innerHeight * 1.45));
    await page.waitForTimeout(700);
  },
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const file = join(ROOT, path.endsWith("/") ? `${path}index.html` : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", () => r(undefined)));
const port = /** @type {import("node:net").AddressInfo} */ (server.address()).port;

const asked = process.argv.slice(2);
const slugs = readdirSync(DEMOS).filter((s) => existsSync(join(DEMOS, s, "index.html")));
const shoot = asked.length ? asked : slugs.filter((s) => !existsSync(join(DEMOS, s, "cover.webp")));

const browser = await chromium.launch({ executablePath: process.env.MERMAID_CHROME ?? "/usr/bin/google-chrome" });
for (const slug of shoot) {
  const small = CLOSE_UP.has(slug);
  const page = await browser.newPage({
    viewport: small ? { width: 680, height: 425 } : { width: 1280, height: 800 },
    colorScheme: "light",
    deviceScaleFactor: small ? 2 : 1,
  });
  await page.goto(`http://127.0.0.1:${port}/design/demos/${slug}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await POSES[slug]?.(page);
  const png = await page.screenshot();
  await sharp(png)
    .resize(W, H)
    .webp({ quality: 80 })
    .toFile(join(DEMOS, slug, "cover.webp"));
  console.log(`cover ${slug}`);
  await page.close();
}
await browser.close();
server.close();

// Covers shot elsewhere at 1280×800: shrink to the size the list shows.
for (const slug of slugs) {
  const file = join(DEMOS, slug, "cover.webp");
  if (!existsSync(file)) continue;
  const meta = await sharp(file).metadata();
  if ((meta.width ?? 0) <= W) continue;
  const buf = await sharp(file).resize(W, H).webp({ quality: 80 }).toBuffer();
  await sharp(buf).toFile(file);
  console.log(`shrunk ${slug} (${meta.width}px → ${W}px)`);
}
