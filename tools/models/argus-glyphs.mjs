// The few characters the Argus scene spells in 3D ("?", "10.0s", "25.0s", "-") as a three.js
// typeface subset, so the page can extrude them without shipping a whole font.
//   node tools/models/argus-glyphs.mjs [font]  ->  src/assets/models/argus-story-glyphs.json
// Inter by default: Blender's built-in text font ("Bfont"), which it ships as datafiles/fonts/Inter.woff2.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { create } from "fontkitten";

const CHARS = "?0125.s-";
const src = process.argv[2] ?? `${process.env.HOME}/.local/opt/blender/current/5.2/datafiles/fonts/Inter.woff2`;
const font = create(readFileSync(src));
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
  const g = font.glyphForCodePoint(ch.codePointAt(0));
  const box = g.path.bbox;
  glyphs[ch] = { ha: r(g.advanceWidth), x_min: r(box.minX), x_max: r(box.maxX), o: outline(g.path.commands) };
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
