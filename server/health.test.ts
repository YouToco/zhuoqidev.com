import assert from "node:assert/strict";
import { test } from "node:test";
import { health, type HealthData } from "./health.ts";
import { daysBefore } from "./pages.ts";

const TODAY = "2026-11-20";
const AT = "2026-11-20T08:00:00.000Z";

/** Ten days of article counts ending yesterday, so the hot list is full. */
const hotRows = Array.from({ length: 10 }, (_, i) => [
  { day: daysBefore(TODAY, i + 1), slug: "verify-llm-relay-api", visitors: 5 },
  { day: daysBefore(TODAY, i + 1), slug: "half-speed-tensor-cores", visitors: 3 },
]).flat();

const healthy: HealthData = {
  cnVisits: { day: "2026-11-19", visitors: 42 },
  cnCrawlerDay: "2026-11-19",
  cfCrawlers: [
    { day: "2026-11-19", n: 310 },
    { day: "2026-11-20", n: 120 },
  ],
  cfVisits: [
    { day: "2026-11-18", n: 2 },
    { day: "2026-11-20", n: 1 },
  ],
  pages: { cn: "2026-11-19", cf: "2026-11-20" },
  hotRows,
};

const check = (data: HealthData, name: string, today = TODAY) => {
  const c = health(data, today, AT).checks.find((x) => x.name === name);
  assert.ok(c, name);
  return c;
};

test("reports a healthy day as ok, with every check named", () => {
  const h = health(healthy, TODAY, AT);
  assert.equal(h.checkedAt, AT);
  assert.equal(h.ok, true);
  assert.deepEqual(
    h.checks.map((c) => [c.name, c.ok]),
    [
      ["cn-import", true],
      ["cn-visitors", true],
      ["cf-crawlers", true],
      ["cf-visitors", true],
      ["page-counts", true],
      ["hot", true],
    ],
  );
  assert.match(check(healthy, "cn-import").detail, /2026-11-19.*2026-11-19.*2026-11-18 or later/);
  assert.match(check(healthy, "cn-visitors").detail, /42 mainland visitors on 2026-11-19/);
  assert.match(check(healthy, "cf-crawlers").detail, /^430 /);
  assert.match(check(healthy, "cf-visitors").detail, /^3 /);
  assert.match(check(healthy, "hot").detail, /list 2 articles; counts cover 10 of the 7 days/);
});

test("a mainland import older than two days fails cn-import and the whole answer", () => {
  const stale = { ...healthy, cnVisits: { day: "2026-11-17", visitors: 30 }, cnCrawlerDay: "2026-11-17" };
  assert.equal(check(stale, "cn-import").ok, false);
  assert.equal(health(stale, TODAY, AT).ok, false);
  // Two days back is still fine: yesterday is imported later in the day.
  assert.equal(
    check({ ...stale, cnVisits: { day: "2026-11-18", visitors: 30 }, cnCrawlerDay: "2026-11-18" }, "cn-import").ok,
    true,
  );
  // Crawlers imported but no visits (an import without `visits`) is stale too.
  assert.equal(check({ ...healthy, cnVisits: { day: "2026-11-15", visitors: 9 } }, "cn-import").ok, false);
  // An empty table says so instead of failing on a null.
  const empty = { ...healthy, cnVisits: { day: null, visitors: null }, cnCrawlerDay: null };
  assert.equal(check(empty, "cn-import").ok, false);
  assert.match(check(empty, "cn-import").detail, /visit_daily_cn day none/);
  assert.equal(check(empty, "cn-visitors").ok, false);
  assert.match(check(empty, "cn-visitors").detail, /empty/);
  assert.equal(check({ ...healthy, cnVisits: { day: "2026-11-19", visitors: 0 } }, "cn-visitors").ok, false);
});

test("empty page_daily reads as no data yet: expected right after counting started, a failure later", () => {
  const none = { ...healthy, pages: { cn: null, cf: null }, hotRows: [] };
  const later = check(none, "page-counts");
  assert.equal(later.ok, false);
  assert.match(later.detail, /cn: no data yet \(per-article counts started 2026-10-31\)/);
  assert.match(later.detail, /cf: no data yet/);
  assert.equal(health(none, TODAY, AT).ok, false);
  const early = check(none, "page-counts", "2026-11-01");
  assert.equal(early.ok, true);
  assert.match(early.detail, /none expected yet/);
  // One line missing fails the check and names that line.
  const cnOnly = check({ ...healthy, pages: { cn: "2026-11-19", cf: null } }, "page-counts");
  assert.equal(cnOnly.ok, false);
  assert.match(cnOnly.detail, /cn: latest 2026-11-19.*cf: no data yet/);
  // A stale line fails too.
  assert.equal(check({ ...healthy, pages: { cn: "2026-11-17", cf: "2026-11-20" } }, "page-counts").ok, false);
  // A missing table (migration 0003 not applied) is reported, not thrown.
  const missing = check({ ...healthy, pages: { error: "no such table: page_daily" } }, "page-counts");
  assert.equal(missing.ok, false);
  assert.match(missing.detail, /migration 0003.*no such table/);
  // The hot list is informational: empty, it never fails the answer on its own.
  const hot = check(none, "hot");
  assert.equal(hot.ok, true);
  assert.match(hot.detail, /list 0 articles; counts cover 0 of the 7 days.*stays empty/);
  assert.equal(health({ ...healthy, hotRows: [] }, TODAY, AT).ok, true);
});

test("no overseas visitors over three days fails cf-visitors; one quiet day does not", () => {
  const zero = { ...healthy, cfVisits: [{ day: "2026-11-17", n: 8 }] };
  const c = check(zero, "cf-visitors");
  assert.equal(c.ok, false);
  assert.match(c.detail, /^0 overseas visitors \(visit_daily\) from 2026-11-18 to 2026-11-20/);
  assert.equal(health(zero, TODAY, AT).ok, false);
  assert.equal(check({ ...healthy, cfVisits: [{ day: "2026-11-18", n: 1 }] }, "cf-visitors").ok, true);
  // Overseas crawlers look at today and yesterday only.
  assert.equal(check({ ...healthy, cfCrawlers: [{ day: "2026-11-18", n: 500 }] }, "cf-crawlers").ok, false);
  assert.equal(check({ ...healthy, cfCrawlers: [{ day: "2026-11-19", n: 1 }] }, "cf-crawlers").ok, true);
});
