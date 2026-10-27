import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fromAws,
  fromAzure,
  fromFlashduty,
  fromFlashdutyRss,
  fromGoogle,
  fromStatuspage,
  fromXai,
  VENDORS,
  VERTEX_GEMINI,
  worst,
} from "./ai-status.ts";

test("the worst level wins, and nothing at all is fine", () => {
  assert.equal(worst([]), "ok");
  assert.equal(worst(["ok", "maintenance", "degraded"]), "degraded");
  assert.equal(worst(["major", "degraded"]), "major");
});

test("every vendor has a unique id and an https link", () => {
  assert.equal(new Set(VENDORS.map((v) => v.id)).size, VENDORS.length);
  for (const v of VENDORS) assert.match(v.page, /^https:\/\//);
});

test("Statuspage: groups prefix their children, open incidents and running maintenance count", () => {
  const s = fromStatuspage("kimi", "https://status.moonshot.cn", {
    page: { url: "https://status.moonshot.cn" },
    status: { indicator: "minor" },
    components: [
      { id: "g", name: "Open API", status: "operational", group: true },
      { id: "a", name: "K3", status: "degraded_performance", group_id: "g" },
      { id: "b", name: "Website", status: "operational" },
    ],
    incidents: [
      {
        id: "i1",
        name: "Elevated errors on K3",
        status: "investigating",
        impact: "minor",
        created_at: "2026-10-27T01:00:00Z",
        updated_at: "2026-10-27T01:10:00Z",
        incident_updates: [{ body: "We are looking into it." }],
      },
      { id: "i0", name: "Old one", status: "resolved", impact: "major", created_at: "x", updated_at: "x" },
    ],
    scheduled_maintenances: [
      { id: "m1", name: "DB upgrade", status: "scheduled", created_at: "x", updated_at: "x" },
      { id: "m2", name: "Network work", status: "in_progress", created_at: "y", updated_at: "y" },
    ],
  });
  assert.equal(s.level, "degraded");
  assert.deepEqual(s.components, [
    { name: "Open API · K3", level: "degraded" },
    { name: "Website", level: "ok" },
  ]);
  assert.deepEqual(
    s.incidents.map((i) => [i.title, i.level, i.maintenance, i.url]),
    [
      ["Elevated errors on K3", "degraded", false, "https://status.moonshot.cn/incidents/i1"],
      ["Network work", "maintenance", true, "https://status.moonshot.cn/incidents/m2"],
    ],
  );
  assert.equal(s.incidents[0]?.latest, "We are looking into it.");
});

test("Statuspage: a major outage on one component turns the light red", () => {
  const s = fromStatuspage("openai", "https://status.openai.com", {
    status: { indicator: "none" },
    components: [{ id: "a", name: "Responses", status: "major_outage" }],
  });
  assert.equal(s.level, "major");
});

test("Google: only open incidents that touch Vertex Gemini API, matched by product id", () => {
  const base = {
    modified: "2026-10-27T02:00:00Z",
    uri: "incidents/abc",
    affected_products: [{ title: "Gemini on Agent Platform", id: VERTEX_GEMINI }],
  };
  const s = fromGoogle("gemini", [
    { ...base, id: "1", begin: "2026-10-27T01:00:00Z", external_desc: "Errors", status_impact: "SERVICE_DISRUPTION" },
    { ...base, id: "2", begin: "2026-10-20T01:00:00Z", end: "2026-10-20T02:00:00Z", external_desc: "Closed" },
    {
      ...base,
      id: "3",
      begin: "2026-10-27T01:00:00Z",
      external_desc: "BigQuery",
      affected_products: [{ title: "BigQuery", id: "x" }],
    },
    {
      ...base,
      id: "4",
      begin: "2026-10-27T01:00:00Z",
      external_desc: "Gemini Enterprise",
      affected_products: [{ title: "Gemini Enterprise", id: "cxUh24jPxEXgyRlaVhuk" }],
    },
  ]);
  assert.equal(s.level, "partial");
  assert.deepEqual(
    s.incidents.map((i) => [i.title, i.url]),
    [["Errors", "https://status.cloud.google.com/incidents/abc"]],
  );
  assert.equal(fromGoogle("gemini", []).level, "ok");
});

// A Flashduty page as the browser gets it: the data split over several inline script chunks.
const flashduty = (data: unknown) => {
  const text = `x:{"components":${JSON.stringify((data as { components: unknown }).components)}},y:{"initialCalendarData":{"changes":${JSON.stringify((data as { changes: unknown }).changes)}}}`;
  const half = Math.floor(text.length / 2);
  return [text.slice(0, half), text.slice(half)]
    .map((c) => `<script>self.__next_f.push([1,${JSON.stringify(c)}])</script>`)
    .join("");
};

test("Flashduty: open changes set their components, closed ones do not", () => {
  const html = flashduty({
    components: [
      { component_id: "api", name: "API服务(API Service)" },
      { component_id: "chat", name: "对话服务(Chat Service)" },
    ],
    changes: [
      {
        change_id: 2,
        type: "incident",
        title: "对话服务异常（Chat error）",
        status: "investigating",
        start_at_seconds: 1_792_000_000,
        updates: [{ at_seconds: 1_792_000_100, description: "正在排查" }],
        affected_components: [{ component_id: "chat", status: "partial_outage" }],
      },
      {
        change_id: 1,
        type: "incident",
        title: "Old",
        status: "resolved",
        start_at_seconds: 1_791_000_000,
        affected_components: [{ component_id: "api", status: "full_outage" }],
      },
    ],
  });
  const s = fromFlashduty("deepseek", "https://status.deepseek.com", html);
  assert.equal(s.level, "partial");
  assert.deepEqual(s.components, [
    { name: "API服务(API Service)", level: "ok" },
    { name: "对话服务(Chat Service)", level: "partial" },
  ]);
  assert.equal(s.incidents.length, 1);
  assert.equal(s.incidents[0]?.latest, "正在排查");
});

test("Flashduty: a page without the data is an error, not a green light", () => {
  assert.throws(() => fromFlashduty("deepseek", "https://status.deepseek.com", "<html></html>"));
});

// ---- RSS sources ----

const rss = (items: string[], built = "Tue, 27 Oct 2026 07:30:00 GMT") =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><lastBuildDate>${built}</lastBuildDate>${items
    .map((i) => `<item>${i}</item>`)
    .join("")}</channel></rss>`;
const NOW = Date.parse("2026-10-27T08:00:00Z");

test("xAI: only open API items count, Cursor and resolved items do not", () => {
  const update = (stage: string, text: string) =>
    `<div><p><strong>Tue, 27 Oct 2026 07:10:00 GMT</strong></p><h3>${stage}</h3><p>${text}</p></div>`;
  const s = fromXai(
    "xai",
    rss([
      `<title>[Global (api.x.ai)] Elevated errors</title><link>https://status.x.ai/api-global/a</link><description><![CDATA[<h3>Status: INVESTIGATING</h3><p>Severity: outage</p>${update("Investigating", "Looking into it")}]]></description><pubDate>Tue, 27 Oct 2026 07:00:00 GMT</pubDate><category>outage</category>`,
      `<title>[cursor.com] Payment issues</title><link>x</link><description><![CDATA[<h3>Status: INVESTIGATING</h3>]]></description><pubDate>Tue, 27 Oct 2026 07:00:00 GMT</pubDate><category>disruption</category>`,
      `<title>[US (us.api.x.ai)] Old one</title><link>x</link><description><![CDATA[<h3>Status: RESOLVED</h3>]]></description><pubDate>Mon, 26 Oct 2026 07:00:00 GMT</pubDate><category>disruption</category><category>resolved</category>`,
    ]),
    NOW,
  );
  assert.equal(s.level, "major");
  assert.deepEqual(s.components, [
    { name: "Global (api.x.ai)", level: "major" },
    { name: "US (us.api.x.ai)", level: "ok" },
  ]);
  assert.equal(s.incidents.length, 1);
  assert.equal(s.incidents[0]?.stage, "investigating");
  assert.equal(s.incidents[0]?.latest, "Looking into it");
  assert.equal(s.incidents[0]?.updated, "2026-10-27T07:10:00.000Z");
});

