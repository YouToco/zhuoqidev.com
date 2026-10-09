/**
 * A ```comic script drawn at build time as HTML panels with SVG characters: the dialogue stays real
 * text (it wraps on a phone, follows the page and is read by screen readers and agents), and the
 * fixed cast are the same pictures in every comic, so readers recognise them across articles.
 * The script format is parsed in ./comic.ts.
 */
import { CAST, type CastKey, type ComicScript } from "./comic.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The cast are Microsoft Fluent Emoji (3D style, MIT licence): a user, your service, the LLM, the
 * cloud provider (with flying money: it sends the bill) and you, the developer.
 */
// Served from public/comics/ (128px webp, licence in public/comics/LICENSE.txt).
const img = (name: string, size: number, cls = "") =>
  `<img${cls ? ` class="${cls}"` : ""} src="/comics/${name}.webp" width="${size}" height="${size}" alt="" loading="lazy" decoding="async">`;

function figure(who: CastKey, name: string) {
  const badge = who === "cloud" ? img("money", 30, "cm-badge") : "";
  return `<figure class="cm-who" aria-hidden="true"><span class="cm-face">${img(who, 60)}${badge}</span><figcaption>${esc(name)}</figcaption></figure>`;
}

/** The script as HTML. Speakers alternate sides within a panel, in order of first appearance. */
export function renderComicHtml(script: ComicScript, cols: number, lang: "zh" | "en"): string {
  const panels = script.panels
    .map((p) => {
      const side = new Map<CastKey, "l" | "r">();
      for (const l of p.lines) if (!side.has(l.who)) side.set(l.who, side.size % 2 ? "r" : "l");
      const lines = p.lines
        .map((l) => {
          const s = side.get(l.who)!;
          const name = l.name || CAST[l.who][lang];
          const bubble = `<p class="cm-bub${l.highlight ? " hl" : ""}"><span class="sr-only">${esc(name)}：</span>${esc(l.text)}</p>`;
          return `<div class="cm-line ${s}">${figure(l.who, name)}${bubble}</div>`;
        })
        .join("");
      const nar = p.narration ? `<p class="cm-nar">${esc(p.narration)}</p>` : "";
      return `<div class="cm-panel">${nar}${lines}</div>`;
    })
    .join("");
  const title = script.title ? `<p class="cm-title">${esc(script.title)}</p>` : "";
  return `<figure class="comic" lang="${lang === "zh" ? "zh-CN" : "en"}" style="--cols:${cols}">${title}<div class="cm-grid">${panels}</div></figure>`;
}
