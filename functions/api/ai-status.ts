// What the AI vendors' status pages say right now, for /status/: GET /api/ai-status. Every reader
// asks for the same answer, so it is kept in Cloudflare's cache for a minute and the vendors' pages
// are read at most once a minute per data centre.
import { allStatus } from "../../server/ai-status.ts";
import { json } from "../../server/http.ts";

const MAX_AGE = 60;

export const onRequestGet: PagesFunction<Env> = async ({ request, waitUntil }) => {
  const key = new Request(`${new URL(request.url).origin}/api/ai-status`);
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = json(await allStatus(), 200, { "Cache-Control": `public, max-age=${MAX_AGE}` });
  waitUntil(cache.put(key, res.clone()));
  return res;
};
