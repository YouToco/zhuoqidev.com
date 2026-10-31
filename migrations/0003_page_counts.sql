-- Views per article, for the "popular lately" lists (src/data/featured.ts, functions/hot.json.ts).
-- Only the article's slug is kept (both languages count toward the same slug), never the IP or the
-- full address; days are Beijing dates (YYYY-MM-DD).

-- Views and visitors per day, line and article.
--   line 'cf': overseas line, counted live by the beacon (POST /api/hit?p=<path>, server/stats.ts)
--   line 'cn': mainland line, imported once a day from the Referer of /hit.gif requests in the
--              Aliyun CDN logs by scripts/stats-cn.ts; an import replaces its day
-- visitors counts each salted (IP, browser) pair once per day and article.
CREATE TABLE page_daily (
  day TEXT NOT NULL,
  line TEXT NOT NULL,
  slug TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, line, slug)
) WITHOUT ROWID;

-- Which articles today's salted visitor hashes have opened (overseas line only), so a second view
-- of the same article is not a second visitor. Deleted with visitor_seen when a new day's salt is made.
CREATE TABLE page_seen (
  day TEXT NOT NULL,
  hash TEXT NOT NULL,
  slug TEXT NOT NULL,
  PRIMARY KEY (day, hash, slug)
) WITHOUT ROWID;
