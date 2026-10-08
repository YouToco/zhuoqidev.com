// Renders the poster of the Argus scene and writes what the page needs from it:
//   npm run poster    (about two minutes on a laptop GPU; tools/models/README.md)
// -> src/assets/models/argus-story-poster.webp   1800 × 1150, transparent background: shown before
//                                                 the 3D scene loads, and to readers without WebGL
//    src/assets/models/argus-story-camera.json   the poster's camera; the 3D scene opens on it
//    src/assets/models/argus-story-pins.json     where each label pin lands on the poster
//
// The scene is the page's own model (src/scripts/argus-story-model.ts), path traced in Chrome by
// ./argus-poster-page.js. Chrome's GPU process resets a WebGL context that renders for much longer
// than ~15 s and the canvas comes back blank, so the poster is PASSES short runs, each in a fresh
// browser with its own random seed, averaged in linear light.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = `${ROOT}src/assets/models/`;
const PASSES = Number(process.env.PASSES ?? 8);
const SAMPLES = Number(process.env.SAMPLES ?? 128);

const bundle = await build({
  entryPoints: [fileURLToPath(new URL("./argus-poster-page.js", import.meta.url))],
  bundle: true,
  format: "iife",
  write: false,
  logLevel: "error",
  plugins: [
    {
      // one three.js for everything (the model, the path tracer, three-mesh-bvh): the site's own
      name: "one-three",
      setup(b) {
        b.onResolve({ filter: /^three(\/|$)/ }, (args) =>
          args.pluginData === "again" ? undefined : b.resolve(args.path, { resolveDir: ROOT, kind: args.kind, pluginData: "again" }),
        );
      },
    },
  ],
});
const code = bundle.outputFiles[0].text;

const pass = async (i) => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
    args: ["--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu"],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.setContent("<!doctype html><body style='margin:0'></body>");
    await page.addScriptTag({ content: code });
    const r = await page.evaluate((o) => window.renderPoster(o), { samples: SAMPLES, seed: i * 1000003 });
    if (errors.length) throw new Error(errors.join("\n"));
    if (/swiftshader|llvmpipe/i.test(r.gpu)) throw new Error(`software rendering (${r.gpu}): run it on a GPU`);
    const { data, info } = await sharp(Buffer.from(r.png.split(",")[1], "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (!data.some((x, k) => k % 4 === 3 && x > 0)) throw new Error(`pass ${i + 1} came back blank (WebGL context lost?)`);
    console.log(`pass ${i + 1}/${PASSES}: ${SAMPLES} samples in ${(r.ms / 1000).toFixed(1)} s on ${r.gpu}`);
    return { ...r, data, info };
  } finally {
    await browser.close();
  }
};

// sRGB <-> linear, to average the passes as light rather than as pixel values
const LIN = Float64Array.from({ length: 256 }, (_, c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4));
const srgb8 = (x) => {
  const y = Math.min(Math.max(x, 0), 1);
  return Math.round((y <= 0.0031308 ? y * 12.92 : 1.055 * y ** (1 / 2.4) - 0.055) * 255);
};

let first = null;
let sum = null;
for (let i = 0; i < PASSES; i++) {
  const r = await pass(i);
  first ??= r;
  sum ??= new Float64Array(r.data.length);
  // premultiplied by alpha, so the scene's soft edges average correctly
  for (let k = 0; k < r.data.length; k += 4) {
    const a = r.data[k + 3] / 255;
    sum[k] += LIN[r.data[k]] * a;
    sum[k + 1] += LIN[r.data[k + 1]] * a;
    sum[k + 2] += LIN[r.data[k + 2]] * a;
    sum[k + 3] += a;
  }
}
const px = Buffer.alloc(sum.length);
for (let k = 0; k < sum.length; k += 4) {
  const a = sum[k + 3];
  if (a <= 0) continue;
  px[k] = srgb8(sum[k] / a);
  px[k + 1] = srgb8(sum[k + 1] / a);
  px[k + 2] = srgb8(sum[k + 2] / a);
  px[k + 3] = Math.round((a / PASSES) * 255);
}
const { width, height } = first.info;
await sharp(px, { raw: { width, height, channels: 4 } })
  .webp({ quality: 92, effort: 6 })
  .toFile(`${OUT}argus-story-poster.webp`);
writeFileSync(`${OUT}argus-story-camera.json`, JSON.stringify(first.camera, null, 1));
writeFileSync(`${OUT}argus-story-pins.json`, JSON.stringify(first.pins, null, 1));
console.log(`${PASSES * SAMPLES} samples -> ${OUT}argus-story-poster.webp, -camera.json, -pins.json`);