test("xAI: an item left open for over a week is ignored", () => {
  const s = fromXai(
    "xai",
    rss([
      `<title>[Global (api.x.ai)] Forgotten</title><link>x</link><description><![CDATA[<h3>Status: INVESTIGATING</h3>]]></description><pubDate>Tue, 06 Oct 2026 07:00:00 GMT</pubDate><category>outage</category>`,
    ]),
    NOW,
  );
  assert.equal(s.level, "ok");
});

test("AWS: an event is open until its resolved item; empty feeds are fine", () => {
  const item = (title: string, date: string) =>
    `<title type="text">${title}</title><link>https://status.aws.amazon.com/</link><pubDate>${date}</pubDate><description>Details</description>`;
  const s = fromAws(
    "bedrock",
    [
      {
        region: "us-east-1",
        xml: rss([item("Informational message: Increased Error Rates", "Tue, 27 Oct 2026 00:10:00 PDT")]),
      },
      {
        region: "us-west-2",
        xml: rss([
          item("Service is operating normally: [RESOLVED] Increased Latency", "Tue, 27 Oct 2026 00:20:00 PDT"),
          item("Increased Latency", "Tue, 27 Oct 2026 00:05:00 PDT"),
        ]),
      },
      { region: "eu-west-1", xml: rss([]) },
    ],
    NOW,
  );
  assert.equal(s.level, "degraded");
  assert.deepEqual(
    s.components.map((c) => [c.name, c.level]),
    [
      ["us-east-1", "degraded"],
      ["us-west-2", "ok"],
      ["eu-west-1", "ok"],
    ],
  );
  assert.equal(s.incidents[0]?.title, "us-east-1: Informational message: Increased Error Rates");
});

