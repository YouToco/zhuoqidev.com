// Counts for the mainland line. Readers in China are served by Aliyun CDN, which never runs our Pages
// Functions, so the overseas middleware cannot see Baiduspider and friends, and a beacon sent across
// the border to api.zhuoqidev.com is often lost. Aliyun publishes an hourly access log per domain
// (kept 30 days, a few hours late). This script reads one Beijing day of those logs and counts
//   - crawlers: page requests, classified with the same rules as the middleware;
//   - people: requests for /hit.gif, which pages served by this line fetch once they have loaded
//     (src/components/Analytics.astro), placed by IP with ip2region (scripts/ip2region.ts). A signal
//     counts only when the same IP and browser also fetched something else that day (the page, a
//     script, a font): crawlers that run scripts from a pool of addresses fetch the page from one IP and
//     the signal from another, and showed up as one-view "readers" (2026-10-18, see corroborated());
//   - articles: the same signals by the article in their Referer (the page that fetched /hit.gif),
//     for the "popular lately" lists (aggregatePages());
// then replaces that day's mainland rows in the stats database. Only counts per crawler, per place
// and per article leave this process; visitor IPs never do.
//
//   node scripts/stats-cn.ts --day 2026-10-07 [--dry-run]
//   node scripts/stats-cn.ts --logs <dir of .gz files> --day 2026-10-07 --dry-run
//
// Needs the aliyun CLI (ALIYUN_BIN, default "aliyun") with a profile allowed to call
// cdn:DescribeCdnDomainLogs, the two ip2region xdb files in IP2REGION_DIR (without them only
// crawlers are counted, and only with --dry-run), and STATS_ADMIN_TOKEN (plus STATS_API) unless --dry-run.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { gunzipSync } from "node:zlib";
import { beijingDay, type Crawler, classify, isPageLike } from "../server/bots.ts";
import { type PageCount, slugOf } from "../server/pages.ts";
import { openIp2region, type Place } from "./ip2region.ts";

const DOMAINS = ["zhuoqidev.com", "www.zhuoqidev.com"];

// [7/Oct/2026:12:52:11 +0800] ip proxy ms "referer" "GET https://zhuoqidev.com/path" 200 req resp HIT "ua" "type"
const LINE =
  /^\[(\d{1,2})\/(\w{3})\/(\d{4}):[^\]]*\+0800\] (\S+) \S+ \S+ "([^"]*)" "(\S+) (\S+)[^"]*" \d+ \d+ \d+ \S+ "((?:[^"\\]|\\.)*)"/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The page view signal fetched by pages on this line (public/hit.gif). */
export const HIT_PATH = "/hit.gif";
// Same cap as the beacon (server/stats.ts): one visitor adds at most this many views a day.
const MAX_VIEWS_PER_VISITOR = 300;

export type Row = Crawler & { hits: number };
export type VisitRow = Place & { views: number; visitors: number };
type Request = { ip: string; method: string; path: string; ua: string; referer: string };

/** The parts of one log line of the given Beijing day, or null for other days and other lines. */
function parse(line: string, day: string): Request | null {
  const m = LINE.exec(line);
  if (!m) return null;
  const [, dd, mon, yyyy, ip, referer, method, target, ua] = m;
  if (`${yyyy}-${String(MONTHS.indexOf(mon!) + 1).padStart(2, "0")}-${dd!.padStart(2, "0")}` !== day) return null;
  let path: string;
  try {
    path = new URL(target!, "https://zhuoqidev.com").pathname;
  } catch {
    return null;
  }
  return { ip: ip!, method: method!, path, ua: ua!.replace(/\\(.)/g, "$1"), referer: referer! };
}

/** The crawler page request in one log line, or null for people, assets and other days. */
export function crawlerHit(line: string, day: string): Crawler | null {
  const r = parse(line, day);
  if (!r || (r.method !== "GET" && r.method !== "HEAD")) return null;
  return isPageLike(r.path) ? classify(r.ua) : null;
}

/** "ip|User-Agent" of a person's page view signal in one log line, or null. */
export function viewHit(line: string, day: string): string | null {
  const r = parse(line, day);
  if (!r || r.method !== "GET" || r.path !== HIT_PATH || classify(r.ua)) return null;
  return `${r.ip}|${r.ua}`;
}

