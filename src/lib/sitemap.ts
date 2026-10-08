import { type Lang, LANGS, other, url } from "../i18n";
import { SITE_URL } from "../site";
import { getPosts, getProjects, slugOf, ymd } from "./content";
import { TAXES, termsOf } from "./taxonomy";

type Entry = { path: string; lastmod?: string | undefined; alt: boolean };

async function entries(lang: Lang): Promise<Entry[]> {
  const posts = await getPosts(lang);
  const newest = posts[0] ? ymd(posts[0].data.updated ?? posts[0].data.date) : undefined;
  const otherTerms = Object.fromEntries(
    await Promise.all(TAXES.map(async (tax) => [tax, new Set((await termsOf(other(lang), tax)).map((x) => x.slug))] as const)),
  );
  const list: Entry[] = [
    { path: "/", lastmod: newest, alt: true },
    { path: "/posts/", lastmod: newest, alt: true },
    { path: "/about/", alt: true },
    { path: "/projects/", alt: true },
    { path: "/guestbook/", alt: true },
    { path: "/visitors/", alt: true },
    { path: "/privacy/", alt: true },
    ...posts.map((p) => ({ path: `/posts/${slugOf(p)}/`, lastmod: ymd(p.data.updated ?? p.data.date), alt: true })),
    ...(await getProjects(lang)).map((p) => ({ path: `/projects/${slugOf(p)}/`, alt: true })),
  ];
  for (const tax of TAXES) {
    list.push({ path: `/${tax}/`, alt: true });
    for (const term of await termsOf(lang, tax)) {
      list.push({ path: `/${tax}/${term.slug}/`, alt: otherTerms[tax]!.has(term.slug) });
    }
  }
  return list;
}

function urlXml(lang: Lang, e: Entry) {
  const loc = new URL(url(lang, e.path), SITE_URL).href;
  const alts = e.alt
    ? LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l === "zh" ? "zh-CN" : "en"}" href="${new URL(url(l, e.path), SITE_URL).href}"/>`).join("")
    : "";
  return `<url><loc>${loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}${alts}</url>`;
}

export async function sitemap(langs: readonly Lang[]) {
  const urls: string[] = [];
  for (const lang of langs) for (const e of await entries(lang)) urls.push(urlXml(lang, e));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
