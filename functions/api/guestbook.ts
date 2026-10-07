// Guestbook: GET the approved notes, POST a new one. New notes wait for approval on /admin/.
import { beijingDay } from "../../server/bots.ts";
import { checkNote } from "../../server/guestbook.ts";
import { json, readJson, siteOrigin } from "../../server/http.ts";
import { dailyHash, placeOf } from "../../server/stats.ts";

const WALL_SIZE = 120;
const MAX_PENDING = 300; // stop taking notes if a flood got past the other checks
const PER_IP_10_MIN = 3;
const PER_IP_DAY = 10;

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT id, name, body, color, date(created_at, '+8 hours') AS date FROM notes
     WHERE status = 'approved' ORDER BY id DESC LIMIT ?1`,
  )
    .bind(WALL_SIZE)
    .all();
  // Not cached: a note I just approved should be on the wall at the next reload.
  return json({ notes: results });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!siteOrigin(request)) return json({ error: "forbidden" }, 403);
  const checked = checkNote(await readJson(request));
  // Tell a bot that filled the hidden field it worked, so it has no reason to try again.
  if (!checked.ok) return checked.error === "spam" ? json({ id: 0, status: "pending" }, 201) : json({ error: checked.error }, 400);

  const db = env.DB;
  const now = new Date();
  const ipHash = await dailyHash(db, request, beijingDay(now), false);
  const [recent, today, pending] = await db.batch<{ n: number }>([
    db.prepare("SELECT COUNT(*) AS n FROM notes WHERE ip_hash = ?1 AND created_at > ?2").bind(ipHash, new Date(+now - 600_000).toISOString()),
    db.prepare("SELECT COUNT(*) AS n FROM notes WHERE ip_hash = ?1").bind(ipHash),
    db.prepare("SELECT COUNT(*) AS n FROM notes WHERE status = 'pending'"),
  ]);
  const count = (r: D1Result<{ n: number }> | undefined) => r?.results[0]?.n ?? 0;
  if (count(recent) >= PER_IP_10_MIN || count(today) >= PER_IP_DAY) return json({ error: "rate-limited" }, 429);
  if (count(pending) >= MAX_PENDING) return json({ error: "full" }, 503);

  const { name, body, color, lang } = checked.note;
  const place = placeOf(request);
  const row = await db
    .prepare(
      `INSERT INTO notes (created_at, name, body, color, lang, country, region, city, ip_hash)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) RETURNING id`,
    )
    .bind(now.toISOString(), name, body, color, lang, place.country, place.region, place.city, ipHash)
    .first<{ id: number }>();
  return json({ id: row?.id ?? 0, status: "pending" }, 201);
};
