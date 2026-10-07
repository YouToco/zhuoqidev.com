import type { APIRoute } from "astro";
import { LANGS } from "../../../../i18n";
import { getPosts, type Post, slugOf } from "../../../../lib/content";
import { postMarkdown } from "../../../../lib/markdown-export";

export async function getStaticPaths() {
  const out = [];
  for (const lang of LANGS) {
    for (const post of await getPosts(lang)) {
      out.push({ params: { lang: lang === "zh" ? undefined : "en", slug: slugOf(post) }, props: { post } });
    }
  }
  return out;
}

export const GET: APIRoute<{ post: Post }> = async ({ props }) =>
  new Response(await postMarkdown(props.post), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
