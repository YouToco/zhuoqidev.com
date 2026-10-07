import { type Lang, url } from "../i18n";
import { SITE_URL, site } from "../site";
import { getPosts, getProjects, postUrl, slugOf, ymd } from "./content";
import { postMarkdown } from "./markdown-export";

const abs = (path: string) => new URL(path, SITE_URL).href;

const intro = {
  zh: "本站是刘卓琪的技术博客，聚焦 AI Agent、记忆系统、上下文工程、RAG、工具调用、后端架构与生产实践。每篇文章都有中英两版，并在文章地址后加 `index.md` 提供 Markdown 原文（例如 /posts/<slug>/index.md）。下面按发布时间倒序列出。",
  en: "This is Liu ZhuoQi's technical blog about AI agents, memory systems, context engineering, RAG, tool use, backend architecture and production practice. Every post exists in English and Chinese, and appending `index.md` to a post URL returns its Markdown source (e.g. /en/posts/<slug>/index.md). Posts are listed newest first.",
} as const;

/** https://llmstxt.org/ — an index of Markdown versions for agents. */
export async function llmsTxt(lang: Lang) {
  const s = site[lang];
  const posts = await getPosts(lang);
  const projects = await getProjects(lang);
  const lines = [
    `# ${s.title}`,
    "",
    `> ${s.description}`,
    "",
    intro[lang],
    "",
    lang === "zh" ? "## 文章" : "## Posts",
    "",
    ...posts.map((p) => `- [${p.data.title}](${abs(postUrl(lang, slugOf(p)))}index.md): ${ymd(p.data.date)} · ${p.data.description}`),
    "",
    lang === "zh" ? "## 作品" : "## Projects",
    "",
    ...projects.map((p) => `- [${p.data.title}](${abs(url(lang, `/projects/${slugOf(p)}/`))}): ${p.data.description}`),
    "",
    "## Optional",
    "",
    `- [${lang === "zh" ? "全部文章全文" : "All posts, full text"}](${abs(url(lang, "/llms-full.txt"))})`,
    `- [${lang === "zh" ? "关于作者" : "About the author"}](${abs(url(lang, "/about/"))})`,
    `- [${lang === "zh" ? "English version" : "中文版"}](${abs(url(lang === "zh" ? "en" : "zh", "/llms.txt"))})`,
    `- [RSS](${abs(url(lang, "/index.xml"))})`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function llmsFullTxt(lang: Lang) {
  const posts = await getPosts(lang);
  const parts = [`# ${site[lang].title}\n\n> ${site[lang].description}\n`];
  for (const post of posts) parts.push(await postMarkdown(post));
  return new Response(parts.join("\n\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
