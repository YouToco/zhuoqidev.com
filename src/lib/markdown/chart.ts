/**
 * Data charts written as ```chart fences holding JSON. They are drawn at build time into plain
 * HTML (bars, stacked bars) or HTML around an SVG (lines): no chart library, no script, and the
 * text stays real text, so it follows the page theme, wraps on a phone and is read by screen
 * readers. The Markdown twin (index.md) turns the same fence into a table.
 *
 *   bars   one value per row; `panels` gives several sets behind tabs (each with its own scale)
 *   stack  several parts per row, laid end to end
 *   line   y against a numeric x for a few series, with optional marked points
 */
import type { Lang } from "./lang";

export type Color = "seal" | "blue" | "green" | "gold" | "gray";
export interface Fmt {
  pre?: string;
  suf?: string;
  digits?: number;
}
export interface BarRow {
  label: string;
  sub?: string;
  value: number;
  color?: Color;
}
export interface Ref {
  value: number;
  label: string;
}
export interface BarsPanel {
  title: string;
  rows: BarRow[];
  ref?: Ref;
}
export interface BarsSpec {
  type: "bars";
  fmt?: Fmt;
  rows?: BarRow[];
  ref?: Ref;
  panels?: BarsPanel[];
  /** Colour keys shown above the bars, e.g. what the highlighted colours mean. */
  legend?: { color: Color; label: string }[];
  caption?: string;
}
export interface StackSpec {
  type: "stack";
  fmt?: Fmt;
  series: { key: string; label: string; color: Color }[];
  rows: { label: string; sub?: string; values: Record<string, number> }[];
  caption?: string;
}
export interface LineSpec {
  type: "line";
  fmt?: Fmt;
  x: { label: string; min: number; max: number; ticks: number[]; suf?: string };
  y: { label: string; max: number; ticks: number[] };
  series: { label: string; color: Color; dash?: boolean; points: [number, number][] }[];
  marks?: { x: number; y: number; label: string; color?: Color; side?: "left" | "right" }[];
  caption?: string;
}
export type ChartSpec = BarsSpec | StackSpec | LineSpec;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const num = (v: number, digits = 0) =>
  v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const fmtValue = (v: number, f: Fmt = {}) => `${f.pre ?? ""}${num(v, f.digits ?? 0)}${f.suf ?? ""}`;
/** Axis ticks: 50,000 → "5 万" / "50k". */
function fmtTick(v: number, f: Fmt, lang: Lang) {
  const short = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (lang === "zh" && Math.abs(v) >= 10_000) return `${f.pre ?? ""}${short(v / 10_000)} 万${f.suf ?? ""}`;
  if (lang === "en" && Math.abs(v) >= 1_000) return `${f.pre ?? ""}${short(v / 1_000)}k${f.suf ?? ""}`;
  return fmtValue(v, f);
}
const share = (v: number, max: number) => (max > 0 ? Math.max(0, Math.min(1, v / max)) : 0).toFixed(4);
/** Room after the longest bar for its value label, in em of the value font. */
const room = (labels: string[]) => `${(Math.max(...labels.map((s) => s.length)) * 0.62 + 0.8).toFixed(2)}em`;

function caption(spec: { caption?: string }) {
  return spec.caption ? `<figcaption>${esc(spec.caption)}</figcaption>` : "";
}
function legend(items: { color: Color; label: string }[], extra = "") {
  if (!items.length && !extra) return "";
  const keys = items
    .map((i) => `<span><i class="sw c-${i.color}" aria-hidden="true"></i>${esc(i.label)}</span>`)
    .join("");
  return `<div class="chart-legend">${keys}${extra}</div>`;
}

function barRows(rows: BarRow[], f: Fmt, ref?: Ref) {
  const max = Math.max(...rows.map((r) => r.value), ref?.value ?? 0);
  const values = rows.map((r) => fmtValue(r.value, f));
  const refPos = ref ? share(ref.value, max) : null;
  const body = rows
    .map((r, i) => {
      const label = `<span class="cb-label">${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</span>`;
      const refMark = refPos ? `<span class="cb-ref" style="--r:${refPos}" aria-hidden="true"></span>` : "";
      return (
        `${label}<span class="cb-track" style="--v:${share(r.value, max)}">${refMark}` +
        `<span class="cb-bar c-${r.color ?? "gray"}"></span><span class="cb-val">${values[i]}</span></span>`
      );
    })
    .join("");
  return `<div class="cb" style="--room:${room(values)}">${body}</div>`;
}
const refKey = (ref: Ref, f: Fmt) =>
  `<span><i class="sw ref" aria-hidden="true"></i>${esc(ref.label)} ${fmtValue(ref.value, f)}</span>`;

