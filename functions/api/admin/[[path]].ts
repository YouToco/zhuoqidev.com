// Owner-only API behind `Authorization: Bearer <ADMIN_TOKEN>`, used by /admin/ and scripts/stats-cn.ts.
//   GET    /api/admin/stats?from=YYYY-MM-DD&to=YYYY-MM-DD   counts for a range of Beijing days
//   GET    /api/admin/health                                 whether the counting still works (server/health.ts)
//   GET    /api/admin/notes?status=pending|approved          guestbook notes, newest first
//   POST   /api/admin/notes/<id>/approve                     put a note on the wall
//   DELETE /api/admin/notes/<id>                             delete a note
//   POST   /api/admin/ingest {day, line: "cn", rows, visits?, pages?}
//                                                            replace a day of mainland crawler (visit, article) counts
import { beijingDay, CATEGORIES, type Category } from "../../../server/bots.ts";
import { health, type HealthData, WINDOWS } from "../../../server/health.ts";
import { isAdmin, json, readJson } from "../../../server/http.ts";
import { daysBefore, HOT_LIST, validPages } from "../../../server/pages.ts";
import { ALL_VISITS, validVisits } from "../../../server/stats.ts";

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
      db
        .prepare(
          `SELECT line, bot, company, category, SUM(hits) AS hits FROM crawler_daily
         WHERE day BETWEEN ?1 AND ?2 GROUP BY line, bot ORDER BY hits DESC`,
        )
        .bind(from, to),
      db
        .prepare(
          "SELECT day, line, SUM(hits) AS hits FROM crawler_daily WHERE day BETWEEN ?1 AND ?2 GROUP BY day, line ORDER BY day",
        )
        .bind(from, to),
      db
        .prepare(
          `SELECT country, region, city, SUM(views) AS views, SUM(visitors) AS visitors FROM ${ALL_VISITS}
         WHERE day BETWEEN ?1 AND ?2 GROUP BY country, region, city ORDER BY views DESC`,
        )
        .bind(from, to),
      db
        .prepare(
          `SELECT day, SUM(views) AS views, SUM(visitors) AS visitors FROM ${ALL_VISITS}
         WHERE day BETWEEN ?1 AND ?2 GROUP BY day ORDER BY day`,
        )
        .bind(from, to),
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

  if (m === "GET" && path === "health") {
    const today = beijingDay();
    const recent = daysBefore(today, Math.max(WINDOWS.cfCrawlers, WINDOWS.cfVisitors) - 1);
    const [cnVisits, cnCrawler, cfCrawlers, cfVisits] = await db.batch([
      // Aggregates without GROUP BY always answer one row: nulls when the table is empty.
      db.prepare(
        "SELECT MAX(day) AS day, SUM(visitors) AS visitors FROM visit_daily_cn WHERE day = (SELECT MAX(day) FROM visit_daily_cn)",
      ),
      db.prepare("SELECT MAX(day) AS day FROM crawler_daily WHERE line = 'cn'"),
      db
        .prepare("SELECT day, SUM(hits) AS n FROM crawler_daily WHERE line = 'cf' AND day >= ?1 GROUP BY day")
        .bind(recent),
      db.prepare("SELECT day, SUM(visitors) AS n FROM visit_daily WHERE day >= ?1 GROUP BY day").bind(recent),
    ]);
    // page_daily comes from a later migration: read it on its own, so a missing table is reported
    // as a failed check instead of failing the whole answer.
    let pages: HealthData["pages"];
    let hotRows: HealthData["hotRows"] = [];
    try {
      const [latest, hot] = await db.batch([
        db.prepare("SELECT line, MAX(day) AS day FROM page_daily GROUP BY line"),
        db
          .prepare(
            "SELECT day, slug, SUM(visitors) AS visitors FROM page_daily WHERE day BETWEEN ?1 AND ?2 GROUP BY day, slug",
          )
          .bind(daysBefore(today, HOT_LIST.days - 1), today),
      ]);
      const byLine = new Map((latest!.results as { line: string; day: string }[]).map((r) => [r.line, r.day]));
      pages = { cn: byLine.get("cn") ?? null, cf: byLine.get("cf") ?? null };
      hotRows = hot!.results as HealthData["hotRows"];
    } catch (e) {
      pages = { error: e instanceof Error ? e.message : String(e) };
    }
    const cn = cnVisits!.results[0] as { day: string | null; visitors: number | null } | undefined;
    const data: HealthData = {
      cnVisits: { day: cn?.day ?? null, visitors: cn?.visitors ?? null },
      cnCrawlerDay: (cnCrawler!.results[0] as { day: string | null } | undefined)?.day ?? null,
      cfCrawlers: cfCrawlers!.results as HealthData["cfCrawlers"],
      cfVisits: cfVisits!.results as HealthData["cfVisits"],
      pages,
      hotRows,
    };
    return json(health(data, today), 200, { "Cache-Control": "no-store" });
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
    const r = await db
      .prepare("UPDATE notes SET status = 'approved', reviewed_at = ?2 WHERE id = ?1")
      .bind(Number(note[1]), new Date().toISOString())
      .run();
    return json({ changed: r.meta.changes });
  }
  if (note && m === "DELETE" && !note[2]) {
    const r = await db.prepare("DELETE FROM notes WHERE id = ?1").bind(Number(note[1])).run();
    return json({ changed: r.meta.changes });
  }

  if (m === "POST" && path === "ingest") {
    const body = (await readJson(request, 1 << 20)) as {
      day?: unknown;
      line?: unknown;
      rows?: unknown;
      visits?: unknown;
      pages?: unknown;
    } | null;
    const rows = Array.isArray(body?.rows) ? (body.rows as Record<string, unknown>[]) : null;
    // Older callers send crawlers only (or no articles); then the day's visits (articles) are left alone.
    const visits = body?.visits === undefined ? undefined : validVisits(body.visits);
    const pages = body?.pages === undefined ? undefined : validPages(body.pages);
    if (
      !body ||
      typeof body.day !== "string" ||
      !DAY.test(body.day) ||
      body.line !== "cn" ||
      !rows ||
      rows.length > 2000
    ) {
      return json({ error: "bad-request" }, 400);
    }
    const valid = rows.every(
      (r) =>
        typeof r.bot === "string" &&
        r.bot.length <= 60 &&
        typeof r.company === "string" &&
        r.company.length <= 60 &&
        typeof r.category === "string" &&
        r.category in CATEGORIES &&
        Number.isInteger(r.hits) &&
        (r.hits as number) > 0,
    );
    if (!valid || visits === null || pages === null) return json({ error: "bad-rows" }, 400);
    const day = body.day;
    await db.batch([
      ...(visits
        ? [
            db.prepare("DELETE FROM visit_daily_cn WHERE day = ?1").bind(day),
            ...visits.map((v) =>
              db
                .prepare(
                  "INSERT INTO visit_daily_cn (day, country, region, city, views, visitors) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                )
                .bind(day, v.country, v.region, v.city, v.views, v.visitors),
            ),
          ]
        : []),
      ...(pages
        ? [
            db.prepare("DELETE FROM page_daily WHERE day = ?1 AND line = 'cn'").bind(day),
            ...pages.map((p) =>
              db
                .prepare("INSERT INTO page_daily (day, line, slug, views, visitors) VALUES (?1, 'cn', ?2, ?3, ?4)")
                .bind(day, p.slug, p.views, p.visitors),
            ),
          ]
        : []),
      db.prepare("DELETE FROM crawler_daily WHERE day = ?1 AND line = 'cn'").bind(day),
      ...rows.map((r) =>
        db
          .prepare(
            "INSERT INTO crawler_daily (day, line, bot, company, category, hits) VALUES (?1, 'cn', ?2, ?3, ?4, ?5)",
          )
          .bind(day, r.bot as string, r.company as string, r.category as Category, r.hits as number),
      ),
    ]);
    return json({
      day,
      rows: rows.length,
      hits: rows.reduce((n, r) => n + (r.hits as number), 0),
      ...(visits && { places: visits.length, visitors: visits.reduce((n, v) => n + v.visitors, 0) }),
      ...(pages && { articles: pages.length }),
    });
  }

  return json({ error: "not-found" }, 404);
};
