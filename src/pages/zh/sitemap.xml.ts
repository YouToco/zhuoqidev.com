import type { APIRoute } from "astro";
import { sitemap } from "../../lib/sitemap";

// Per-language sitemaps existed on the Hugo site at /zh/ and /en/; kept for search consoles.
export const GET: APIRoute = () => sitemap(["zh"]);
