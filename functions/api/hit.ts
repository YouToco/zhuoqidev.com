// The page-view beacon (src/components/Analytics.astro): one POST per page a person opens, carrying
// the page's path as `?p=` so articles are counted too (server/pages.ts keeps only the slug).
import { classify } from "../../server/bots.ts";
import { siteOrigin } from "../../server/http.ts";
import { recordView } from "../../server/stats.ts";

export const onRequestPost: PagesFunction<Env> = ({ request, env, waitUntil }) => {
  // Only the blog's own pages count; crawlers that run scripts are already counted as crawlers.
  if (siteOrigin(request) && !classify(request.headers.get("User-Agent"))) {
    waitUntil(
      recordView(env.DB, request, new URL(request.url).searchParams.get("p")).catch((e: unknown) => {
        console.error("view count failed", e);
      }),
    );
  }
  return new Response(null, { status: 204 });
};
