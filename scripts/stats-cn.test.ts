import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregate, aggregateVisits, crawlerHit, viewHit } from "./stats-cn.ts";

// Aliyun CDN log lines (addresses replaced with documentation ranges).
const log = (time: string, url: string, ua: string, type = "text/html", ip = "203.0.113.7") =>
  `[${time} +0800] ${ip} - 12 "-" "GET ${url}" 200 512 20480 HIT "${ua}" "${type}" 198.51.100.9`;
const claude =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)";
const person =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

test("counts crawler page requests of the given Beijing day", () => {
  const lines = [
    log("7/Oct/2026:12:52:11", "https://zhuoqidev.com/posts/x/", claude),
    log("7/Oct/2026:12:52:12", "https://zhuoqidev.com/posts/x/index.md", claude, "text/markdown"),
    log("7/Oct/2026:23:59:59", "https://www.zhuoqidev.com/robots.txt", claude, "text/plain"),
    log("7/Oct/2026:12:52:13", "https://zhuoqidev.com/_astro/a.css", claude, "text/css"), // asset
    log("8/Oct/2026:00:00:01", "https://zhuoqidev.com/", claude), // next day
    log("7/Oct/2026:12:53:00", "https://zhuoqidev.com/", person), // a person
    log("7/Oct/2026:12:54:00", "https://zhuoqidev.com/?q=%22x%22", "curl/8.5.0"),
    "garbage",
  ];
  assert.deepEqual(aggregate(lines, "2026-10-07"), [
    { bot: "ClaudeBot", company: "Anthropic", category: "ai-crawl", hits: 3 },
    { bot: "curl", company: "命令行", category: "tool", hits: 1 },
  ]);
  assert.equal(crawlerHit(log("7/Oct/2026:01:00:00", "https://zhuoqidev.com/", claude), "2026-10-06"), null);
});

test("counts people's /hit.gif requests by place, one visitor per IP and browser", () => {
  const phone =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
  const hit = (time: string, ua: string, ip: string) => log(time, "https://zhuoqidev.com/hit.gif", ua, "image/gif", ip);
  const lines = [
    hit("7/Oct/2026:09:00:00", person, "203.0.113.7"),
    hit("7/Oct/2026:09:05:00", person, "203.0.113.7"), // same visitor, second page
    hit("7/Oct/2026:09:06:00", phone, "203.0.113.7"), // same IP, another browser
    hit("7/Oct/2026:10:00:00", person, "2001:db8::1"),
    hit("7/Oct/2026:11:00:00", person, "192.0.2.1"),
    hit("7/Oct/2026:11:00:01", claude, "203.0.113.8"), // a crawler that runs scripts
    log("7/Oct/2026:11:00:02", "https://zhuoqidev.com/posts/x/", person, "text/html", "203.0.113.9"), // a page, not the signal
    hit("8/Oct/2026:00:00:01", person, "203.0.113.7"), // next day
  ];
  const places: Record<string, { country: string; region: string; city: string }> = {
    "203.0.113.7": { country: "CN", region: "广东省", city: "深圳市" },
    "2001:db8::1": { country: "CN", region: "广东省", city: "深圳市" },
    "192.0.2.1": { country: "US", region: "California", city: "San Jose" },
  };
  const seen: string[] = [];
  const locate = (ip: string) => (seen.push(ip), places[ip]!);
  assert.deepEqual(aggregateVisits(lines, "2026-10-07", locate), [
    { country: "CN", region: "广东省", city: "深圳市", views: 4, visitors: 3 },
    { country: "US", region: "California", city: "San Jose", views: 1, visitors: 1 },
  ]);
  assert.deepEqual(seen.sort(), ["192.0.2.1", "2001:db8::1", "203.0.113.7", "203.0.113.7"]);
  assert.equal(viewHit(hit("7/Oct/2026:09:00:00", person, "203.0.113.7"), "2026-10-07"), `203.0.113.7|${person}`);
  // The signal itself is not a page, so a crawler fetching it is not counted as a crawler visit either.
  assert.equal(crawlerHit(hit("7/Oct/2026:11:00:01", claude, "203.0.113.8"), "2026-10-07"), null);
});

test("caps one visitor's views like the beacon does", () => {
  const lines = Array.from({ length: 400 }, () =>
    log("7/Oct/2026:09:00:00", "https://zhuoqidev.com/hit.gif", person, "image/gif"),
  );
  assert.deepEqual(
    aggregateVisits(lines, "2026-10-07", () => ({ country: "CN", region: "", city: "" })),
    [{ country: "CN", region: "", city: "", views: 300, visitors: 1 }],
  );
});
