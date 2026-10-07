import type { APIRoute } from "astro";
import { type Lang, langParams } from "../../i18n";
import { llmsTxt } from "../../lib/llms";

export const getStaticPaths = langParams;
export const GET: APIRoute<{ lang: Lang }> = ({ props }) => llmsTxt(props.lang);
