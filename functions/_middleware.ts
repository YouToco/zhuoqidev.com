// Runs before every page request on the overseas line (Cloudflare Pages) that public/_routes.json
// sends through Functions. Crawlers do not run the page's beacon, so they are counted here, from the
// User-Agent; people are counted by the beacon (functions/api/hit.ts). The page is served either way,
// marked with `Server-Timing: line;desc=cf` so its script knows which line it came from (the mainland
// line counts people from its own CDN logs instead; see src/components/Analytics.astro).
import { beijingDay, classify, isPageLike } from "../server/bots.ts";
import { recordCrawler } from "../server/stats.ts";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const { hostname, pathname, search } = new URL(request.url);
  const backend = /^\/(api|admin)(\/|$)/.test(pathname) || pathname === "/hot.json";
  // api.zhuoqidev.com is only there for the API, /admin/ and /hot.json (which the mainland copy is
  // fetched from); send its pages back to the site.
  if (hostname === "api.zhuoqidev.com" && !backend)
    return Response.redirect(`https://zhuoqidev.com${pathname}${search}`, 301);
  const page = (request.method === "GET" || request.method === "HEAD") && isPageLike(pathname) && !backend;
  try {
    if (page) {
      const crawler = classify(request.headers.get("User-Agent"));
      if (crawler) {
        context.waitUntil(
          recordCrawler(env.DB, beijingDay(), "cf", crawler).catch((e: unknown) => {
            console.error("crawler count failed", e);
          }),
        );
      }
    }
  } catch (e) {
    console.error("crawler count failed", e);
  }
  const res = await context.next();
  if (!page) return res;
  const marked = new Response(res.body, res);
  marked.headers.append("Server-Timing", "line;desc=cf");
  return marked;
};
