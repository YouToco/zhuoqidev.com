-- When the certificate on each Aliyun CDN domain (mainland line) expires, read from Aliyun once a day
-- by scripts/cdn-certs.ts (stats-cn.yml) and replaced per domain on every read. GET /api/admin/health
-- checks it (server/certs.ts): cert-renew.yml renews these certificates, and nothing else would notice
-- if that schedule stopped. Times are ISO 8601 UTC.
CREATE TABLE cdn_cert (
  domain TEXT PRIMARY KEY,
  expires TEXT NOT NULL,
  checked_at TEXT NOT NULL
) WITHOUT ROWID;
