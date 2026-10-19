// The design library (/design/): UI pieces worth keeping, each a self-contained demo page that a
// reader can try, copy, or hand to their coding agent. Entries live in src/content/design/<slug>/,
// demos in public/design/demos/<slug>/ (served as is, so an iframe and "open in a new tab" both work).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCollection, type CollectionEntry } from "astro:content";
import { type Lang, other, url } from "../i18n";
import { SITE_URL } from "../site";
import { assertPaired, assertRendered, langOf, slugOf, ymd } from "./content";

export type Design = CollectionEntry<"design">;

export const CATEGORIES = ["button", "navigation", "card", "layout", "style", "motion", "visual"] as const;
export type Category = (typeof CATEGORIES)[number];

export const categoryLabel: Record<Lang, Record<Category, string>> = {
  zh: {
    button: "按钮与控件",
    navigation: "导航",
    card: "卡片与小部件",
    layout: "整页与区块",
    style: "整体风格",
    motion: "动画效果",
    visual: "图表与 3D",
  },
  en: {
    button: "Buttons & controls",
    navigation: "Navigation",
    card: "Cards & widgets",
    layout: "Pages & sections",
    style: "Visual styles",
    motion: "Motion",
    visual: "Charts & 3D",
  },
};

export const originLabel = {
  zh: { original: "原创", recreated: "复现" },
  en: { original: "Original", recreated: "Recreated" },
} as const;

/** Fields that describe the demo itself, so both editions must agree on them. */
const SHARED = ["category", "origin", "stack", "order", "files", "demoHeight"] as const;

function assertSameDemo(all: Design[]) {
  const bySlug = new Map<string, Design[]>();
  for (const e of all) bySlug.set(slugOf(e), [...(bySlug.get(slugOf(e)) ?? []), e]);
  const drift: string[] = [];
  for (const [slug, [a, b]] of bySlug) {
    if (!a || !b) continue;
    for (const k of SHARED) {
      if (JSON.stringify(a.data[k]) !== JSON.stringify(b.data[k])) drift.push(`design/${slug}: ${k}`);
    }
    if (a.data.inspiredBy?.url !== b.data.inspiredBy?.url) drift.push(`design/${slug}: inspiredBy`);
  }
  if (drift.length) throw new Error(`zh and en disagree on: ${drift.join(", ")}`);
}

export async function getDesigns(lang: Lang): Promise<Design[]> {
  const all = await getCollection("design");
  assertPaired(all, "design");
  assertRendered(all, "design");
  assertSameDemo(all);
  return all
    .filter((e) => langOf(e) === lang)
    .sort((a, b) => a.data.order - b.data.order || slugOf(a).localeCompare(slugOf(b)));
}

export const designUrl = (lang: Lang, slug: string) => url(lang, `/design/${slug}/`);
/** Demos are the same file for both languages. */
export const demoPath = (slug: string, file = "") => `/design/demos/${slug}/${file}`;

const FENCE: Record<string, string> = { html: "html", css: "css", js: "js", mjs: "js", ts: "ts", json: "json" };
export const fenceLang = (name: string) => FENCE[name.split(".").pop() ?? ""] ?? "text";

export async function demoFiles(entry: Design) {
  const slug = slugOf(entry);
  return Promise.all(
    entry.data.files.map(async (name) => ({
      name,
      lang: fenceLang(name),
      text: await readFile(join(process.cwd(), "public", demoPath(slug, name)), "utf8"),
    })),
  );
}

