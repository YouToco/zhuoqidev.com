import type { APIRoute } from "astro";
import { type Lang, langParams, url } from "../../i18n";
import { rss } from "../../lib/feed";

export const getStaticPaths = langParams;
export const GET: APIRoute<{ lang: Lang }> = ({ props }) => rss(props.lang, url(props.lang, "/index.xml"));
