-- Page views by people on the mainland line (Aliyun CDN), imported once a day from the CDN logs by
-- scripts/stats-cn.ts. Pages served by that line fetch /hit.gif instead of sending the beacon to
-- api.zhuoqidev.com, which often got lost on its way across the border; the import places each IP
-- with ip2region on the GitHub runner, so only these totals arrive here. An import replaces its day.
-- Same columns as visit_daily; readers sum both tables (ALL_VISITS in server/stats.ts).
CREATE TABLE visit_daily_cn (
  day TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  city TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, country, region, city)
) WITHOUT ROWID;
