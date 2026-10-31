// GET /hot.json: the articles with the most visitors over the last 30 Beijing days, both hosting
// lines summed (page_daily, migrations/0003), as {"updated": "<ISO time>", "slugs": [...]}. Only the
// order goes out, never a count. Pages on the overseas line fetch it from here; the mainland line
// serves a copy that .github/workflows/stats-cn.yml (and every deploy) puts on Aliyun OSS. Every
// reader asks the same question, so the answer is kept in Cloudflare's cache for an hour.
import { beijingDay } from "../server/bots.ts";
import { json } from "../server/http.ts";
import { daysBefore, hotSlugs } from "../server/pages.ts";

const MAX_AGE = 3600;
const DAYS = 30;

export const onRequestGet: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const today = beijingDay();
  // One cache entry per day, whatever else the request carries.
  const key = new Request(`${new URL(request.url).origin}/hot.json?day=${today}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit;
  let slugs: string[];
  try {
    const { results } = await env.DB.prepare(
      `SELECT day, slug, SUM(visitors) AS visitors FROM page_daily
       WHERE day BETWEEN ?1 AND ?2 GROUP BY day, slug`,
    )
      .bind(daysBefore(today, DAYS - 1), today)
      .all<{ day: string; slug: string; visitors: number }>();
    slugs = hotSlugs(results, today, { days: DAYS });
  } catch (e) {
    // Pages keep their static lists when this fails; nothing is cached.
    console.error("hot list failed", e);
    return json({ updated: null, slugs: [] }, 503);
  }
  const res = json({ updated: new Date().toISOString(), slugs }, 200, {
    "Cache-Control": `public, max-age=${MAX_AGE}`,
  });
  waitUntil(cache.put(key, res.clone()));
  return res;
};
