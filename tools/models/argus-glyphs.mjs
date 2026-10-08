// The few characters the Argus scene spells in 3D ("?", "10.0s", "25.0s", "-") as a three.js
// typeface subset, so the page can extrude them without shipping a whole font.
//   node tools/models/argus-glyphs.mjs  ->  src/assets/models/argus-story-glyphs.json
// Inter 4.1 from its release commit, checked against a pinned SHA-256, with tabular figures (tnum):
// the scene's numbers were first set in Blender, whose built-in Inter has tabular figures by default.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { create } from "fontkit";

const FONT = {
  url: "https://raw.githubusercontent.com/rsms/inter/e3a3d4c57d5ecc01453a575621882a384c1995a3/docs/font-files/InterVariable.woff2", // tag v4.1
  sha256: "693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3",
};
const CHARS = "?0125.s-";

const res = await fetch(FONT.url);
if (!res.ok) throw new Error(`${FONT.url}: HTTP ${res.status}`);
const bytes = Buffer.from(await res.arrayBuffer());
const got = createHash("sha256").update(bytes).digest("hex");
if (got !== FONT.sha256) throw new Error(`InterVariable.woff2: sha256 ${got}, expected ${FONT.sha256}`);
const font = create(bytes);
const r = (n) => Math.round(n);

// three's typeface outline: "m x y", "l x y", "q x y cpx cpy" (end point first), "b x y c1x c1y c2x c2y".
const outline = (commands) =>
  commands
    .map(({ command, args: a }) => {
      if (command === "moveTo") return `m ${r(a[0])} ${r(a[1])}`;
      if (command === "lineTo") return `l ${r(a[0])} ${r(a[1])}`;
      if (command === "quadraticCurveTo") return `q ${r(a[2])} ${r(a[3])} ${r(a[0])} ${r(a[1])}`;
      if (command === "bezierCurveTo") return `b ${r(a[4])} ${r(a[5])} ${r(a[0])} ${r(a[1])} ${r(a[2])} ${r(a[3])}`;
      return "";
    })
    .filter(Boolean)
    .join(" ");

const glyphs = {};
for (const ch of CHARS) {
  const run = font.layout(ch, ["tnum"]);
  const [g] = run.glyphs;
  const box = g.path.bbox;
  glyphs[ch] = { ha: r(run.positions[0].xAdvance), x_min: r(box.minX), x_max: r(box.maxX), o: outline(g.path.commands) };
}
const out = {
  familyName: font.familyName,
  resolution: font.unitsPerEm,
  ascender: font.ascent,
  descender: font.descent,
  underlinePosition: font.underlinePosition,
  underlineThickness: font.underlineThickness,
  boundingBox: { xMin: font.bbox.minX, yMin: font.bbox.minY, xMax: font.bbox.maxX, yMax: font.bbox.maxY },
  glyphs,
};
const path = fileURLToPath(new URL("../../src/assets/models/argus-story-glyphs.json", import.meta.url));
writeFileSync(path, `${JSON.stringify(out)}\n`);
console.log(`${Object.keys(glyphs).length} glyphs from ${font.familyName} -> ${path}`);
