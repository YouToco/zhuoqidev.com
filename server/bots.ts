// Which crawler is this? A User-Agent classifier shared by the Pages middleware (overseas line,
// live) and scripts/stats-cn.ts (mainland line, from Aliyun CDN logs). It has no dependencies so
// Node can run it directly. A User-Agent is self-reported: a scraper can claim to be Googlebot.
// Obviously impossible ones (a PowerPC Mac running mobile Chrome) are filed as "fake".

export const CATEGORIES = {
  "ai-user": "AI 助手替用户打开",
  "ai-search": "AI 搜索索引",
  "ai-crawl": "AI 训练抓取",
  search: "搜索引擎",
  seo: "SEO / 营销工具",
  social: "社交链接预览",
  feed: "RSS 阅读器",
  monitor: "测速 / 探活",
  scanner: "漏洞 / 资产扫描",
  tool: "脚本 / 命令行",
  fake: "伪造浏览器标识",
  other: "其他爬虫",
} as const;

export type Category = keyof typeof CATEGORIES;
export type Crawler = { bot: string; company: string; category: Category };

type Rule = [pattern: RegExp, bot: string, company: string];

// Checked in order, so a specific name always wins over a generic one.
const RULES: Record<Exclude<Category, "fake" | "other">, Rule[]> = {
  "ai-user": [
    [/ChatGPT-User/i, "ChatGPT-User", "OpenAI"],
    [/Claude-User/i, "Claude-User", "Anthropic"],
    [/Claude-Web/i, "Claude-Web", "Anthropic"],
    [/Perplexity-User/i, "Perplexity-User", "Perplexity"],
    [/MistralAI-User/i, "MistralAI-User", "Mistral AI"],
    [/meta-externalfetcher/i, "meta-externalfetcher", "Meta"],
  ],
  "ai-search": [
    [/OAI-SearchBot/i, "OAI-SearchBot", "OpenAI"],
    [/Claude-SearchBot/i, "Claude-SearchBot", "Anthropic"],
    [/PerplexityBot/i, "PerplexityBot", "Perplexity"],
    [/DuckAssistBot/i, "DuckAssistBot", "DuckDuckGo"],
    [/YouBot/i, "YouBot", "You.com"],
    [/PhindBot/i, "PhindBot", "Phind"],
    [/iaskspider/i, "iAskSpider", "iAsk"],
  ],
  "ai-crawl": [
    [/GPTBot/i, "GPTBot", "OpenAI"],
    [/ClaudeBot/i, "ClaudeBot", "Anthropic"],
    [/anthropic-ai/i, "anthropic-ai", "Anthropic"],
    [/CCBot/i, "CCBot", "Common Crawl"],
    [/Bytespider/i, "Bytespider", "字节跳动"],
    [/TikTokSpider/i, "TikTokSpider", "字节跳动"],
    [/meta-externalagent/i, "meta-externalagent", "Meta"],
    [/FacebookBot/i, "FacebookBot", "Meta"],
    [/Amazonbot/i, "Amazonbot", "Amazon"],
    [/PanguBot/i, "PanguBot", "华为"],
    [/ChatGLM-Spider/i, "ChatGLM-Spider", "智谱"],
    [/Google-CloudVertexBot/i, "Google-CloudVertexBot", "Google"],
    [/cohere-(ai|training-data-crawler)/i, "cohere-ai", "Cohere"],
    [/AI2Bot/i, "AI2Bot", "Allen Institute for AI"],
    [/Diffbot/i, "Diffbot", "Diffbot"],
    [/ImagesiftBot/i, "ImagesiftBot", "Hive"],
    [/omgili/i, "Omgilibot", "Webz.io"],
    [/Timpibot/i, "Timpibot", "Timpi"],
    [/Kangaroo Bot/i, "Kangaroo Bot", "Kangaroo LLM"],
  ],
  seo: [
    [/AhrefsBot|AhrefsSiteAudit/i, "AhrefsBot", "Ahrefs"],
    [/SemrushBot|SiteAuditBot/i, "SemrushBot", "Semrush"],
    [/MJ12bot/i, "MJ12bot", "Majestic"],
    [/DotBot|rogerbot/i, "DotBot", "Moz"],
    [/DataForSeoBot/i, "DataForSeoBot", "DataForSEO"],
    [/BLEXBot/i, "BLEXBot", "WebMeUp"],
    [/serpstatbot/i, "serpstatbot", "Serpstat"],
    [/Barkrowler/i, "Barkrowler", "Babbar"],
    [/Screaming Frog/i, "Screaming Frog", "Screaming Frog"],
    [/SEOkicks/i, "SEOkicks", "SEOkicks"],
    [/MegaIndex/i, "MegaIndex", "MegaIndex"],
    [/AwarioBot|AwarioSmartBot/i, "AwarioBot", "Awario"],
    [/ZoominfoBot/i, "ZoominfoBot", "ZoomInfo"],
  ],
  social: [
    [/facebookexternalhit|facebookcatalog/i, "facebookexternalhit", "Meta"],
    [/WhatsApp\//i, "WhatsApp", "Meta"],
    [/TelegramBot/i, "TelegramBot", "Telegram"],
    [/Twitterbot/i, "Twitterbot", "X"],
    [/Slackbot|Slack-ImgProxy/i, "Slackbot", "Slack"],
    [/Discordbot/i, "Discordbot", "Discord"],
    [/LinkedInBot/i, "LinkedInBot", "LinkedIn"],
    [/redditbot/i, "redditbot", "Reddit"],
    [/Pinterest/i, "Pinterestbot", "Pinterest"],
    [/Bluesky Cardyb/i, "Bluesky Cardyb", "Bluesky"],
    [/Mastodon\//i, "Mastodon", "Mastodon（联邦宇宙）"],
    [/SkypeUriPreview/i, "SkypeUriPreview", "Microsoft"],
    [/Google-PageRenderer/i, "Google-PageRenderer", "Google"],
    [/Embedly/i, "Embedly", "Embedly"],
    [/Iframely/i, "Iframely", "Iframely"],
    [/vkShare/i, "vkShare", "VK"],
  ],
  feed: [
    [/FeedFetcher-Google/i, "FeedFetcher-Google", "Google"],
    [/Feedly/i, "Feedly", "Feedly"],
    [/Inoreader/i, "Inoreader", "Inoreader"],
    [/NewsBlur/i, "NewsBlur", "NewsBlur"],
    [/Feedbin/i, "Feedbin", "Feedbin"],
    [/FreshRSS/i, "FreshRSS", "FreshRSS（自建）"],
    [/Miniflux/i, "Miniflux", "Miniflux（自建）"],
    [/Tiny Tiny RSS/i, "Tiny Tiny RSS", "Tiny Tiny RSS（自建）"],
    [/NetNewsWire/i, "NetNewsWire", "NetNewsWire"],
    [/\bFolo\/|\bFollow\//i, "Folo", "Folo"],
    [/Feedspot/i, "Feedspot", "Feedspot"],
    [/theoldreader/i, "The Old Reader", "The Old Reader"],
    [/Reeder\//i, "Reeder", "Reeder"],
  ],
  monitor: [
    [/Chrome-Lighthouse|Google Page Speed/i, "Lighthouse", "Google"],
    [/\bPTST\//, "WebPageTest", "Catchpoint"],
    [/GTmetrix/i, "GTmetrix", "GTmetrix"],
    [/UptimeRobot/i, "UptimeRobot", "UptimeRobot"],
    [/Pingdom/i, "Pingdom", "SolarWinds"],
    [/StatusCake/i, "StatusCake", "StatusCake"],
    [/Site24x7/i, "Site24x7", "Zoho"],
    [/Better ?Uptime|BetterStack/i, "Better Stack", "Better Stack"],
    [/Uptime-Kuma/i, "Uptime Kuma", "Uptime Kuma（自建）"],
    [/Checkly/i, "Checkly", "Checkly"],
    [/HetrixTools/i, "HetrixTools", "HetrixTools"],
    [/Cloudflare-Healthchecks/i, "Cloudflare-Healthchecks", "Cloudflare"],
  ],
  scanner: [
    [/CensysInspect/i, "CensysInspect", "Censys"],
    [/Expanse/i, "Expanse", "Palo Alto Networks"],
    [/Palo Alto Networks/i, "Palo Alto Networks", "Palo Alto Networks"],
    [/InternetMeasurement/i, "InternetMeasurement", "Driftnet"],
    [/l9explore|l9tcpid|LeakIX/i, "LeakIX", "LeakIX"],
    [/ModatScanner/i, "ModatScanner", "Modat"],
    [/BitSightBot/i, "BitSightBot", "BitSight"],
    [/NetcraftSurveyAgent/i, "Netcraft", "Netcraft"],
    [/zgrab/i, "zgrab", "ZGrab"],
    [/Nuclei/i, "Nuclei", "ProjectDiscovery"],
    [/masscan/i, "masscan", "masscan"],
    [/Nmap/i, "Nmap", "Nmap"],
    [/sqlmap/i, "sqlmap", "sqlmap"],
    [/WPScan/i, "WPScan", "WPScan"],
    [/Nikto/i, "Nikto", "Nikto"],
  ],
  search: [
    [/Googlebot/i, "Googlebot", "Google"],
    [/Google-InspectionTool/i, "Google-InspectionTool", "Google"],
    [/GoogleOther/i, "GoogleOther", "Google"],
    [/Storebot-Google/i, "Storebot-Google", "Google"],
    [/AdsBot-Google|Mediapartners-Google/i, "AdsBot-Google", "Google"],
    [/bingbot|BingPreview|msnbot|adidxbot/i, "Bingbot", "Microsoft"],
    [/Baiduspider/i, "Baiduspider", "百度"],
    [/YandexBot|Yandex[A-Za-z]*Bot|YandexImages/i, "YandexBot", "Yandex"],
    [/Sogou/i, "Sogou", "搜狗（腾讯）"],
    [/360Spider|HaosouSpider/i, "360Spider", "360"],
    [/YisouSpider/i, "YisouSpider", "神马搜索（阿里）"],
    [/PetalBot|AspiegelBot/i, "PetalBot", "华为"],
    [/Applebot/i, "Applebot", "Apple"],
    [/DuckDuckBot/i, "DuckDuckBot", "DuckDuckGo"],
    [/\bYeti\//, "Yeti", "Naver"],
    [/SeznamBot/i, "SeznamBot", "Seznam"],
    [/Qwantbot|Qwantify/i, "Qwantbot", "Qwant"],
    [/MojeekBot/i, "MojeekBot", "Mojeek"],
    [/coccocbot/i, "coccocbot", "Cốc Cốc"],
    [/Seekport/i, "Seekport", "Seekport"],
    [/Yahoo! Slurp/i, "Yahoo Slurp", "Yahoo"],
  ],
  tool: [
    [/^curl\//i, "curl", "命令行"],
    [/^Wget\//i, "Wget", "命令行"],
    [/HTTPie/i, "HTTPie", "命令行"],
    [/python-requests/i, "python-requests", "Python"],
    [/python-httpx/i, "httpx", "Python"],
    [/aiohttp/i, "aiohttp", "Python"],
    [/Python-urllib/i, "urllib", "Python"],
    [/Scrapy/i, "Scrapy", "Python"],
    [/Go-http-client/i, "Go-http-client", "Go"],
    [/colly/i, "colly", "Go"],
    [/^node$|node-fetch|undici|axios/i, "Node.js", "Node.js"],
    [/^Deno\//i, "Deno", "Deno"],
    [/^Bun\//i, "Bun", "Bun"],
    [/okhttp/i, "okhttp", "Java"],
    [/Apache-HttpClient/i, "Apache-HttpClient", "Java"],
    [/^Java\//i, "Java", "Java"],
    [/reqwest/i, "reqwest", "Rust"],
    [/GuzzleHttp/i, "Guzzle", "PHP"],
    [/libwww-perl/i, "libwww-perl", "Perl"],
    [/^Ruby|Faraday/i, "Ruby", "Ruby"],
    [/^Dart\//i, "Dart", "Dart"],
    [/HeadlessChrome/i, "HeadlessChrome", "无头浏览器"],
    [/PhantomJS/i, "PhantomJS", "无头浏览器"],
    [/PostmanRuntime/i, "Postman", "Postman"],
    [/insomnia/i, "Insomnia", "Kong"],
  ],
};

// Browsers that cannot exist: long-dead platforms, versions from far in the future, or desktop
// systems sending a phone browser's tokens. Old Chrome on Android stays a person: Chinese phones
// without Google Play keep the WebView they shipped with (Chrome 57 inside UC Browser is real).
const FAKE = [
  /Windows NT [1-5]\.\d/,
  /Windows (95|98|ME|CE)\b|Win9[58]\b/,
  /\bOpera\/\d.*Presto\//,
  /PPC Mac OS X/,
  /MSIE [1-9]\./,
  /^(?!.*Android).*\bChrome\/[1-6]?\d\./,
  /\bChrome\/[2-9]\d\d\./,
  /\bFirefox\/[1-4]?\d\./,
  /(Windows NT|Macintosh|X11).*Mobile Safari/,
  /Windows.*Version\/[\d.]+ Safari/,
];

const GENERIC = /([A-Za-z][\w.-]{0,30}?(?:bot|spider|crawler|crawl|scraper|archiver))\b/i;
const NOT_A_BOT = /cubot/i; // a phone brand: "Linux; Android 11; CUBOT X30"

/** null means "looks like a person's browser"; a real visit is confirmed by the page's beacon. */
export function classify(userAgent: string | null | undefined): Crawler | null {
  const ua = (userAgent ?? "").trim();
  if (!ua || ua === "-") return { bot: "（空 UA）", company: "未知", category: "tool" };
  for (const [category, rules] of Object.entries(RULES) as [Category, Rule[]][]) {
    for (const [pattern, bot, company] of rules) if (pattern.test(ua)) return { bot, company, category };
  }
  if (FAKE.some((p) => p.test(ua))) return { bot: "伪造浏览器标识", company: "未知", category: "fake" };
  const generic = NOT_A_BOT.test(ua) ? null : GENERIC.exec(ua);
  if (generic) return { bot: generic[1]!.slice(0, 40), company: "未知", category: "other" };
  if (!/^Mozilla\//.test(ua) && !/^Opera\//.test(ua)) return { bot: ua.split(/[\s/;(]/)[0]!.slice(0, 40) || "（未知）", company: "未知", category: "tool" };
  return null;
}

/** Pages, Markdown twins, feeds and text files; not images, scripts, styles or fonts. */
export function isPageLike(pathname: string): boolean {
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  const dot = last.lastIndexOf(".");
  return dot < 0 || /^(html?|md|txt|xml)$/i.test(last.slice(dot + 1));
}

/** The calendar day in Beijing time (UTC+8, no daylight saving), as YYYY-MM-DD. */
export function beijingDay(at: Date | number = Date.now()): string {
  return new Date(+at + 8 * 3600_000).toISOString().slice(0, 10);
}
