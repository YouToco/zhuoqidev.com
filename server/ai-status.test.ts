import assert from "node:assert/strict";
import { test } from "node:test";
import { fromFlashduty, fromGoogle, fromStatuspage, VENDORS, VERTEX_GEMINI, worst } from "./ai-status.ts";

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