/**
 * Page view signals per visitor ("ip|User-Agent"), split into those the same IP and browser backed up
 * with another request that day and those that came alone. A person's browser fetches the page (or at
 * least one of its files) from the same address it sends the signal from; a lone signal is a script
 * that was handed the page by another machine. A returning reader whose browser served the whole page
 * from its cache also sends a lone signal; that rare case is the price of not counting the crawlers.
 */
export function corroborated(lines: Iterable<string>, day: string) {
  const signals = new Map<string, number>();
  const other = new Set<string>();
  for (const line of lines) {
    const r = parse(line, day);
    if (!r || (r.method !== "GET" && r.method !== "HEAD")) continue;
    const visitor = `${r.ip}|${r.ua}`;
    if (r.path !== HIT_PATH) other.add(visitor);
    else if (r.method === "GET" && !classify(r.ua)) signals.set(visitor, (signals.get(visitor) ?? 0) + 1);
  }
  const kept = new Map<string, number>();
  let alone = 0;
  for (const [visitor, views] of signals) {
    if (other.has(visitor)) kept.set(visitor, views);
    else alone++;
  }
  return { kept, alone };
}

/** Views and visitors (one per IP and browser) by place; the IPs stay inside this function. */
export function aggregateVisits(lines: Iterable<string>, day: string, locate: (ip: string) => Place): VisitRow[] {
  const rows = new Map<string, VisitRow>();
  for (const [visitor, views] of corroborated(lines, day).kept) {
    const place = locate(visitor.slice(0, visitor.indexOf("|")));
    const key = `${place.country}|${place.region}|${place.city}`;
    const row = rows.get(key) ?? { ...place, views: 0, visitors: 0 };
    row.views += Math.min(views, MAX_VIEWS_PER_VISITOR);
    row.visitors++;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.visitors - a.visitors || b.views - a.views);
}

/** The article a page view signal was sent from: the Referer must be one of this line's article pages. */
function articleOf(referer: string): string | null {
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return null;
  }
  return DOMAINS.includes(url.hostname) ? slugOf(url.pathname) : null;
}

/**
 * Views and visitors (one per IP and browser) by article, from the Referer of the page view signals
 * that corroborated() keeps. Both languages count toward the same article.
 */
export function aggregatePages(lines: Iterable<string>, day: string): PageCount[] {
  const other = new Set<string>();
  const signals = new Map<string, Map<string, number>>();
  for (const line of lines) {
    const r = parse(line, day);
    if (!r || (r.method !== "GET" && r.method !== "HEAD")) continue;
    const visitor = `${r.ip}|${r.ua}`;
    if (r.path !== HIT_PATH) {
      other.add(visitor);
      continue;
    }
    if (r.method !== "GET" || classify(r.ua)) continue;
    const slug = articleOf(r.referer);
    if (!slug) continue;
    const byVisitor = signals.get(slug) ?? new Map<string, number>();
    byVisitor.set(visitor, (byVisitor.get(visitor) ?? 0) + 1);
    signals.set(slug, byVisitor);
  }
  const rows: PageCount[] = [];
  for (const [slug, byVisitor] of signals) {
    const row = { slug, views: 0, visitors: 0 };
    for (const [visitor, views] of byVisitor) {
      if (!other.has(visitor)) continue;
      row.views += Math.min(views, MAX_VIEWS_PER_VISITOR);
      row.visitors++;
    }
    if (row.visitors) rows.push(row);
  }
  return rows.sort((a, b) => b.visitors - a.visitors || b.views - a.views || a.slug.localeCompare(b.slug));
}

export function aggregate(lines: Iterable<string>, day: string): Row[] {
  const rows = new Map<string, Row>();
  for (const line of lines) {
    const hit = crawlerHit(line, day);
    if (!hit) continue;
    const row = rows.get(hit.bot) ?? { ...hit, hits: 0 };
    row.hits++;
    rows.set(hit.bot, row);
  }
  return [...rows.values()].sort((a, b) => b.hits - a.hits);
}

function* linesOf(gz: Buffer) {
  yield* gunzipSync(gz).toString("utf8").split("\n");
}

