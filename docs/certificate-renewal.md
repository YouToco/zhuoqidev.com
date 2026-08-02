# Alibaba Cloud CDN certificate renewal

The repository renews the domestic Alibaba Cloud CDN certificate for
`zhuoqidev.com` and `www.zhuoqidev.com` through
`.github/workflows/cert-renew.yml`.

## Behavior

- Runs every Monday at 03:17 UTC and can also be started manually.
- Reads the certificate currently bound to both CDN domains.
- Exits without mutation when both certificates have more than 30 days left.
- Otherwise issues one Let's Encrypt ECC certificate containing both DNS names
  through AliDNS DNS-01 and uploads it to both CDN domains.
- Succeeds only after both CDN CNAMEs present the exact uploaded SHA-256
  fingerprint, HTTPS requests succeed, and temporary DNS challenge records are
  absent.
- Keeps the ACME account, certificate, private key, and Alibaba Cloud CLI
  configuration only under `RUNNER_TEMP`. No certificate private key is cached
  or committed.

## Required GitHub Actions secrets

- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`
- `ACME_ACCOUNT_EMAIL`

The Alibaba Cloud RAM identity needs read access to CDN certificate state and
write access for the two CDN domain certificates, plus permission to create and
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
fingerprint for both CDN edges. Do not repeatedly dispatch a failed issuance;
first inspect whether one CDN domain already accepted the new certificate.
