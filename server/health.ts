// Whether the site's own counting still works, as GET /api/admin/health answers it
// (functions/api/admin/[[path]].ts). There are no notifications: an agent or the owner asks this,
// and the daily stats-cn.yml run prints it in its summary. Dependency-free and pure, so it is tested
// with plain rows; the Function only runs the queries.
import { daysBefore, HOT_LIST, hotSlugs } from "./pages.ts";

/** Per-article counts (page_daily, migrations/0003) started on this Beijing day. */
export const PAGE_COUNTS_SINCE = "2026-10-31";

/** How many Beijing days back (today included) each check looks. */
export const WINDOWS = {
  /** The mainland import runs once a day (stats-cn.yml, 09:23 Beijing, often later) for the day before. */
  cnImport: 2,
  /** Overseas crawlers hit the site every hour; today and yesterday together are never empty. */
  cfCrawlers: 2,
  /** Overseas readers are a few a day, so three days keep a quiet day from raising an alarm. */
  cfVisitors: 3,
} as const;

export type DayValue = { day: string; n: number };

export type HealthData = {
  /** Latest day in visit_daily_cn and the visitors on it (both null when the table is empty). */
  cnVisits: { day: string | null; visitors: number | null };
  /** Latest day in crawler_daily on line 'cn'. */
  cnCrawlerDay: string | null;
  /** crawler_daily hits on line 'cf' per recent day. */
  cfCrawlers: DayValue[];
  /** visit_daily visitors per recent day. */
  cfVisits: DayValue[];
  /** Latest day in page_daily per line, or the error when page_daily could not be read. */
  pages: { cn: string | null; cf: string | null } | { error: string };
  /** page_daily visitors per day and slug over the hot list's window (the /hot.json query). */
  hotRows: { day: string; slug: string; visitors: number }[];
};

export type Check = { name: string; ok: boolean; detail: string };
export type Health = { checkedAt: string; ok: boolean; checks: Check[] };

/** Checks that only report and never make the whole answer not ok. */
const INFORMATIONAL = new Set(["hot"]);

const sumSince = (rows: DayValue[], from: string, today: string) =>
  rows.reduce((n, r) => (r.day >= from && r.day <= today ? n + r.n : n), 0);

/** The health answer for Beijing day `today` from the query results in `data`. */
export function health(data: HealthData, today: string, checkedAt = new Date().toISOString()): Health {
  const checks: Check[] = [];

  const cnFrom = daysBefore(today, WINDOWS.cnImport);
  const visitDay = data.cnVisits.day;
  const crawlerDay = data.cnCrawlerDay;
  checks.push({
    name: "cn-import",
    ok: visitDay !== null && visitDay >= cnFrom && crawlerDay !== null && crawlerDay >= cnFrom,
    detail:
      `latest visit_daily_cn day ${visitDay ?? "none"}, latest crawler_daily cn day ${crawlerDay ?? "none"}; ` +
      `both must be ${cnFrom} or later (the import runs once a day, Beijing morning or later, for the day before)`,
  });

  const cnVisitors = data.cnVisits.visitors ?? 0;
  checks.push({
    name: "cn-visitors",
    ok: visitDay !== null && cnVisitors > 0,
    detail: visitDay === null ? "visit_daily_cn is empty" : `${cnVisitors} mainland visitors on ${visitDay}`,
  });

  const crawlerFrom = daysBefore(today, WINDOWS.cfCrawlers - 1);
  const cfHits = sumSince(data.cfCrawlers, crawlerFrom, today);
  checks.push({
    name: "cf-crawlers",
    ok: cfHits > 0,
    detail: `${cfHits} overseas crawler hits from ${crawlerFrom} to ${today}`,
  });

  const visitFrom = daysBefore(today, WINDOWS.cfVisitors - 1);
  const cfVisitors = sumSince(data.cfVisits, visitFrom, today);
  checks.push({
    name: "cf-visitors",
    ok: cfVisitors > 0,
    detail: `${cfVisitors} overseas visitors (visit_daily) from ${visitFrom} to ${today}`,
  });

  checks.push(pageCounts(data.pages, today));

  const hot = hotSlugs(data.hotRows, today, HOT_LIST);
  const hotFrom = daysBefore(today, HOT_LIST.days - 1);
  const covered = new Set(
    data.hotRows.filter((r) => r.day >= hotFrom && r.day <= today && r.visitors > 0).map((r) => r.day),
  ).size;
  checks.push({
    name: "hot",
    ok: true,
    detail:
      `informational: /hot.json would list ${hot.length} articles; counts cover ${covered} of the ` +
      `${HOT_LIST.minDays} days it needs` +
      (covered >= HOT_LIST.minDays ? "" : ", so the list stays empty and pages keep their built cards"),
  });

  return { checkedAt, ok: checks.every((c) => c.ok || INFORMATIONAL.has(c.name)), checks };
}

function pageCounts(pages: HealthData["pages"], today: string): Check {
  if ("error" in pages)
    return {
      name: "page-counts",
      ok: false,
      detail: `page_daily could not be read (is migration 0003 applied?): ${pages.error}`,
    };
  const parts: string[] = [];
  let ok = true;
  for (const [line, days] of [
    ["cn", WINDOWS.cnImport],
    ["cf", WINDOWS.cfVisitors - 1],
  ] as const) {
    const from = daysBefore(today, days);
    const latest = pages[line];
    if (latest === null) {
      // Counting started on PAGE_COUNTS_SINCE; until a line had time to land its first day, no rows is expected.
      const due = from >= PAGE_COUNTS_SINCE;
      if (due) ok = false;
      parts.push(
        `${line}: no data yet (per-article counts started ${PAGE_COUNTS_SINCE}${due ? "" : ", none expected yet"})`,
      );
    } else {
      if (latest < from) ok = false;
      parts.push(`${line}: latest ${latest}, must be ${from} or later`);
    }
  }
  return { name: "page-counts", ok, detail: parts.join("; ") };
}
