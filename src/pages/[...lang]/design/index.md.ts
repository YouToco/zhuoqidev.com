import type { APIRoute } from "astro";
import { type Lang, langParams } from "../../../i18n";
import { designCatalogue } from "../../../lib/design";

export const getStaticPaths = langParams;

export const GET: APIRoute<{ lang: Lang }> = async ({ props }) =>
  new Response(await designCatalogue(props.lang), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
