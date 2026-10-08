-- Guestbook notes and daily visit counts for zhuoqidev.com. Days are Beijing dates (YYYY-MM-DD).
-- Nothing here stores an IP address: locations come from Cloudflare's lookup at request time, and
-- the per-day visitor hashes use a salt that is thrown away the next day.

-- Crawler page requests per day, line and crawler.
--   line 'cf': overseas line, counted live by functions/_middleware.ts
--   line 'cn': mainland line, imported once a day from Aliyun CDN logs by scripts/stats-cn.ts
CREATE TABLE crawler_daily (
  day TEXT NOT NULL,
  line TEXT NOT NULL,
  bot TEXT NOT NULL,
  company TEXT NOT NULL,
  category TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, line, bot)
) WITHOUT ROWID;

-- Page views by people (pages that ran the beacon in src/components/Analytics.astro), per place.
-- visitors counts each salted (IP, browser) pair once per day, at its first view.
CREATE TABLE visit_daily (
  day TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  city TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, country, region, city)
) WITHOUT ROWID;

-- Today's salted visitor hashes; earlier days are deleted when a new day's salt is made.
CREATE TABLE visitor_seen (
  day TEXT NOT NULL,
  hash TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, hash)
) WITHOUT ROWID;

CREATE TABLE daily_salt (
  day TEXT PRIMARY KEY,
  salt TEXT NOT NULL
) WITHOUT ROWID;

-- Guestbook. New notes wait as 'pending' until approved on /admin/; rejected ones are deleted.
-- country/region/city are shown only on /admin/; ip_hash (salted per day) only rate-limits posting.
CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  color TEXT NOT NULL,
  lang TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  city TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TEXT
);
CREATE INDEX notes_by_status ON notes (status, id);
CREATE INDEX notes_by_ip ON notes (ip_hash, created_at);
