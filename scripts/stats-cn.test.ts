import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregate, crawlerHit } from "./stats-cn.ts";

// Aliyun CDN log lines (addresses replaced with documentation ranges).
const log = (time: string, url: string, ua: string, type = "text/html") =>
  `[${time} +0800] 203.0.113.7 - 12 "-" "GET ${url}" 200 512 20480 HIT "${ua}" "${type}" 198.51.100.9`;
const claude = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)";
const person = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

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
