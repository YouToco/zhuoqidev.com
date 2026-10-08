// Writing the daily counts (schema: migrations/0001_init.sql).
import { beijingDay, type Crawler } from "./bots.ts";
import { hex, sha256 } from "./http.ts";

export type Place = { country: string; region: string; city: string };

/** Where Cloudflare places the visitor's IP. Only these names are kept, never the IP. */
export function placeOf(request: Request): Place {
  const cf = request.cf as IncomingRequestCfProperties | undefined;
  return { country: cf?.country ?? "XX", region: cf?.region ?? "", city: cf?.city ?? "" };
}

export function recordCrawler(db: D1Database, day: string, line: "cf" | "cn", c: Crawler) {
  return db
    .prepare(
      `INSERT INTO crawler_daily (day, line, bot, company, category, hits) VALUES (?1, ?2, ?3, ?4, ?5, 1)
       ON CONFLICT (day, line, bot) DO UPDATE SET hits = hits + 1, company = excluded.company, category = excluded.category`,
    )
    .bind(day, line, c.bot, c.company, c.category)
    .run();
}

// One random salt per Beijing day. When a new day's salt is made, yesterday's salt and hashes are
// deleted, so nobody (including me) can later test which IP was behind a hash.
let cached: { day: string; salt: string } | undefined;

async function saltFor(db: D1Database, day: string): Promise<string> {
  if (cached?.day === day) return cached.salt;
  const read = () => db.prepare("SELECT salt FROM daily_salt WHERE day = ?1").bind(day).first<{ salt: string }>();
  let row = await read();
  if (!row) {
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO daily_salt (day, salt) VALUES (?1, ?2)").bind(day, hex(crypto.getRandomValues(new Uint8Array(16)))),
      db.prepare("DELETE FROM daily_salt WHERE day < ?1").bind(day),
      db.prepare("DELETE FROM visitor_seen WHERE day < ?1").bind(day),
    ]);
    row = await read();
  }
  cached = { day, salt: row!.salt };
  return cached.salt;
}

/** A per-day pseudonym for the request's IP (and browser, when given). */
export async function dailyHash(db: D1Database, request: Request, day: string, withBrowser: boolean): Promise<string> {
  const salt = await saltFor(db, day);
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const ua = withBrowser ? (request.headers.get("User-Agent") ?? "") : "";
  return hex(await sha256(`${salt}|${ip}|${ua}`)).slice(0, 32);
}

// A visitor stops adding views after this many in a day, so one script hammering the beacon
// cannot inflate the counts (or burn the database's daily write allowance) for long.
const MAX_VIEWS_PER_VISITOR = 300;

/** One page view by a person: +1 view for their place, +1 visitor on their first view today. */
export async function recordView(db: D1Database, request: Request): Promise<void> {
  const day = beijingDay();
  const hash = await dailyHash(db, request, day, true);
  const seen = await db
    .prepare(
      `INSERT INTO visitor_seen (day, hash, views) VALUES (?1, ?2, 1)
       ON CONFLICT (day, hash) DO UPDATE SET views = views + 1 RETURNING views`,
    )
    .bind(day, hash)
    .first<{ views: number }>();
  const views = seen?.views ?? 1;
  if (views > MAX_VIEWS_PER_VISITOR) return;
  const p = placeOf(request);
  await db
    .prepare(
      `INSERT INTO visit_daily (day, country, region, city, views, visitors) VALUES (?1, ?2, ?3, ?4, 1, ?5)
       ON CONFLICT (day, country, region, city) DO UPDATE SET views = views + 1, visitors = visitors + excluded.visitors`,
    )
    .bind(day, p.country, p.region, p.city, views === 1 ? 1 : 0)
    .run();
}
