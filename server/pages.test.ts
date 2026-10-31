import assert from "node:assert/strict";
import { test } from "node:test";
import { daysBefore, hotSlugs, slugOf, validPages } from "./pages.ts";

test("finds the article of a page path in either language", () => {
  assert.equal(slugOf("/posts/verify-llm-relay-api/"), "verify-llm-relay-api");
  assert.equal(slugOf("/posts/verify-llm-relay-api"), "verify-llm-relay-api");
  assert.equal(slugOf("/en/posts/verify-llm-relay-api/"), "verify-llm-relay-api");
  assert.equal(slugOf("/en/posts/a-1/?utm_source=x#part"), "a-1");
  assert.equal(slugOf("/posts/a-1/#top"), "a-1");
  assert.equal(slugOf(`/posts/${"a".repeat(80)}/`), "a".repeat(80));
});

test("ignores everything that is not an article page", () => {
  for (const path of [
    "",
    "/",
    "/posts/",
    "/en/posts/",
    "/posts/x/index.md",
    "/posts/x/og.png",
    "/posts/Upper/",
    "/posts/a_b/",
    "/posts/%E4%B8%AD/",
    "/zh/posts/x/",
    "/en/en/posts/x/",
    "/series/x/",
    "/posts/x/y/",
    `/posts/${"a".repeat(81)}/`,
    "posts/x/",
    "https://zhuoqidev.com/posts/x/",
  ])
    assert.equal(slugOf(path), null, path);
});

test("accepts a mainland import's pages and keeps only the known fields", () => {
  assert.deepEqual(
    validPages([
      { slug: "a", views: 3, visitors: 2, ip: "203.0.113.7" },
      { slug: "b-2", views: 1, visitors: 1 },
    ]),
    [
      { slug: "a", views: 3, visitors: 2 },
      { slug: "b-2", views: 1, visitors: 1 },
    ],
  );
  assert.deepEqual(validPages([]), []);
});

test("rejects malformed pages", () => {
  const ok = { slug: "a", views: 1, visitors: 1 };
  for (const bad of [
    null,
    "pages",
    {},
    [null],
    [{ ...ok, slug: "A" }],
    [{ ...ok, slug: "" }],
    [{ ...ok, slug: "/posts/a/" }],
    [{ ...ok, slug: "x".repeat(81) }],
    [{ ...ok, visitors: 0, views: 0 }],
    [{ ...ok, views: 1.5 }],
    [{ ...ok, views: "1" }],
    [{ ...ok, views: 1, visitors: 2 }],
    [ok, ok],
    Array.from({ length: 2001 }, (_, i) => ({ ...ok, slug: `s${i}` })),
  ])
    assert.equal(validPages(bad), null, JSON.stringify(bad)?.slice(0, 60));
});

test("counts Beijing days back", () => {
  assert.equal(daysBefore("2026-10-31", 0), "2026-10-31");
  assert.equal(daysBefore("2026-10-31", 29), "2026-10-02");
  assert.equal(daysBefore("2026-03-01", 1), "2026-02-28");
});

test("ranks articles by visitors over the last 30 days, both lines summed", () => {
  const today = "2026-10-31";
  const rows = [
    // a week of data so the list is allowed out
    ...Array.from({ length: 7 }, (_, i) => ({ day: daysBefore(today, i), slug: "steady", visitors: 2 })),
    { day: today, slug: "big-day", visitors: 10 },
    { day: "2026-10-30", slug: "big-day", visitors: 3 }, // the other line, same day
    { day: "2026-10-02", slug: "edge", visitors: 15 }, // first day of the window
    { day: "2026-10-01", slug: "too-old", visitors: 100 },
    { day: "2026-11-01", slug: "future", visitors: 100 },
    { day: today, slug: "tie-b", visitors: 1 },
    { day: today, slug: "tie-a", visitors: 1 },
    { day: today, slug: "Bad Slug", visitors: 50 },
    { day: today, slug: "zero", visitors: 0 },
  ];
  assert.deepEqual(hotSlugs(rows, today), ["edge", "steady", "big-day", "tie-a", "tie-b"]);
  assert.deepEqual(hotSlugs(rows, today, { limit: 2 }), ["edge", "steady"]);
  assert.deepEqual(hotSlugs(rows, today, { days: 7 }), ["steady", "big-day", "tie-a", "tie-b"]);
});

test("stays empty until the counts cover enough days", () => {
  const today = "2026-10-31";
  const six = Array.from({ length: 6 }, (_, i) => ({ day: daysBefore(today, i), slug: "a", visitors: 5 }));
  assert.deepEqual(hotSlugs(six, today), []);
  assert.deepEqual(hotSlugs([...six, { day: daysBefore(today, 6), slug: "b", visitors: 1 }], today), ["a", "b"]);
  // days outside the window do not count toward the minimum
  assert.deepEqual(hotSlugs([...six, { day: daysBefore(today, 40), slug: "b", visitors: 1 }], today), []);
  assert.deepEqual(hotSlugs([], today), []);
});
