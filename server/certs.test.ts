import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CDN_CERT_DOMAINS, validCerts } from "./certs.ts";

test("the domains checked are exactly the ones cert-renew.yml renews", () => {
  const workflow = readFileSync(new URL("../.github/workflows/cert-renew.yml", import.meta.url), "utf8");
  const renewed = [...workflow.matchAll(/^\s+domains: (.+)$/gm)].flatMap((m) => m[1]!.trim().split(/\s+/));
  assert.deepEqual(renewed, [...CDN_CERT_DOMAINS]);
});

test("accepts expiry reports for known domains only, once each", () => {
  const report = { domain: "argus.zhuoqidev.com", expires: "2027-02-01T04:49:45Z" };
  assert.deepEqual(validCerts([report]), [report]);
  assert.deepEqual(validCerts([{ ...report, extra: 1 }]), [report]);
  assert.equal(validCerts([]), null);
  assert.equal(validCerts(undefined), null);
  assert.equal(validCerts([report, report]), null);
  assert.equal(validCerts([{ ...report, domain: "example.com" }]), null);
  assert.equal(validCerts([{ ...report, expires: "2027-02-01" }]), null);
  assert.equal(validCerts([{ ...report, expires: "2027-13-45T00:00:00Z" }]), null);
  assert.equal(validCerts([...CDN_CERT_DOMAINS, "x"].map((domain) => ({ ...report, domain }))), null);
});