async function downloadDay(day: string): Promise<Buffer[]> {
  // A Beijing day is 16:00 UTC the evening before to 16:00 UTC.
  const end = new Date(`${day}T16:00:00Z`);
  const start = new Date(+end - 86400_000);
  const files: Buffer[] = [];
  for (const domain of DOMAINS) {
    const out = execFileSync(
      process.env.ALIYUN_BIN || "aliyun",
      [
        "cdn",
        "DescribeCdnDomainLogs",
        "--DomainName",
        domain,
        "--StartTime",
        start.toISOString().replace(/\.\d+Z$/, "Z"),
        "--EndTime",
        end.toISOString().replace(/\.\d+Z$/, "Z"),
        "--PageSize",
        "1000",
      ],
      { encoding: "utf8" },
    );
    // The fields of DescribeCdnDomainLogs this script reads.
    type Logs = {
      DomainLogDetails?: {
        DomainLogDetail?: { LogInfos?: { LogInfoDetail?: { LogPath: string; LogName: string }[] } }[];
      };
    };
    const details = (JSON.parse(out) as Logs).DomainLogDetails?.DomainLogDetail ?? [];
    for (const d of details) {
      for (const log of d.LogInfos?.LogInfoDetail ?? []) {
        const res = await fetch(`https://${log.LogPath}`);
        if (!res.ok) throw new Error(`${log.LogName}: HTTP ${res.status}`);
        files.push(Buffer.from(await res.arrayBuffer()));
      }
    }
  }
  return files;
}

async function main() {
  const { values } = parseArgs({
    options: { day: { type: "string" }, logs: { type: "string" }, "dry-run": { type: "boolean" } },
  });
  const day = values.day ?? beijingDay(Date.now() - 86400_000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`--day must be YYYY-MM-DD, got ${day}`);
  const files = values.logs
    ? readdirSync(values.logs)
        .filter((f) => f.endsWith(".gz"))
        .map((f) => readFileSync(join(values.logs!, f)))
    : await downloadDay(day);
  const lines = function* () {
    for (const f of files) yield* linesOf(f);
  };
  const rows = aggregate(lines(), day);
  console.log(`${day}: ${files.length} log files, ${rows.reduce((n, r) => n + r.hits, 0)} crawler page requests`);
  for (const r of rows) console.log(`  ${String(r.hits).padStart(5)}  ${r.category.padEnd(9)} ${r.company} / ${r.bot}`);

  const geo = process.env.IP2REGION_DIR;
  if (!geo && !values["dry-run"]) throw new Error("IP2REGION_DIR is not set, so visitors cannot be placed");
  const visits = geo ? aggregateVisits(lines(), day, openIp2region(geo)) : undefined;
  if (visits) {
    const sum = (k: "views" | "visitors") => visits.reduce((n, r) => n + r[k], 0);
    const { alone } = corroborated(lines(), day);
    console.log(
      `${day}: ${sum("views")} page views by ${sum("visitors")} visitors (${alone} lone signals not counted)`,
    );
    const byRegion = new Map<string, number>();
    for (const r of visits)
      byRegion.set(`${r.country} ${r.region}`, (byRegion.get(`${r.country} ${r.region}`) ?? 0) + r.visitors);
    for (const [k, n] of [...byRegion].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);
  } else console.log(`${day}: IP2REGION_DIR not set, visitors not counted`);
  const pages = aggregatePages(lines(), day);
  console.log(`${day}: ${pages.length} articles read`);
  for (const r of pages.slice(0, 10)) console.log(`  ${String(r.visitors).padStart(5)}  ${r.slug}`);
  if (values["dry-run"]) return;

  const token = process.env.STATS_ADMIN_TOKEN;
  if (!token) throw new Error("STATS_ADMIN_TOKEN is not set");
  const api = process.env.STATS_API || "https://api.zhuoqidev.com";
  const res = await fetch(`${api}/api/admin/ingest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ day, line: "cn", rows, visits, pages }),
  });
  if (!res.ok) throw new Error(`ingest: HTTP ${res.status} ${await res.text()}`);
  console.log(`stored: ${await res.text()}`);
}

if (import.meta.main) await main();
