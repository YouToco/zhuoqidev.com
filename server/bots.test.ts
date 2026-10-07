// node --test server/  (Node runs the TypeScript directly)
import assert from "node:assert/strict";
import { test } from "node:test";
import { beijingDay, classify, isPageLike } from "./bots.ts";

// Real User-Agents from the mainland CDN log of 2026-10-07, plus the documented strings of the big names.
const cases: [ua: string, bot: string | null, company?: string, category?: string][] = [
  ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", "ClaudeBot", "Anthropic", "ai-crawl"],
  ["Mozilla/5.0 (Linux; Android 7.0;) AppleWebKit/537.36 (HTML, like Gecko) Mobile Safari/537.36 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)", "PetalBot", "华为", "search"],
  ["Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; https://zhanzhang.toutiao.com/)", "Bytespider", "字节跳动", "ai-crawl"],
  ["YisouSpider", "YisouSpider", "神马搜索（阿里）", "search"],
  ["User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0; 360Spider", "360Spider", "360", "search"],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; robots.txt; +https://openai.com/searchbot", "OAI-SearchBot", "OpenAI", "ai-search"],
  ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)", "ChatGPT-User", "OpenAI", "ai-user"],
  ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.3; +https://openai.com/gptbot", "GPTBot", "OpenAI", "ai-crawl"],
  ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Googlebot", "Google", "search"],
  ["Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Googlebot", "Google", "search"],
  ["Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", "Bingbot", "Microsoft", "search"],
  ["Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)", "Baiduspider", "百度", "search"],
  ["Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)", "Sogou", "搜狗（腾讯）", "search"],
  ["Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)", "AhrefsBot", "Ahrefs", "seo"],
  ["facebookexternalhit/1.1 Facebot Twitterbot/1.0", "facebookexternalhit", "Meta", "social"],
  ["TelegramBot (like TwitterBot)", "TelegramBot", "Telegram", "social"],
  ["Feedly/1.0 (+https://feedly.com/poller.html; 12 subscribers; )", "Feedly", "Feedly", "feed"],
  ["Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse", "Lighthouse", "Google", "monitor"],
  ["Mozilla/5.0 (compatible; CensysInspect/1.1; +https://about.censys.io/)", "CensysInspect", "Censys", "scanner"],
  ["curl/8.5.0", "curl", "命令行", "tool"],
  ["python-requests/2.32.3", "python-requests", "Python", "tool"],
  ["Dalvik/2.1.0 (Linux; U; Android 9.0; ZTE BA520 Build/MRA58K)", "Dalvik", "未知", "tool"],
  ["", "（空 UA）", "未知", "tool"],
  ["Mozilla/5.0 (compatible; SomeNewBot/0.1; +https://example.org/bot)", "SomeNewBot", "未知", "other"],
  // Scrapers rotating through impossible browsers
  ["Mozilla/5.0 (Macintosh; PPC Mac OS X 10_9_2) AppleWebKit/5342 (KHTML, like Gecko) Chrome/37.0.859.0 Mobile Safari/5342", "伪造浏览器标识", "未知", "fake"],
  ["Opera/9.62 (Windows NT 4.0; en-US) Presto/2.10.343 Version/12.00", "伪造浏览器标识", "未知", "fake"],
  ["Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36", "伪造浏览器标识", "未知", "fake"],
  ["Mozilla/5.0 (Windows; U; Windows NT 6.1) AppleWebKit/536.3.1 (KHTML, like Gecko) Version/5.2 Safari/536.3.1", "伪造浏览器标识", "未知", "fake"],
  ["Mozilla/5.0 (Linux; Android 9; ASUS_X00TD; Flow) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/359.0.0.288 Mobile Safari/537.36", "伪造浏览器标识", "未知", "fake"],
  // People
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36", null],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1", null],
  ["Mozilla/5.0 (Linux; U; Android 6.0.1; zh-CN; OPPO R9s Build/MMB29M) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.108 UCBrowser/12.1.0.990 Mobile Safari/537.36", null],
  ["Mozilla/5.0 (Linux; Android 13; CUBOT KingKong 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36", null],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.61(0x18003d2b) NetType/WIFI Language/zh_CN", null],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15", null],
];

test("classifies crawlers by name, company and category", () => {
  for (const [ua, bot, company, category] of cases) {
    const got = classify(ua);
    if (bot === null) assert.equal(got, null, ua);
    else assert.deepEqual(got, { bot, company, category }, ua);
  }
});

test("counts pages, feeds and text, not assets", () => {
  for (const p of ["/", "/posts/x/", "/posts/x", "/posts/x/index.md", "/llms.txt", "/robots.txt", "/index.xml", "/sitemap.xml", "/404.html"]) {
    assert.ok(isPageLike(p), p);
  }
  for (const p of ["/_astro/a.js", "/_astro/a.css", "/images/w.jpg", "/favicon.ico", "/index.json", "/wp-login.php", "/pagefind/x.pf_meta"]) {
    assert.ok(!isPageLike(p), p);
  }
});

test("days follow Beijing time", () => {
  assert.equal(beijingDay(Date.parse("2026-10-07T15:59:59Z")), "2026-10-07");
  assert.equal(beijingDay(Date.parse("2026-10-07T16:00:00Z")), "2026-10-08");
});