/** A fence that cannot be closed early by backticks inside the source. */
const fence = (lang: string, text: string) => {
  const ticks = "`".repeat(Math.max(3, ...[...text.matchAll(/`{3,}/g)].map((m) => m[0].length + 1)));
  return `${ticks}${lang}\n${text.trimEnd()}\n${ticks}`;
};

const brief = {
  zh: (title: string) =>
    [
      `请复现下面这个网页效果「${title}」。`,
      "",
      "- 先照「参考实现」做出一个能直接双击打开的单文件页面，效果、动效节奏和交互细节都要对上；",
      "- 如果要放进现有项目，再按项目的技术栈（React / Vue / Astro…）和设计变量改写，颜色、字体换成项目自己的；",
      "- 保留：浅色 / 深色都能看、375px 宽不横向滚动、尊重 prefers-reduced-motion、键盘能操作；",
      "- 「坑」一节里的问题要避开。",
      "",
    ].join("\n"),
  en: (title: string) =>
    [
      `Please recreate the web UI effect "${title}" described below.`,
      "",
      "- First build it as a single HTML file that opens with a double-click, matching the look, the motion timing and the interaction details of the reference implementation;",
      "- To put it into an existing project, then port it to that project's stack (React / Vue / Astro…) and swap the colors and fonts for the project's own design tokens;",
      "- Keep: works in light and dark, no horizontal scroll at 375px wide, respects prefers-reduced-motion, usable from the keyboard;",
      "- Avoid the problems listed under the pitfalls section.",
      "",
    ].join("\n"),
};

/**
 * The entry as one Markdown document an agent can act on: what it is, why it works, how to use
 * it, and the full source. Served as /design/<slug>/index.md; the "copy for your agent" button
 * puts a short brief in front of it.
 */
export async function designMarkdown(entry: Design, withBrief = false) {
  const lang = langOf(entry);
  const slug = slugOf(entry);
  const d = entry.data;
  const abs = (p: string) => new URL(p, SITE_URL).href;
  const field = (k: string, v: string) => `${k}: ${JSON.stringify(v)}`;
  const header = [
    "---",
    field("title", d.title),
    field("summary", d.summary),
    field("category", `${d.category} (${categoryLabel[lang][d.category]})`),
    field("origin", d.origin),
    ...(d.inspiredBy ? [field("inspired_by", `${d.inspiredBy.name} ${d.inspiredBy.url}`)] : []),
    `stack: ${JSON.stringify(d.stack)}`,
    `tags: ${JSON.stringify(d.tags)}`,
    field("demo", abs(demoPath(slug))),
    field("url", abs(designUrl(lang, slug))),
    field("license", "MIT"),
    field("added", ymd(d.added)),
    field("translation", abs(`${designUrl(other(lang), slug)}index.md`)),
    "---",
  ].join("\n");
  const body = (entry.body ?? "").trim().replace(/\]\(\/(?!\/)/g, `](${SITE_URL}/`);
  const files = await demoFiles(entry);
  const sourceHead = lang === "zh" ? "## 参考实现（完整源码）" : "## Reference implementation (full source)";
  const sourceNote =
    lang === "zh"
      ? `在线演示：${abs(demoPath(slug))}。${files.length > 1 ? `共 ${files.length} 个文件，第一个是演示页本身。` : "单文件，存成 .html 就能打开。"}`
      : `Live demo: ${abs(demoPath(slug))}. ${files.length > 1 ? `${files.length} files; the first one is the demo page.` : "One file: save it as .html and open it."}`;
  const sources = files.map((f) => `### ${f.name}\n\n${fence(f.lang, f.text)}`).join("\n\n");
  const doc = `${header}\n\n# ${d.title}\n\n> ${d.summary}\n\n${body}\n\n${sourceHead}\n\n${sourceNote}\n\n${sources}\n`;
  return withBrief ? `${brief[lang](d.title)}\n${doc}` : doc;
}

/** /design/index.md: the catalogue, one line per entry, for agents browsing the library. */
export async function designCatalogue(lang: Lang) {
  const entries = await getDesigns(lang);
  const abs = (p: string) => new URL(p, SITE_URL).href;
  const intro =
    lang === "zh"
      ? "刘卓琪的设计灵感库：做过、觉得好看的网页 UI，每条都是一个能单独打开的 HTML 演示，按 MIT 开源。在条目地址后加 `index.md` 拿到说明和完整源码（例如 /design/<slug>/index.md），照着就能复现。"
      : "Liu ZhuoQi's design library: web UI pieces worth keeping, each a self-contained HTML demo under the MIT license. Append `index.md` to an entry URL for its notes and full source (e.g. /en/design/<slug>/index.md), enough to recreate it.";
  const lines = [`# ${lang === "zh" ? "设计灵感库" : "Design library"}`, "", intro, ""];
  for (const c of CATEGORIES) {
    const list = entries.filter((e) => e.data.category === c);
    if (!list.length) continue;
    lines.push(`## ${categoryLabel[lang][c]}`, "");
    for (const e of list) {
      const tag = e.data.origin === "recreated" ? ` (${originLabel[lang].recreated})` : "";
      lines.push(`- [${e.data.title}](${abs(designUrl(lang, slugOf(e)))}index.md)${tag} — ${e.data.summary}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
