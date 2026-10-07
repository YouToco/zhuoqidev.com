import type { APIRoute } from "astro";
import { LANGS } from "../i18n";
import { sitemap } from "../lib/sitemap";

export const GET: APIRoute = () => sitemap(LANGS);