function renderBars(spec: BarsSpec, id: string) {
  const f = spec.fmt ?? {};
  const keys = spec.legend ?? [];
  if (!spec.panels) {
    const rows = spec.rows ?? [];
    return (
      `<figure class="chart chart-bars">${legend(keys, spec.ref ? refKey(spec.ref, f) : "")}` +
      `${barRows(rows, f, spec.ref)}${caption(spec)}</figure>`
    );
  }
  // Panels behind tabs made of radio buttons: works without script, and without CSS every panel shows.
  const inputs = spec.panels
    .map(
      (_, i) =>
        `<input class="ct-in" type="radio" name="${id}" id="${id}-${i}"${i === 0 ? " checked" : ""} />`,
    )
    .join("");
  const tabs = spec.panels.map((p, i) => `<label for="${id}-${i}">${esc(p.title)}</label>`).join("");
  const panels = spec.panels
    .map(
      (p) =>
        `<div class="cpanel"><p class="cpanel-t">${esc(p.title)}</p>` +
        `${p.ref ? legend([], refKey(p.ref, f)) : ""}${barRows(p.rows, f, p.ref)}</div>`,
    )
    .join("");
  return (
    `<figure class="chart chart-bars has-tabs">${inputs}<div class="ct">${tabs}</div>` +
    `${legend(keys)}<div class="cpanels">${panels}</div>${caption(spec)}</figure>`
  );
}

function renderStack(spec: StackSpec) {
  const f = spec.fmt ?? {};
  const totals = spec.rows.map((r) => spec.series.reduce((s, k) => s + (r.values[k.key] ?? 0), 0));
  const max = Math.max(...totals);
  const totalText = totals.map((t) => fmtValue(t, f));
  const body = spec.rows
    .map((r, i) => {
      const total = totals[i]!;
      const parts = spec.series
        .filter((s) => (r.values[s.key] ?? 0) > 0)
        .map((s) => {
          const v = r.values[s.key]!;
          const pct = Math.round((v / total) * 100);
          // A percentage fits inside a part that is a fifth of its row and not a sliver of the widest row.
          const inner = v / total >= 0.2 && v / max >= 0.08 ? `<span class="cs-in">${pct}%</span>` : "";
          return `<span class="cs-seg c-${s.color}" style="--w:${share(v, total)}" title="${esc(s.label)} ${fmtValue(v, f)}（${pct}%）">${inner}</span>`;
        })
        .join("");
      const spoken = spec.series
        .map((s) => `${s.label} ${fmtValue(r.values[s.key] ?? 0, f)}`)
        .join("; ");
      return (
        `<span class="cb-label">${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ""}` +
        `<span class="sr-only">: ${esc(spoken)}</span></span>` +
        `<span class="cb-track" aria-hidden="true"><span class="cs-bar" style="--v:${share(total, max)}">${parts}</span>` +
        `<span class="cb-val">${totalText[i]}</span></span>`
      );
    })
    .join("");
  return (
    `<figure class="chart chart-stack">${legend(spec.series)}` +
    `<div class="cb" style="--room:${room(totalText)}">${body}</div>${caption(spec)}</figure>`
  );
}

