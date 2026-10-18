/**
 * An opening scene written as a ```opener fence holding JSON, in the spirit of a product page's
 * cold open: one huge word, a device rising under it, the word turning into the headline, then a
 * few readouts lighting up one by one. It is drawn at build time as plain HTML (the device is CSS,
 * not an image or a video), so every word stays real text. The page script plays it once when it
 * scrolls into view (src/scripts/site.ts, [data-opener]); without the script, or with reduced motion,
 * the reader sees the last frame. The Markdown twin (index.md) gets the headline and the readouts.
 *
 *   word      the first, huge word ("能跑。")
 *   headline  what the word becomes, and what stays on screen
 *   sub       one line under the headline
 *   device    the machine drawn under the word ("mac-mini")
 *   readouts  label / value pairs that light up after the headline; tone "bad" turns the value
 *             and the device's status light red
 *   note      small print: the source of the readouts
 */
import type { Lang } from "./lang";

export interface OpenerSpec {
  word: string;
  headline: string;
  sub?: string;
  device?: "mac-mini";
  readouts?: { label: string; value: string; tone?: "bad" }[];
  note?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function device(spec: OpenerSpec) {
  if (spec.device !== "mac-mini") return "";
  const bad = spec.readouts?.some((r) => r.tone === "bad") ? " has-bad" : "";
  return (
    `<div class="opener-device mac-mini${bad}" aria-hidden="true">` +
    `<span class="port"></span><span class="port"></span><span class="jack"></span><span class="led"></span>` +
    `</div>`
  );
}

export function renderOpener(spec: OpenerSpec, id: string): string {
  const readouts = (spec.readouts ?? [])
    .map(
      (r, i) =>
        `<li class="opener-read${r.tone === "bad" ? " bad" : ""}" style="--i:${i}">` +
        `<span class="hr-label">${esc(r.label)}</span><span class="hr-value">${esc(r.value)}</span></li>`,
    )
    .join("");
  return (
    `<figure class="opener" id="${id}" data-opener aria-labelledby="${id}-h">` +
    `<div class="opener-stage">` +
    `<p class="opener-word" aria-hidden="true">${esc(spec.word)}</p>` +
    `<p class="opener-head" id="${id}-h">${esc(spec.headline)}</p>` +
    `</div>` +
    device(spec) +
    (spec.sub ? `<p class="opener-sub">${esc(spec.sub)}</p>` : "") +
    (readouts ? `<ol class="opener-reads">${readouts}</ol>` : "") +
    (spec.note ? `<figcaption>${esc(spec.note)}</figcaption>` : "") +
    `</figure>`
  );
}

/** The same scene for agents: the headline, the line under it and the readouts as a list. */
export function openerMarkdown(spec: OpenerSpec, lang: Lang): string {
  const sep = lang === "zh" ? "：" : ": ";
  const lines = [`> **${spec.headline}**`];
  if (spec.sub) lines.push(">", `> ${spec.sub}`);
  for (const r of spec.readouts ?? []) lines.push(`> - ${r.label}${sep}${r.value}`);
  if (spec.note) lines.push(">", `> *${spec.note}*`);
  return lines.join("\n");
}
