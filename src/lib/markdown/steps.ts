/**
 * A walk-through written as a ```steps fence holding JSON: one panel per stage, a row of numbered
 * dots, and "previous / next" under each panel. It is for a process the reader should take one
 * stage at a time, and for a loop (the last "next" goes back to the first), which a ring diagram
 * draws badly. Built at build time from radio buttons and labels, like the chart tabs: no script,
 * and without CSS every stage shows in order. A stage can carry a ```chart spec of its own.
 *
 *   steps    { title, text, chart? }; `text` takes **bold** and nothing else
 *   loop     the last stage's "next" returns to the first
 *   caption  one line under the figure
 */
import { type ChartSpec, chartMarkdown, renderChart } from "./chart";
import type { Lang } from "./lang";

export interface StepsSpec {
  steps: { title: string; text: string; chart?: ChartSpec }[];
  loop?: boolean;
  caption?: string;
}

/** The CSS shows at most this many stages; more fails the build rather than hiding some. */
export const MAX_STEPS = 8;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

const words = {
  zh: {
    prev: "← 上一步",
    next: "下一步 →",
    again: "从头再看 ↺",
    of: (i: number, n: number) => `第 ${i} 步 / 共 ${n} 步`,
  },
  en: { prev: "← Back", next: "Next →", again: "Start over ↺", of: (i: number, n: number) => `Step ${i} of ${n}` },
} as const;

export function renderSteps(spec: StepsSpec, id: string, lang: Lang): string {
  const w = words[lang];
  const n = spec.steps.length;
  const inputs = spec.steps
    .map((_, i) => `<input class="st-in" type="radio" name="${id}" id="${id}-${i}"${i === 0 ? " checked" : ""} />`)
    .join("");
  const dots = spec.steps
    .map((s, i) => `<label for="${id}-${i}" title="${esc(s.title)}"><span>${i + 1}</span></label>`)
    .join("");
  const panels = spec.steps
    .map((s, i) => {
      const prev = i > 0 ? `<label class="st-prev" for="${id}-${i - 1}">${w.prev}</label>` : "<span></span>";
      const last = i === n - 1;
      const next = !last
        ? `<label class="st-next" for="${id}-${i + 1}">${w.next}</label>`
        : spec.loop
          ? `<label class="st-next" for="${id}-0">${w.again}</label>`
          : "";
      const chart = s.chart ? renderChart(s.chart, `${id}-c${i}`, lang) : "";
      return (
        `<section class="st-panel"><p class="st-of">${w.of(i + 1, n)}</p>` +
        `<p class="st-t">${esc(s.title)}</p><p class="st-x">${inline(s.text)}</p>${chart}` +
        `<div class="st-nav">${prev}${next}</div></section>`
      );
    })
    .join("");
  const cap = spec.caption ? `<figcaption>${esc(spec.caption)}</figcaption>` : "";
  return (
    `<figure class="chart chart-steps">${inputs}<div class="st-dots">${dots}</div>` +
    `<div class="st-panels">${panels}</div>${cap}</figure>`
  );
}

/** The walk-through as a numbered list, for index.md and llms-full.txt. */
export function stepsMarkdown(spec: StepsSpec, lang: Lang): string {
  const sep = lang === "zh" ? "：" : ": ";
  const items = spec.steps.map((s, i) => {
    const chart = s.chart
      ? "\n\n" +
        chartMarkdown(s.chart, lang)
          .split("\n")
          .map((l) => (l ? `   ${l}` : l))
          .join("\n")
      : "";
    return `${i + 1}. **${s.title}**${sep}${s.text}${chart}`;
  });
  const loop = spec.loop
    ? `\n\n${lang === "zh" ? "（最后一步之后回到第 1 步）" : "(After the last step, back to step 1.)"}`
    : "";
  const cap = spec.caption ? `\n\n*${spec.caption}*` : "";
  return items.join("\n") + loop + cap;
}
