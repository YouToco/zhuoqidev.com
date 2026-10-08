// Owner-only API behind `Authorization: Bearer <ADMIN_TOKEN>`, used by /admin/ and scripts/stats-cn.ts.
//   GET    /api/admin/stats?from=YYYY-MM-DD&to=YYYY-MM-DD   counts for a range of Beijing days
//   GET    /api/admin/notes?status=pending|approved          guestbook notes, newest first
//   POST   /api/admin/notes/<id>/approve                     put a note on the wall
//   DELETE /api/admin/notes/<id>                             delete a note
//   POST   /api/admin/ingest {day, line: "cn", rows}         replace a day of mainland crawler counts
import { beijingDay, CATEGORIES, type Category } from "../../../server/bots.ts";
import { isAdmin, json, readJson } from "../../../server/http.ts";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const onRequest: PagesFunction<Env, "path"> = async ({ request, env, params }) => {
  if (!(await isAdmin(request, env))) return json({ error: "unauthorized" }, 401);
  const path = ((params.path as string[] | undefined) ?? []).join("/");
  const url = new URL(request.url);
  const db = env.DB;
  const m = request.method;

  if (m === "GET" && path === "stats") {
    const to = url.searchParams.get("to") ?? beijingDay();
    const from = url.searchParams.get("from") ?? to;
    if (!DAY.test(from) || !DAY.test(to) || from > to) return json({ error: "bad-range" }, 400);
    const [crawlers, crawlerDays, places, viewDays, pending, cnLatest] = await db.batch([
      db.prepare(
        `SELECT line, bot, company, category, SUM(hits) AS hits FROM crawler_daily
         WHERE day BETWEEN ?1 AND ?2 GROUP BY line, bot ORDER BY hits DESC`,
      ).bind(from, to),
      db.prepare("SELECT day, line, SUM(hits) AS hits FROM crawler_daily WHERE day BETWEEN ?1 AND ?2 GROUP BY day, line ORDER BY day").bind(from, to),
      db.prepare(
        `SELECT country, region, city, SUM(views) AS views, SUM(visitors) AS visitors FROM visit_daily
         WHERE day BETWEEN ?1 AND ?2 GROUP BY country, region, city ORDER BY views DESC`,
      ).bind(from, to),
      db.prepare("SELECT day, SUM(views) AS views, SUM(visitors) AS visitors FROM visit_daily WHERE day BETWEEN ?1 AND ?2 GROUP BY day ORDER BY day").bind(from, to),
      db.prepare("SELECT COUNT(*) AS n FROM notes WHERE status = 'pending'"),
      db.prepare("SELECT MAX(day) AS day FROM crawler_daily WHERE line = 'cn'"),
    ]);
    return json({
      range: { from, to },
      categories: CATEGORIES,
      crawlers: crawlers!.results,
      crawlerDays: crawlerDays!.results,
      places: places!.results,
      viewDays: viewDays!.results,
      pending: (pending!.results[0] as { n: number } | undefined)?.n ?? 0,
      cnLatestDay: (cnLatest!.results[0] as { day: string | null } | undefined)?.day ?? null,
    });
  }

  if (m === "GET" && path === "notes") {
    const status = url.searchParams.get("status") === "approved" ? "approved" : "pending";
    const { results } = await db
      .prepare(
        `SELECT id, created_at, reviewed_at, name, body, color, lang, country, region, city FROM notes
         WHERE status = ?1 ORDER BY id DESC LIMIT 200`,
      )
      .bind(status)
      .all();
    return json({ notes: results });
  }

  const note = /^notes\/(\d+)(\/approve)?$/.exec(path);
  if (note && m === "POST" && note[2]) {
    const r = await db.prepare("UPDATE notes SET status = 'approved', reviewed_at = ?2 WHERE id = ?1").bind(Number(note[1]), new Date().toISOString()).run();
    return json({ changed: r.meta.changes });
  }
  if (note && m === "DELETE" && !note[2]) {
    const r = await db.prepare("DELETE FROM notes WHERE id = ?1").bind(Number(note[1])).run();
    return json({ changed: r.meta.changes });
  }

  if (m === "POST" && path === "ingest") {
    const body = (await readJson(request, 1 << 20)) as { day?: unknown; line?: unknown; rows?: unknown } | null;
    const rows = Array.isArray(body?.rows) ? (body.rows as Record<string, unknown>[]) : null;
    if (!body || typeof body.day !== "string" || !DAY.test(body.day) || body.line !== "cn" || !rows || rows.length > 2000) {
      return json({ error: "bad-request" }, 400);
    }
    const valid = rows.every(
      (r) =>
        typeof r.bot === "string" && r.bot.length <= 60 &&
        typeof r.company === "string" && r.company.length <= 60 &&
        typeof r.category === "string" && r.category in CATEGORIES &&
        Number.isInteger(r.hits) && (r.hits as number) > 0,
    );
    if (!valid) return json({ error: "bad-rows" }, 400);
    const day = body.day;
    await db.batch([
      db.prepare("DELETE FROM crawler_daily WHERE day = ?1 AND line = 'cn'").bind(day),
      ...rows.map((r) =>
        db
          .prepare("INSERT INTO crawler_daily (day, line, bot, company, category, hits) VALUES (?1, 'cn', ?2, ?3, ?4, ?5)")
          .bind(day, r.bot as string, r.company as string, r.category as Category, r.hits as number),
      ),
    ]);
    return json({ day, rows: rows.length, hits: rows.reduce((n, r) => n + (r.hits as number), 0) });
  }

  return json({ error: "not-found" }, 404);
};
