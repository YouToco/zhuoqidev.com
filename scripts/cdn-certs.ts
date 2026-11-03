// Reads when the certificate on each Aliyun CDN domain expires and sends it to the stats database, for
// the cdn-certs check of GET /api/admin/health (server/certs.ts). Run once a day by stats-cn.yml.
//
//   node scripts/cdn-certs.ts [--dry-run]
//
// Needs the aliyun CLI (ALIYUN_BIN, default "aliyun") with a profile allowed to call
// cdn:DescribeDomainCertificateInfo, and STATS_ADMIN_TOKEN (plus STATS_API) unless --dry-run.
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { CDN_CERT_DOMAINS, type CertReport } from "../server/certs.ts";
import { withRetries } from "./retry.ts";

/** The expiry of the certificate on `domain`, as ISO 8601 UTC without fractions. */
async function expiryOf(domain: string): Promise<string> {
  const out = await withRetries(`DescribeDomainCertificateInfo ${domain}`, () =>
    execFileSync(process.env.ALIYUN_BIN || "aliyun", ["cdn", "DescribeDomainCertificateInfo", "--DomainName", domain], {
      encoding: "utf8",
    }),
  );
  type Info = { CertInfos?: { CertInfo?: { DomainName?: string; CertExpireTime?: string }[] } };
  const info = (JSON.parse(out) as Info).CertInfos?.CertInfo?.find((c) => c.DomainName === domain);
  const expires = info?.CertExpireTime;
  if (!expires || Number.isNaN(Date.parse(expires))) throw new Error(`${domain}: no certificate expiry in ${out}`);
  return new Date(expires).toISOString().replace(/\.\d+Z$/, "Z");
}

async function main() {
  const { values } = parseArgs({ options: { "dry-run": { type: "boolean" } } });
  const certs: CertReport[] = [];
  for (const domain of CDN_CERT_DOMAINS) {
    const expires = await expiryOf(domain);
    const days = Math.floor((Date.parse(expires) - Date.now()) / 86400_000);
    console.log(`${domain}: expires ${expires}, ${days} days left`);
    certs.push({ domain, expires });
  }
  if (values["dry-run"]) return;

  const token = process.env.STATS_ADMIN_TOKEN;
  if (!token) throw new Error("STATS_ADMIN_TOKEN is not set");
  const api = process.env.STATS_API || "https://api.zhuoqidev.com";
  const text = await withRetries("POST /api/admin/certs", async () => {
    const res = await fetch(`${api}/api/admin/certs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ certs }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${body}`);
    return body;
  });
  console.log(`stored: ${text}`);
}

if (import.meta.main) await main();
