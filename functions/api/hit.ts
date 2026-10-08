// The page-view beacon (src/components/Analytics.astro): one POST per page a person opens.
import { classify } from "../../server/bots.ts";
import { siteOrigin } from "../../server/http.ts";
import { recordView } from "../../server/stats.ts";

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  // Only the blog's own pages count; crawlers that run scripts are already counted as crawlers.
  if (siteOrigin(request) && !classify(request.headers.get("User-Agent"))) {
    waitUntil(recordView(env.DB, request).catch((e) => console.error("view count failed", e)));
  }
  return new Response(null, { status: 204 });
};
