import type { APIRoute } from "astro";
import { type Lang, langParams, url } from "../../../i18n";
import { rss } from "../../../lib/feed";

// Same feed as /index.xml; this URL existed on the Hugo site and may have subscribers.
export const getStaticPaths = langParams;
export const GET: APIRoute<{ lang: Lang }> = ({ props }) => rss(props.lang, url(props.lang, "/posts/index.xml"));