test("Azure: only items about Azure OpenAI / AI Foundry", () => {
  const s = fromAzure(
    "azure-openai",
    "https://azure.status.microsoft/en-us/status",
    rss([
      `<title>Azure OpenAI Service - Degraded performance in East US</title><link>https://azure.status.microsoft/x</link><description>Customers may see errors</description><pubDate>Tue, 27 Oct 2026 07:00:00 Z</pubDate>`,
      `<title>Virtual Machines - Outage in West Europe</title><link>y</link><description>VMs</description><pubDate>Tue, 27 Oct 2026 07:00:00 Z</pubDate>`,
    ]),
    NOW,
  );
  assert.equal(s.level, "degraded");
  assert.equal(s.incidents.length, 1);
  assert.equal(fromAzure("a", "p", rss([]), NOW).level, "ok");
});

test("Flashduty RSS fallback: open items with their affected components", () => {
  const desc = (status: string) =>
    `&lt;p&gt;&lt;strong&gt;Status:&lt;/strong&gt; ${status}&lt;/p&gt;&lt;p&gt;正在排查&lt;/p&gt;&lt;p&gt;&lt;strong&gt;Affected components:&lt;/strong&gt; DeepSeek V4 Pro API服务(API Service)&lt;/p&gt;`;
  const s = fromFlashdutyRss(
    "deepseek",
    rss([
      `<title>DeepSeek API 性能下降</title><link>https://status.deepseek.com/incidents/2</link><description>${desc("investigating")}</description><pubDate>Tue, 27 Oct 2026 15:07:39 +0800</pubDate>`,
      `<title>Old</title><link>x</link><description>${desc("resolved")}</description><pubDate>Mon, 26 Oct 2026 15:07:39 +0800</pubDate>`,
    ]),
    NOW,
  );
  assert.equal(s.level, "degraded");
  assert.deepEqual(s.components, [{ name: "DeepSeek V4 Pro API服务(API Service)", level: "degraded" }]);
  assert.equal(s.incidents[0]?.latest, "正在排查");
  assert.equal(s.incidents[0]?.url, "https://status.deepseek.com/incidents/2");
});

test("RSS: something that is not a feed is an error", () => {
  assert.throws(() => fromXai("xai", "<html>blocked</html>", NOW));
});
