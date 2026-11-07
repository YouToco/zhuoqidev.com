// Certificates on the Aliyun CDN domains of the mainland line. Cloudflare renews its own; these are
// renewed by cert-renew.yml, which only works while that weekly schedule keeps running and passing.
// stats-cn.yml reads each domain's expiry from Aliyun once a day (scripts/cdn-certs.ts) and stores it
// (POST /api/admin/certs, migrations/0004), so GET /api/admin/health can say when renewal stopped.
// Dependency-free and pure, like health.ts.
import type { Check } from "./health.ts";

/** Every Aliyun CDN domain with an uploaded certificate, in cert-renew.yml's order (a test keeps them equal). */
export const CDN_CERT_DOMAINS = ["zhuoqidev.com", "www.zhuoqidev.com", "argus.zhuoqidev.com"] as const;

/** cert-renew.yml renews at 30 days left and runs weekly, so a renewed certificate never gets under 23. */
export const CERT_MIN_DAYS = 21;
/** Expiries are read once a day; none newer than this many days means the reading stopped. */
export const CERT_STALE_DAYS = 3;

export type CertReport = { domain: string; expires: string };
export type CertRow = CertReport & { checkedAt: string };

const DAY_MS = 86400_000;

/** The reports in a POST /api/admin/certs body ({certs: [{domain, expires}]}), or null when it is not valid. */
export function validCerts(input: unknown): CertReport[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > CDN_CERT_DOMAINS.length) return null;
  const known = new Set<string>(CDN_CERT_DOMAINS);
  const ok = (input as unknown[]).every((x) => {
    if (typeof x !== "object" || x === null) return false;
    const v = x as Record<string, unknown>;
    return (
      typeof v.domain === "string" &&
      known.has(v.domain) &&
      typeof v.expires === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v.expires) &&
      !Number.isNaN(Date.parse(v.expires))
    );
  });
  if (!ok) return null;
  const rows = (input as CertReport[]).map(({ domain, expires }) => ({ domain, expires }));
  return new Set(rows.map((r) => r.domain)).size === rows.length ? rows : null;
}

/** The cdn-certs health check: every domain read recently and at least CERT_MIN_DAYS from expiry. */
export function certCheck(certs: CertRow[] | { error: string }, now: Date): Check {
  if ("error" in certs)
    return {
      name: "cdn-certs",
      ok: false,
      detail: `cdn_cert could not be read (is migration 0004 applied?): ${certs.error}`,
    };
  const byDomain = new Map(certs.map((c) => [c.domain, c]));
  const parts: string[] = [];
  let ok = true;
  for (const domain of CDN_CERT_DOMAINS) {
    const c = byDomain.get(domain);
    if (!c) {
      ok = false;
      parts.push(`${domain}: never reported`);
      continue;
    }
    const days = Math.floor((Date.parse(c.expires) - +now) / DAY_MS);
    const age = Math.floor((+now - Date.parse(c.checkedAt)) / DAY_MS);
    const stale = age >= CERT_STALE_DAYS;
    if (days < CERT_MIN_DAYS || stale) ok = false;
    parts.push(
      `${domain}: ${days} days left (expires ${c.expires.slice(0, 10)}), read ${c.checkedAt.slice(0, 10)}` +
        (stale ? `, not read for ${age} days` : ""),
    );
  }
  return {
    name: "cdn-certs",
    ok,
    detail:
      parts.join("; ") +
      `; each needs ${CERT_MIN_DAYS}+ days and a reading within ${CERT_STALE_DAYS} days (cert-renew.yml renews at 30)`,
  };
}
