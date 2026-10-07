// Crawler counts for the mainland line. Readers in China are served by Aliyun CDN, which never
// runs our Pages Functions, so the overseas middleware cannot see Baiduspider and friends. Aliyun
// publishes an hourly access log per domain (kept 30 days, a few hours late). This script reads one
// Beijing day of those logs, classifies each page request with the same rules as the middleware,
// and replaces that day's mainland rows in the stats database. Visitor IPs never leave this process.
//
//   node scripts/stats-cn.ts --day 2026-10-07 [--dry-run]
//   node scripts/stats-cn.ts --logs <dir of .gz files> --day 2026-10-07 --dry-run
//
// Needs the aliyun CLI (ALIYUN_BIN, default "aliyun") with a profile allowed to call
// cdn:DescribeCdnDomainLogs, and STATS_ADMIN_TOKEN (plus STATS_API) unless --dry-run.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { gunzipSync } from "node:zlib";
import { beijingDay, type Crawler, classify, isPageLike } from "../server/bots.ts";

const DOMAINS = ["zhuoqidev.com", "www.zhuoqidev.com"];

// [7/Oct/2026:12:52:11 +0800] ip proxy ms "referer" "GET https://zhuoqidev.com/path" 200 req resp HIT "ua" "type"
const LINE = /^\[(\d{1,2})\/(\w{3})\/(\d{4}):[^\]]*\+0800\] \S+ \S+ \S+ "[^"]*" "(\S+) (\S+)[^"]*" \d+ \d+ \d+ \S+ "((?:[^"\\]|\\.)*)"/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Row = Crawler & { hits: number };

/** The crawler page request in one log line, or null for people, assets and other days. */
export function crawlerHit(line: string, day: string): Crawler | null {
  const m = LINE.exec(line);
  if (!m) return null;
  const [, dd, mon, yyyy, method, target, ua] = m;
  if (`${yyyy}-${String(MONTHS.indexOf(mon!) + 1).padStart(2, "0")}-${dd!.padStart(2, "0")}` !== day) return null;
  if (method !== "GET" && method !== "HEAD") return null;
  let path: string;
  try {
    path = new URL(target!, "https://zhuoqidev.com").pathname;
  } catch {
    return null;
  }
  return isPageLike(path) ? classify(ua!.replace(/\\(.)/g, "$1")) : null;
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
    const out = execFileSync(process.env.ALIYUN_BIN || "aliyun", [
      "cdn", "DescribeCdnDomainLogs",
      "--DomainName", domain,
      "--StartTime", start.toISOString().replace(/\.\d+Z$/, "Z"),
      "--EndTime", end.toISOString().replace(/\.\d+Z$/, "Z"),
      "--PageSize", "1000",
    ], { encoding: "utf8" });
    const details = JSON.parse(out).DomainLogDetails?.DomainLogDetail ?? [];
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
    ? readdirSync(values.logs).filter((f) => f.endsWith(".gz")).map((f) => readFileSync(join(values.logs!, f)))
    : await downloadDay(day);
  const rows = aggregate((function* () {
    for (const f of files) yield* linesOf(f);
  })(), day);
  console.log(`${day}: ${files.length} log files, ${rows.reduce((n, r) => n + r.hits, 0)} crawler page requests`);
  for (const r of rows) console.log(`  ${String(r.hits).padStart(5)}  ${r.category.padEnd(9)} ${r.company} / ${r.bot}`);
  if (values["dry-run"]) return;

  const token = process.env.STATS_ADMIN_TOKEN;
  if (!token) throw new Error("STATS_ADMIN_TOKEN is not set");
  const api = process.env.STATS_API || "https://api.zhuoqidev.com";
  const res = await fetch(`${api}/api/admin/ingest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ day, line: "cn", rows }),
  });
  if (!res.ok) throw new Error(`ingest: HTTP ${res.status} ${await res.text()}`);
  console.log(`stored: ${await res.text()}`);
}

if (import.meta.main) await main();
