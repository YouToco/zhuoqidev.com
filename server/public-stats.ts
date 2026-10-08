// The public side of the counts, for the visitor map (/visitors/): visitors by country and, in China,
// by province; crawlers by category and by name. Cities, guestbook notes and anything per visitor
// stay on /admin/.
import { beijingDay, CATEGORIES, type Category } from "./bots.ts";
import { provinceOf } from "./regions.ts";

export const RANGES = { "7": 7, "30": 30, all: 0 } as const;
export type RangeKey = keyof typeof RANGES;

type Visits = { views: number; visitors: number };
export type VisitRow = { country: string; region: string } & Visits;
export type CrawlerRow = { bot: string; company: string; category: string; line: string; hits: number };
export type DayRow = { day: string; views: number; visitors: number; crawlers: number };

export type PublicStats = {
  range: { key: RangeKey; from: string; to: string };
  since: string | null;
  cnLatestDay: string | null;
  totals: Visits & { countries: number; crawlers: number };
  countries: ({ code: string } & Visits)[];
  provinces: ({ adcode: number } & Visits)[];
  /** Visitors from China whose province is unknown. */
  chinaElsewhere: Visits;
  crawlers: {
    categories: { key: Category; hits: number }[];
    bots: { bot: string; company: string; category: string; cf: number; cn: number }[];
    /** Hits from crawlers past the top of the list. */
    rest: number;
  };
  days: DayRow[];
};

const TOP_BOTS = 20;

export function rangeFor(key: string | null, today = beijingDay()): PublicStats["range"] {
  const k: RangeKey = key && key in RANGES ? (key as RangeKey) : "30";
  const n = RANGES[k];
  const from = n ? beijingDay(new Date(Date.parse(`${today}T12:00:00+08:00`) - (n - 1) * 86_400_000)) : "2000-01-01";
  return { key: k, from, to: today };
}

/** Shapes the query results; pure, so it can be tested without a database. */
export function shape(input: {
  range: PublicStats["range"];
  since: string | null;
  cnLatestDay: string | null;
  visits: VisitRow[];
  crawlers: CrawlerRow[];
  days: DayRow[];
}): PublicStats {
  const add = (to: Visits, r: Visits) => {
    to.views += r.views;
    to.visitors += r.visitors;
  };
  const countries = new Map<string, Visits>();
  const provinces = new Map<number, Visits>();
  const chinaElsewhere = { views: 0, visitors: 0 };
  const totals = { views: 0, visitors: 0 };
  for (const r of input.visits) {
    add(totals, r);
    if (!countries.has(r.country)) countries.set(r.country, { views: 0, visitors: 0 });
    add(countries.get(r.country)!, r);
    const p = provinceOf(r.country, r.region);
    if (p) {
      if (!provinces.has(p.adcode)) provinces.set(p.adcode, { views: 0, visitors: 0 });
      add(provinces.get(p.adcode)!, r);
    } else if (r.country === "CN") add(chinaElsewhere, r);
  }

  const byBot = new Map<string, PublicStats["crawlers"]["bots"][number]>();
  const byCategory = new Map<string, number>();
  let crawlerHits = 0;
  for (const r of input.crawlers) {
    crawlerHits += r.hits;
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.hits);
    const b = byBot.get(r.bot) ?? { bot: r.bot, company: r.company, category: r.category, cf: 0, cn: 0 };
    if (r.line === "cn") b.cn += r.hits;
    else b.cf += r.hits;
    byBot.set(r.bot, b);
  }
  const bots = [...byBot.values()].sort((a, b) => b.cf + b.cn - (a.cf + a.cn) || a.bot.localeCompare(b.bot));
  const top = bots.slice(0, TOP_BOTS);
  const byVisitors = <T extends Visits>(a: T, b: T) => b.visitors - a.visitors || b.views - a.views;

  return {
    range: input.range,
    since: input.since,
    cnLatestDay: input.cnLatestDay,
    totals: {
      ...totals,
      countries: [...countries.keys()].filter((c) => c !== "XX").length,
      crawlers: crawlerHits,
    },
    countries: [...countries].map(([code, v]) => ({ code, ...v })).sort(byVisitors),
    provinces: [...provinces].map(([adcode, v]) => ({ adcode, ...v })).sort(byVisitors),
    chinaElsewhere,
    crawlers: {
      categories: (Object.keys(CATEGORIES) as Category[])
        .map((key) => ({ key, hits: byCategory.get(key) ?? 0 }))
        .filter((c) => c.hits > 0)
        .sort((a, b) => b.hits - a.hits),
      bots: top,
      rest: crawlerHits - top.reduce((s, b) => s + b.cf + b.cn, 0),
    },
    days: input.days,
  };
}

export async function publicStats(db: D1Database, range: PublicStats["range"]): Promise<PublicStats> {
  const { from, to } = range;
  const [visits, crawlers, viewDays, crawlerDays, since, cnLatest] = await db.batch<Record<string, unknown>>([
    db.prepare(
      `SELECT country, region, SUM(views) AS views, SUM(visitors) AS visitors FROM visit_daily
       WHERE day BETWEEN ?1 AND ?2 GROUP BY country, region`,
    ).bind(from, to),
    db.prepare(
      `SELECT bot, MAX(company) AS company, MAX(category) AS category, line, SUM(hits) AS hits FROM crawler_daily
       WHERE day BETWEEN ?1 AND ?2 GROUP BY bot, line`,
    ).bind(from, to),
    db.prepare("SELECT day, SUM(views) AS views, SUM(visitors) AS visitors FROM visit_daily WHERE day BETWEEN ?1 AND ?2 GROUP BY day").bind(from, to),
    db.prepare("SELECT day, SUM(hits) AS hits FROM crawler_daily WHERE day BETWEEN ?1 AND ?2 GROUP BY day").bind(from, to),
    db.prepare("SELECT MIN(day) AS day FROM (SELECT MIN(day) AS day FROM visit_daily UNION ALL SELECT MIN(day) FROM crawler_daily)"),
    db.prepare("SELECT MAX(day) AS day FROM crawler_daily WHERE line = 'cn'"),
  ]);
  const days = new Map<string, DayRow>();
  const day = (d: string) => days.get(d) ?? days.set(d, { day: d, views: 0, visitors: 0, crawlers: 0 }).get(d)!;
  for (const r of viewDays!.results as { day: string; views: number; visitors: number }[]) Object.assign(day(r.day), { views: r.views, visitors: r.visitors });
  for (const r of crawlerDays!.results as { day: string; hits: number }[]) day(r.day).crawlers = r.hits;
  return shape({
    range,
    since: (since!.results[0] as { day: string | null } | undefined)?.day ?? null,
    cnLatestDay: (cnLatest!.results[0] as { day: string | null } | undefined)?.day ?? null,
    visits: visits!.results as VisitRow[],
    crawlers: crawlers!.results as CrawlerRow[],
    days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
  });
}
