import assert from "node:assert/strict";
import { test } from "node:test";
import { rangeFor, shape } from "./public-stats.ts";

test("ranges end today (Beijing) and default to 30 days", () => {
  assert.deepEqual(rangeFor("7", "2026-10-08"), { key: "7", from: "2026-10-02", to: "2026-10-08" });
  assert.deepEqual(rangeFor("30", "2026-10-08"), { key: "30", from: "2026-09-09", to: "2026-10-08" });
  assert.deepEqual(rangeFor("all", "2026-10-08"), { key: "all", from: "2000-01-01", to: "2026-10-08" });
  assert.equal(rangeFor("365", "2026-10-08").key, "30");
  assert.equal(rangeFor(null, "2026-10-08").key, "30");
});

test("visitors by country, and in China by province", () => {
  const s = shape({
    range: rangeFor("7", "2026-10-08"),
    since: "2026-10-05",
    cnLatestDay: "2026-10-07",
    visits: [
      { country: "CN", region: "Guangdong", views: 5, visitors: 2 },
      { country: "CN", region: "Guangdong Sheng", views: 1, visitors: 1 },
      { country: "CN", region: "", views: 2, visitors: 1 },
      { country: "HK", region: "", views: 3, visitors: 1 },
      { country: "US", region: "California", views: 4, visitors: 3 },
      { country: "XX", region: "", views: 1, visitors: 1 },
    ],
    crawlers: [],
    days: [],
  });
  assert.deepEqual(s.totals, { views: 16, visitors: 9, countries: 3, crawlers: 0 });
  assert.deepEqual(s.countries.map((c) => [c.code, c.visitors]), [["CN", 4], ["US", 3], ["HK", 1], ["XX", 1]]);
  assert.deepEqual(s.provinces, [
    { adcode: 440000, views: 6, visitors: 3 },
    { adcode: 810000, views: 3, visitors: 1 },
  ]);
  assert.deepEqual(s.chinaElsewhere, { views: 2, visitors: 1 });
});

test("crawlers: both lines on one row per name, categories largest first, the tail summed", () => {
  const crawlers = [
    { bot: "ClaudeBot", company: "Anthropic", category: "ai-crawl", line: "cn", hits: 100 },
    { bot: "ClaudeBot", company: "Anthropic", category: "ai-crawl", line: "cf", hits: 9 },
    { bot: "伪造浏览器标识", company: "未知", category: "fake", line: "cn", hits: 500 },
    ...Array.from({ length: 25 }, (_, i) => ({ bot: `bot${i}`, company: "x", category: "other", line: "cf", hits: 1 })),
  ];
  const s = shape({ range: rangeFor("30", "2026-10-08"), since: null, cnLatestDay: null, visits: [], crawlers, days: [] });
  assert.equal(s.totals.crawlers, 634);
  assert.deepEqual(s.crawlers.categories, [
    { key: "fake", hits: 500 },
    { key: "ai-crawl", hits: 109 },
    { key: "other", hits: 25 },
  ]);
  assert.equal(s.crawlers.bots.length, 20);
  assert.deepEqual(s.crawlers.bots[1], { bot: "ClaudeBot", company: "Anthropic", category: "ai-crawl", cf: 9, cn: 100 });
  assert.equal(s.crawlers.rest, 7);
});
