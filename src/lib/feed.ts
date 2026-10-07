import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { render } from "astro:content";
import { htmlLang, type Lang, url } from "../i18n";
import { SITE_URL, site } from "../site";
import { getPosts, postUrl, slugOf } from "./content";

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

/** Rendered article HTML made self-contained for feed readers: absolute links, single image source. */
function feedHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/\s(?:srcset|sizes)="[^"]*"/g, "")
    .replace(/\s(href|src)="\/(?!\/)/g, ` $1="${SITE_URL}/`);
}

/** Full-text RSS 2.0 for one language. */
export async function rss(lang: Lang, selfPath: string) {
  const posts = await getPosts(lang);
  const container = await AstroContainer.create();
  const items: string[] = [];
  for (const post of posts) {
    const link = new URL(postUrl(lang, slugOf(post)), SITE_URL).href;
    const { Content } = await render(post);
    const body = feedHtml(await container.renderToString(Content));
    items.push(
      [
        "<item>",
        `<title>${xml(post.data.title)}</title>`,
        `<link>${link}</link>`,
        `<guid isPermaLink="true">${link}</guid>`,
        `<pubDate>${post.data.date.toUTCString()}</pubDate>`,
        `<description>${xml(post.data.description)}</description>`,
        ...post.data.tags.map((tag) => `<category>${xml(tag)}</category>`),
        `<content:encoded>${cdata(body)}</content:encoded>`,
        "</item>",
      ].join("\n"),
    );
  }
  const s = site[lang];
  const home = new URL(url(lang, "/"), SITE_URL).href;
  const body = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
<title>${xml(s.title)}</title>
<link>${home}</link>
<description>${xml(s.description)}</description>
<language>${htmlLang[lang]}</language>
<copyright>© 2026 ${xml(s.author)}</copyright>
<lastBuildDate>${(posts[0]?.data.updated ?? posts[0]?.data.date ?? new Date()).toUTCString()}</lastBuildDate>
<atom:link href="${new URL(selfPath, SITE_URL).href}" rel="self" type="application/rss+xml"/>
${items.join("\n")}
</channel>
</rss>
`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
