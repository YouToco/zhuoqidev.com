# Alibaba Cloud CDN certificate renewal

The repository renews every domestic Alibaba Cloud CDN certificate under
`zhuoqidev.com` through `.github/workflows/cert-renew.yml`. Each matrix entry
is one certificate:

| Entry | DNS names | CDN edges |
| --- | --- | --- |
| `zhuoqidev.com` | `zhuoqidev.com`, `www.zhuoqidev.com` | `zhuoqidev.com.queniuaa.com`, `www.zhuoqidev.com.w.kunlunaq.com` |
| `argus.zhuoqidev.com` | `argus.zhuoqidev.com` | `argus.zhuoqidev.com.w.kunlunaq.com` |

Argus is a separate project. Its certificate is renewed here because this
repository stays active: GitHub disables scheduled workflows in a public
repository after 60 days without commits, and the Argus repository is
otherwise idle. To add another subdomain, add a matrix entry with its CDN
CNAME and the same name to `CDN_CERT_DOMAINS` in `server/certs.ts`.

`vane.zhuoqidev.com` was removed on 2026-11-07, when the Vane project went
offline and its CDN domain was deleted.

## Behavior

- Runs every Monday at 03:17 UTC and can also be started manually.
- Runs on the GitHub-hosted `ubuntu-26.04` runner, pinned like the build workflows.
- Runs the entries one at a time; one failing entry does not cancel the others.
- Reads the certificate currently bound to each CDN domain of the entry.
- Exits without mutation when every one has more than 30 days left.
- Otherwise issues one Let's Encrypt ECC certificate containing the entry's DNS
  names through AliDNS DNS-01 and uploads it to each of its CDN domains, named
  `zhuoqidev-le-<date>-<root|www|argus>`.
- Succeeds only after every CDN CNAME of the entry presents the exact uploaded
  SHA-256 fingerprint, HTTPS requests succeed, and temporary DNS challenge
  records are absent.
- Keeps the ACME account, certificate, private key, and Alibaba Cloud CLI
  configuration only under `RUNNER_TEMP`. No certificate private key is cached
  or committed.

## Noticing when renewal stops

Nothing here sends notifications. Every daily `stats-cn.yml` run reads each
CDN certificate's expiry from Alibaba Cloud (`scripts/cdn-certs.ts`), and the
`cdn-certs` check of `GET /api/admin/health` fails when any certificate has
fewer than 21 days left or was not read for 3 days. A weekly job that renews at
30 days keeps every certificate above 23 days, so a failing check means this
workflow stopped running or keeps failing. The domain list in
`server/certs.ts` must match the matrix above; a test checks that.

## Required GitHub Actions secrets

- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`
- `ACME_ACCOUNT_EMAIL`

The Alibaba Cloud RAM identity needs read access to CDN certificate state and
write access for the CDN domain certificates listed above, plus permission to create and
delete AliDNS TXT records under `zhuoqidev.com`.

## Manual verification

Run the workflow from GitHub Actions or with:

```bash
gh workflow run cert-renew.yml --repo YouToco/zhuoqidev.com
```

A manual run does not force issuance. The same 30-day remote-expiry gate is
always applied. When the certificate is still healthy, the expected log ends
with `certificate renewal is not needed`.

After an actual renewal, verify the workflow log contains the same SHA-256
fingerprint for every CDN edge of that entry. Do not repeatedly dispatch a failed issuance;
first inspect whether one CDN domain already accepted the new certificate.
