// The same document as index.md with a short "please recreate this" brief in front: what the copy button copies.
import type { APIRoute } from "astro";
import { LANGS } from "../../../../i18n";
import { slugOf } from "../../../../lib/content";
import { type Design, designMarkdown, getDesigns } from "../../../../lib/design";

export async function getStaticPaths() {
  const out = [];
  for (const lang of LANGS) {
    for (const entry of await getDesigns(lang)) {
      out.push({ params: { lang: lang === "zh" ? undefined : "en", slug: slugOf(entry) }, props: { entry } });
    }
  }
  return out;
}

export const GET: APIRoute<{ entry: Design }> = async ({ props }) =>
  new Response(await designMarkdown(props.entry, true), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
