import assert from "node:assert/strict";
import { test } from "node:test";
import { validVisits } from "./stats.ts";

test("accepts a mainland import's visits and keeps only the known fields", () => {
  assert.deepEqual(
    validVisits([
      { country: "CN", region: "广东省", city: "深圳市", views: 4, visitors: 3, ip: "203.0.113.7" },
      { country: "XX", region: "", city: "", views: 1, visitors: 1 },
    ]),
    [
      { country: "CN", region: "广东省", city: "深圳市", views: 4, visitors: 3 },
      { country: "XX", region: "", city: "", views: 1, visitors: 1 },
    ],
  );
  assert.deepEqual(validVisits([]), []);
});

test("rejects malformed visits", () => {
  const ok = { country: "CN", region: "", city: "", views: 1, visitors: 1 };
  for (const bad of [
    null,
    "rows",
    [null],
    [{ ...ok, country: "cn" }],
    [{ ...ok, country: "CHN" }],
    [{ ...ok, region: "x".repeat(81) }],
    [{ ...ok, city: 1 }],
    [{ ...ok, visitors: 0 }],
    [{ ...ok, views: 1.5 }],
    [{ ...ok, views: 1, visitors: 2 }],
    Array(2001).fill(ok),
  ])
    assert.equal(validVisits(bad), null, JSON.stringify(bad)?.slice(0, 60));
});