function renderLine(spec: LineSpec, lang: Lang) {
  const f = spec.fmt ?? {};
  const { x, y } = spec;
  const px = (v: number) => ((v - x.min) / (x.max - x.min)) * 1000;
  const py = (v: number) => 600 - (v / y.max) * 600;
  const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`;
  const grid = y.ticks
    .map((t) => `<line x1="0" x2="1000" y1="${py(t).toFixed(1)}" y2="${py(t).toFixed(1)}" class="grid" />`)
    .join("");
  const lines = spec.series
    .map(
      (s) =>
        `<polyline class="ln c-${s.color}${s.dash ? " dash" : ""}" points="${s.points
          .map(([a, b]) => `${px(a).toFixed(1)},${py(b).toFixed(1)}`)
          .join(" ")}" />`,
    )
    .join("");
  const yTicks = y.ticks
    .map((t) => `<span style="top:${pct(py(t), 600)}">${fmtTick(t, f, lang)}</span>`)
    .join("");
  const xTicks = x.ticks
    .map((t) => `<span style="left:${pct(px(t), 1000)}">${num(t)}${esc(x.suf ?? "")}</span>`)
    .join("");
  const marks = (spec.marks ?? [])
    .map(
      (m) =>
        `<span class="cl-mark c-${m.color ?? "gray"}${m.side === "left" ? " left" : ""}" style="left:${pct(px(m.x), 1000)};top:${pct(py(Math.min(m.y, y.max)), 600)}"><i></i><b>${esc(m.label)}</b></span>`,
    )
    .join("");
  const keys = spec.series
    .map(
      (s) =>
        `<span><svg class="sw-line" viewBox="0 0 24 8" aria-hidden="true"><line x1="1" x2="23" y1="4" y2="4" class="ln c-${s.color}${s.dash ? " dash" : ""}" /></svg>${esc(s.label)}</span>`,
    )
    .join("");
  // The same numbers as a table for screen readers (the picture itself is aria-hidden).
  const xs = [...new Set(spec.series.flatMap((s) => s.points.map((p) => p[0])))].sort((a, b) => a - b);
  const table =
    `<div class="sr-only"><table><caption>${esc(spec.caption ?? spec.y.label)}</caption><thead><tr><th>${esc(x.label)}</th>` +
    spec.series.map((s) => `<th>${esc(s.label)}</th>`).join("") +
    "</tr></thead><tbody>" +
    xs
      .map(
        (xv) =>
          `<tr><th>${num(xv)}${esc(x.suf ?? "")}</th>` +
          spec.series
            .map((s) => {
              const p = s.points.find((q) => q[0] === xv);
              return `<td>${p ? fmtValue(p[1], f) : ""}</td>`;
            })
            .join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table></div>";
  return (
    `<figure class="chart chart-line"><div class="chart-legend">${keys}</div>` +
    `<div class="cl" aria-hidden="true"><span class="cl-ylab">${esc(y.label)}</span><div class="cl-y">${yTicks}</div>` +
    `<div class="cl-plot"><svg viewBox="0 0 1000 600" preserveAspectRatio="none">${grid}${lines}</svg>${marks}</div>` +
    `<div class="cl-x">${xTicks}</div><span class="cl-xlab">${esc(x.label)}</span></div>` +
    `${table}${caption(spec)}</figure>`
  );
}

export function renderChart(spec: ChartSpec, id: string, lang: Lang): string {
  switch (spec.type) {
    case "bars":
      return renderBars(spec, id);
    case "stack":
      return renderStack(spec);
    case "line":
      return renderLine(spec, lang);
  }
}

/** The chart as a Markdown table, for index.md and llms-full.txt. */
export function chartMarkdown(spec: ChartSpec, lang: Lang): string {
  const f = spec.fmt ?? {};
  const row = (cells: string[]) => `| ${cells.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`;
  const head = (cells: string[]) => [row(cells), row(cells.map(() => "---"))].join("\n");
  const label = (r: { label: string; sub?: string }) => (r.sub ? `${r.label}（${r.sub}）` : r.label);
  let out: string;
  if (spec.type === "bars") {
    if (spec.panels) {
      const labels = [...new Set(spec.panels.flatMap((p) => p.rows.map((r) => label(r))))];
      out = [
        head(["", ...spec.panels.map((p) => p.title)]),
        ...labels.map((l) =>
          row([l, ...spec.panels!.map((p) => {
            const r = p.rows.find((q) => label(q) === l);
            return r ? fmtValue(r.value, f) : "";
          })]),
        ),
      ].join("\n");
    } else {
      const rows = spec.rows ?? [];
      out = [head(["", ""]), ...rows.map((r) => row([label(r), fmtValue(r.value, f)]))].join("\n");
    }
    const refs = [spec.ref, ...(spec.panels ?? []).map((p) => p.ref)].filter(Boolean) as Ref[];
    if (refs.length) out += "\n\n" + refs.map((r) => `- ${r.label}: ${fmtValue(r.value, f)}`).join("\n");
  } else if (spec.type === "stack") {
    out = [
      head(["", ...spec.series.map((s) => s.label), lang === "zh" ? "合计" : "Total"]),
      ...spec.rows.map((r) => {
        const total = spec.series.reduce((s, k) => s + (r.values[k.key] ?? 0), 0);
        return row([label(r), ...spec.series.map((s) => fmtValue(r.values[s.key] ?? 0, f)), fmtValue(total, f)]);
      }),
    ].join("\n");
  } else {
    const xs = [...new Set(spec.series.flatMap((s) => s.points.map((p) => p[0])))].sort((a, b) => a - b);
    out = [
      head([spec.x.label, ...spec.series.map((s) => s.label)]),
      ...xs.map((xv) =>
        row([
          `${num(xv)}${spec.x.suf ?? ""}`,
          ...spec.series.map((s) => {
            const p = s.points.find((q) => q[0] === xv);
            return p ? fmtValue(p[1], f) : "";
          }),
        ]),
      ),
    ].join("\n");
    if (spec.marks?.length) out += "\n\n" + spec.marks.map((m) => `- ${m.label}`).join("\n");
  }
  return spec.caption ? `${out}\n\n*${spec.caption}*` : out;
}
