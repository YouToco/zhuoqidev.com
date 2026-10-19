// Draws the article glyphs in src/data/glyphs.ts at build time, as plain SVG with no script.
// sketch(): a rough pen drawing (rough.js, fixed seeds so every build draws the same lines) with
// a second frame that CSS flips to and fro on hover, like a hand-drawn animation "boiling".
// tile(): the same shapes inked bold on a colored tile, for the article header.
// Text shapes (a keyword or number from the article) are set in the hand face, not sketched.
// Colors are CSS classes, not attributes, so both drawings follow the light and dark themes.
import rough from "roughjs";
import { GLYPHS, type GlyphName, type Shape } from "../data/glyphs";

/** How many sketch frames each list glyph carries; frames after the first only show on hover. */
export const FRAMES = 2;

// rough.js takes colors, not classes: draw with placeholder colors, then swap each for a class.
const STROKE = "#000001";
const STROKE_RED = "#a00001";
const HATCH = "#000002";
const HATCH_RED = "#a00002";
const SOLID = "#000003";
const SOLID_RED = "#a00003";
const PAPER = "#ffff01";
const CLASS: Record<string, string> = {
  [STROKE]: "k",
  [STROKE_RED]: "a",
  [HATCH]: "k",
  [HATCH_RED]: "a",
  [SOLID]: "kf",
  [SOLID_RED]: "af",
  [PAPER]: "pf",
};

const gen = rough.generator();

/** Whole units (under a pixel at list size) are as fine as the pen; this keeps the list pages light. */
const short = (d: string) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n))));

function seedOf(name: string): number {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 16777619);
  return (h >>> 0) % 100000;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function text(s: Extract<Shape, { k: "text" }>, cls: string): string {
  return `<text class="${cls}" x="${String(s.x)}" y="${String(s.y)}" font-size="${String(s.size)}" text-anchor="middle">${esc(s.t)}</text>`;
}

function sketchShape(s: Shape, seed: number): string {
  const red = s.accent === true;
  if (s.k === "text") return text(s, `${red ? "at" : "kt"}${s.onInk ? " halo" : ""}`);
  const fill =
    s.fill === "hatch"
      ? {
          fill: red ? HATCH_RED : HATCH,
          fillStyle: "hachure",
          hachureGap: 4.2,
          fillWeight: 0.7,
          disableMultiStrokeFill: true,
        }
      : s.fill === "ink"
        ? { fill: red ? SOLID_RED : SOLID, fillStyle: "solid" }
        : s.fill === "paper"
          ? { fill: PAPER, fillStyle: "solid" }
          : {};
  const o = {
    seed,
    roughness: s.small ? 0.3 : 1.25,
    bowing: s.small ? 0.2 : 1.2,
    stroke: red ? STROKE_RED : STROKE,
    strokeWidth: s.thin ? 1.1 : 1.7,
    preserveVertices: true,
    ...fill,
  };
  const d =
    s.k === "poly"
      ? gen.polygon(s.pts, o)
      : s.k === "path"
        ? gen.path(s.d, o)
        : s.k === "ellipse"
          ? gen.ellipse(s.cx, s.cy, s.w, s.h, o)
          : s.k === "rect"
            ? gen.rectangle(s.x, s.y, s.w, s.h, o)
            : gen.line(s.x1, s.y1, s.x2, s.y2, o);
  return gen
    .toPaths(d)
    .map((p) => {
      const filled = p.fill !== undefined && p.fill !== "none";
      const cls = CLASS[filled ? (p.fill ?? "") : p.stroke] ?? "k";
      return filled
        ? `<path class="${cls}" d="${short(p.d)}"/>`
        : `<path class="${cls}" stroke-width="${String(p.strokeWidth)}" d="${short(p.d)}"/>`;
    })
    .join("");
}

/** The list glyph: FRAMES pen sketches of the same object, stacked. */
export function sketch(name: GlyphName): string {
  const base = seedOf(name);
  const frames = Array.from(
    { length: FRAMES },
    (_, f) => `<g class="fr">${GLYPHS[name].shapes.map((s, i) => sketchShape(s, base + f * 101 + i)).join("")}</g>`,
  );
  return `<svg class="post-glyph" viewBox="0 0 100 100" aria-hidden="true">${frames.join("")}</svg>`;
}

const pts = (p: [number, number][]) => `M${p.map(([x, y]) => `${String(x)} ${String(y)}`).join("L")}Z`;

function tileShape(s: Shape): string {
  if (s.k === "text") return text(s, s.onInk ? "tp" : s.accent ? "ta" : "tk");
  const stroke = s.onInk ? "sp" : s.accent ? "sa" : "sk";
  const fill = s.fill === "hatch" || s.fill === "ink" ? (s.accent ? "fa" : "fk") : s.fill === "paper" ? "fp" : "fn";
  const attrs = `class="${stroke} ${fill}" stroke-width="${s.thin ? "2.2" : "3.2"}"`;
  switch (s.k) {
    case "poly":
      return `<path ${attrs} d="${pts(s.pts)}"/>`;
    case "path":
      return `<path ${attrs} d="${s.d}"/>`;
    case "ellipse":
      return `<ellipse ${attrs} cx="${String(s.cx)}" cy="${String(s.cy)}" rx="${String(s.w / 2)}" ry="${String(s.h / 2)}"/>`;
    case "rect":
      return `<rect ${attrs} x="${String(s.x)}" y="${String(s.y)}" width="${String(s.w)}" height="${String(s.h)}" rx="1.5"/>`;
    case "line":
      return `<line ${attrs} x1="${String(s.x1)}" y1="${String(s.y1)}" x2="${String(s.x2)}" y2="${String(s.y2)}"/>`;
  }
}

function spark([x, y, k]: [number, number, number]): string {
  const a = 5 * k;
  const b = 1.3 * k;
  const n = (v: number) => String(Math.round(v * 10) / 10);
  return `<path class="spark" d="M${n(x)} ${n(y - a)}L${n(x + b)} ${n(y - b)}L${n(x + a)} ${n(y)}L${n(x + b)} ${n(y + b)}L${n(x)} ${n(y + a)}L${n(x - b)} ${n(y + b)}L${n(x - a)} ${n(y)}L${n(x - b)} ${n(y - b)}Z"/>`;
}

/** The article-header drawing: bold ink on a colored tile. */
export function tile(name: GlyphName): string {
  const g = GLYPHS[name];
  return `<svg class="post-tile t${String(g.tile)}" viewBox="0 0 100 100" aria-hidden="true"><rect class="bg" width="100" height="100"/><g transform="translate(11 11) scale(.78)">${g.shapes.map(tileShape).join("")}${g.sparks.map(spark).join("")}</g></svg>`;
}
