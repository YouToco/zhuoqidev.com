// Runs before every page request on the overseas line (Cloudflare Pages) that public/_routes.json
// sends through Functions. Crawlers do not run the page's beacon, so they are counted here, from the
// User-Agent; people are counted by the beacon (functions/api/hit.ts). The page is served either way.
import { beijingDay, classify, isPageLike } from "../server/bots.ts";
import { recordCrawler } from "../server/stats.ts";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const { hostname, pathname, search } = new URL(request.url);
  const backend = /^\/(api|admin)(\/|$)/.test(pathname);
  // api.zhuoqidev.com is only there for the API and /admin/; send its pages back to the site.
  if (hostname === "api.zhuoqidev.com" && !backend) return Response.redirect(`https://zhuoqidev.com${pathname}${search}`, 301);
  try {
    if ((request.method === "GET" || request.method === "HEAD") && isPageLike(pathname) && !backend) {
      const crawler = classify(request.headers.get("User-Agent"));
      if (crawler) {
        context.waitUntil(recordCrawler(env.DB, beijingDay(), "cf", crawler).catch((e) => console.error("crawler count failed", e)));
      }
    }
  } catch (e) {
    console.error("crawler count failed", e);
  }
  return context.next();
};
