import { other } from "../i18n";
import { imageUrl, langOf, plainMd, postImage, postUrl, type Post, slugOf, ymd } from "./content";
import { SITE_URL, site } from "../site";

async function replaceAsync(s: string, re: RegExp, fn: (...m: string[]) => Promise<string>) {
  const parts: Promise<string>[] = [];
  s.replace(re, (...m: string[]) => {
    parts.push(fn(...m));
    return "";
  });
  const done = await Promise.all(parts);
  let i = 0;
  return s.replace(re, () => done[i++]!);
}

/**
 * The article as an agent-friendly Markdown document: the original source, a small
 * front-matter header, absolute links, and images pointing at optimized copies.
 */
export async function postMarkdown(post: Post) {
  const lang = langOf(post);
  const slug = slugOf(post);
  const base = new URL(SITE_URL);
  let body = (post.body ?? "").trim();
  body = await replaceAsync(body, /(!\[[^\]]*\]\()(\.\/[^\s)]+)/g, async (whole, pre, path) => {
    const img = postImage(slug, path!);
    return img ? `${pre}${await imageUrl(img, 1600, base)}` : whole!;
  });
  body = body.replace(/\]\(\/(?!\/)/g, `](${SITE_URL}/`);

  const field = (k: string, v: string) => `${k}: ${JSON.stringify(v)}`;
  const header = [
    "---",
    field("title", post.data.title),
    field("description", post.data.description),
    field("url", new URL(postUrl(lang, slug), SITE_URL).href),
    field("language", lang === "zh" ? "zh-CN" : "en"),
    field("author", site[lang].author),
    field("date", ymd(post.data.date)),
    ...(post.data.updated ? [field("updated", ymd(post.data.updated))] : []),
    ...(post.data.series ? [field("series", post.data.series)] : []),
    `tags: ${JSON.stringify(post.data.tags)}`,
    field("translation", new URL(`${postUrl(other(lang), slug)}index.md`, SITE_URL).href),
    "---",
  ].join("\n");
  const lead = post.data.lead ? `\n> **TL;DR** ${plainMd(post.data.lead)}\n` : "";
  return `${header}\n\n# ${post.data.title}\n${lead}\n${body}\n`;
}
