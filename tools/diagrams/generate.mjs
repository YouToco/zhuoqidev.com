// Draws every ```mermaid block in src/content as an Excalidraw sketch.
//
//   npm run diagrams            draw the blocks that have no drawing yet; re-export edited scenes
//   npm run diagrams -- --force redraw every scene from its Mermaid text (discards hand edits)
//
// Per block it writes diagrams/<id>.excalidraw (the editable scene: open it on excalidraw.com,
// edit, save it back, run this again) and public/diagrams/<id>.svg (what the page shows). Posts
// keep the Mermaid text, which stays the source for readers of index.md and for agents; the build
// swaps in the SVG by id (src/lib/markdown/rehype-hand-diagrams.ts). Files no post uses are removed.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { diagramId } from "../../src/lib/markdown/diagram-id.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const HERE = new URL("./", import.meta.url).pathname;
const SCENES = join(ROOT, "diagrams");
const SVGS = join(ROOT, "public/diagrams");
const FONTS = join(HERE, "node_modules/@excalidraw/excalidraw/dist/prod/");
const ORIGIN = "http://diagrams.invalid/";
const force = process.argv.includes("--force");

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
const blocks = new Map();
for (const file of walk(join(ROOT, "src/content")).filter((f) => /\.mdx?$/.test(f))) {
  for (const m of readFileSync(file, "utf8").matchAll(/^```mermaid[^\n]*\n([\s\S]*?)^```/gm)) {
    const id = diagramId(m[1]);
    if (!blocks.has(id)) blocks.set(id, { source: m[1], file: relative(ROOT, file) });
  }
}
mkdirSync(SCENES, { recursive: true });
mkdirSync(SVGS, { recursive: true });

const mtime = (f) => (existsSync(f) ? statSync(f).mtimeMs : 0);
const todo = [...blocks].filter(([id]) => {
  const scene = join(SCENES, `${id}.excalidraw`);
  const svg = join(SVGS, `${id}.svg`);
  return force || !existsSync(scene) || mtime(scene) > mtime(svg);
});

if (todo.length) {
  const bundle = await build({
    entryPoints: [join(HERE, "browser.js")],
    bundle: true,
    format: "esm",
    minify: true,
    write: false,
    define: { "process.env.NODE_ENV": '"production"' },
    loader: { ".css": "empty", ".woff2": "empty" },
    logLevel: "error",
  });
  const browser = await chromium.launch({ executablePath: process.env.MERMAID_CHROME ?? "/usr/bin/google-chrome" });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // Serve the bundle and Excalidraw's own font files from a fake origin; nothing leaves the machine.
  await page.route(`${ORIGIN}**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") {
      return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><meta charset="utf-8"><body><script>window.EXCALIDRAW_ASSET_PATH = "${ORIGIN}";</script><script type="module" src="/bundle.js"></script>`,
      });
    }
    if (path === "/bundle.js") return route.fulfill({ contentType: "text/javascript", body: bundle.outputFiles[0].text });
    const font = join(FONTS, decodeURIComponent(path));
    return font.startsWith(FONTS) && existsSync(font)
      ? route.fulfill({ contentType: "font/woff2", body: readFileSync(font) })
      : route.fulfill({ status: 404 });
  });
  await page.route((url) => !url.href.startsWith(ORIGIN), (route) => route.abort());
  await page.goto(ORIGIN);
  await page.waitForFunction(() => window.ready, null, { timeout: 60_000 });

  for (const [id, { source, file }] of todo) {
    const sceneFile = join(SCENES, `${id}.excalidraw`);
    const redraw = force || !existsSync(sceneFile);
    try {
      const out = redraw
        ? await page.evaluate((s) => window.fromMermaid(s), source)
        : await page.evaluate((s) => window.fromScene(s), JSON.parse(readFileSync(sceneFile, "utf8")));
      if (out.scene) writeFileSync(sceneFile, JSON.stringify(out.scene, null, 2) + "\n");
      writeFileSync(join(SVGS, `${id}.svg`), out.svg + "\n");
      console.log(`${redraw ? "drew" : "re-exported"} ${id}  (${file})`);
    } catch (e) {
      process.exitCode = 1;
      console.error(`failed ${id} (${file}): ${String(e.message ?? e).split("\n")[0]}`);
    }
  }
  await browser.close();
  if (errors.length) console.error(errors.join("\n"));
}

for (const [dir, ext] of [[SCENES, ".excalidraw"], [SVGS, ".svg"]]) {
  for (const f of readdirSync(dir).filter((f) => f.endsWith(ext) && !blocks.has(f.slice(0, -ext.length)))) {
    rmSync(join(dir, f));
    console.log(`removed ${relative(ROOT, join(dir, f))} (no post uses it)`);
  }
}
console.log(`${blocks.size} diagrams, ${todo.length} drawn or re-exported`);
