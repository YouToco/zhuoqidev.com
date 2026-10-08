// Public counts for the visitor map (/visitors/): GET /api/stats?range=7|30|all. Every reader of the
// page asks for the same few answers, so each one is kept in Cloudflare's cache for five minutes and
// the database is read at most once per range per five minutes per data centre.
import { json } from "../../server/http.ts";
import { publicStats, rangeFor } from "../../server/public-stats.ts";

const MAX_AGE = 300;

export const onRequestGet: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const url = new URL(request.url);
  const range = rangeFor(url.searchParams.get("range"));
  // One cache entry per range and day, whatever else the request carries.
  const key = new Request(`${url.origin}/api/stats?range=${range.key}&to=${range.to}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = json({ ...(await publicStats(env.DB, range)), updated: new Date().toISOString() }, 200, {
    "Cache-Control": `public, max-age=${MAX_AGE}`,
  });
  waitUntil(cache.put(key, res.clone()));
  return res;
};
