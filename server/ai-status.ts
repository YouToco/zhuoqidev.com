// What the AI vendors' own status pages say right now, for /status/: one light per vendor, its
// components and its open incidents. Only what each vendor publishes is shown; nothing here calls a
// model. The vendor list is shared with the page (src/pages/[...lang]/status/), which prints names
// and links into the HTML; GET /api/ai-status (functions/api/ai-status.ts) adds the live part.

/** Worst last: a vendor's light is the worst of its components and open incidents. */
export const LEVELS = ["ok", "maintenance", "degraded", "partial", "major"] as const;
export type Level = (typeof LEVELS)[number];

export type Component = { name: string; level: Level };
export type Incident = {
  title: string;
  level: Level;
  /** The vendor's own word for the stage: investigating, identified, monitoring, in_progress… */
  stage: string;
  /** Latest update, as written by the vendor (not translated). */
  latest: string;
  started: string;
  updated: string;
  url: string;
  maintenance: boolean;
};
export type VendorStatus = {
  id: string;
  /** null when the status page could not be read: the page says so rather than showing a green light. */
  level: Level | null;
  components: Component[];
  incidents: Incident[];
  error?: string;
};

/**
 * `statuspage`: Atlassian Statuspage's /api/v2/summary.json (incident.io pages serve the same shape).
 * `google`: Google Cloud's incidents.json, filtered to the Gemini products.
 * `flashduty`: a Flashduty status page, read from the data inlined in its HTML.
 * `link`: no status page a program can read; the page shows a grey light and the link.
 */
export type Source = "statuspage" | "google" | "flashduty" | "link";
export type Vendor = {
  id: string;
  name: string;
  region: "intl" | "cn";
  source: Source;
  /** Where readers go: the human status page (or, without one, where the vendor posts notices). */
  page: string;
  /** What the program reads; defaults to `page`. */
  feed?: string;
  /** Why a `link` vendor has no light, or what a partial source covers (a key in the page's messages). */
  note?: "noPage" | "blocked" | "vertexOnly";
};

export const VENDORS: Vendor[] = [
  { id: "openai", name: "OpenAI", region: "intl", source: "statuspage", page: "https://status.openai.com" },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    region: "intl",
    source: "statuspage",
    page: "https://status.claude.com",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    region: "intl",
    source: "google",
    page: "https://aistudio.google.com/status",
    feed: "https://status.cloud.google.com/incidents.json",
    note: "vertexOnly",
  },
  { id: "mistral", name: "Mistral AI", region: "intl", source: "statuspage", page: "https://status.mistral.ai" },
  { id: "cohere", name: "Cohere", region: "intl", source: "statuspage", page: "https://status.cohere.com" },
  { id: "xai", name: "xAI (Grok)", region: "intl", source: "link", page: "https://status.x.ai", note: "blocked" },
  { id: "deepseek", name: "DeepSeek", region: "cn", source: "flashduty", page: "https://status.deepseek.com" },
  { id: "kimi", name: "Kimi (Moonshot AI)", region: "cn", source: "statuspage", page: "https://status.moonshot.cn" },
  { id: "minimax", name: "MiniMax", region: "cn", source: "statuspage", page: "https://status.minimaxi.com" },
  {
    id: "zhipu",
    name: "智谱 GLM (Zhipu)",
    region: "cn",
    source: "link",
    page: "https://bigmodel.cn",
    note: "noPage",
  },
  {
    id: "bailian",
    name: "阿里云百炼 (Alibaba Model Studio)",
    region: "cn",
    source: "link",
    page: "https://status.aliyun.com",
    note: "noPage",
  },
  {
    id: "ark",
    name: "火山方舟 (Volcengine Ark)",
    region: "cn",
    source: "link",
    page: "https://status.volcengine.com",
    note: "noPage",
  },
];

const rank = (l: Level) => LEVELS.indexOf(l);
export const worst = (levels: Level[]): Level => levels.reduce<Level>((a, b) => (rank(b) > rank(a) ? b : a), "ok");

// ---- Atlassian Statuspage (and incident.io's compatible endpoint) ----

type SpComponent = { id: string; name: string; status: string; group?: boolean; group_id?: string | null };
type SpUpdate = { body?: string; status?: string; created_at?: string };
type SpIncident = {
  id: string;
  name: string;
  status: string;
  impact?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  shortlink?: string;
  incident_updates?: SpUpdate[];
};
export type SpSummary = {
  page?: { url?: string };
  status?: { indicator?: string };
  components?: SpComponent[];
  incidents?: SpIncident[];
  scheduled_maintenances?: SpIncident[];
};

const SP_COMPONENT: Record<string, Level> = {
  operational: "ok",
  under_maintenance: "maintenance",
  degraded_performance: "degraded",
  partial_outage: "partial",
  major_outage: "major",
};
const SP_INDICATOR: Record<string, Level> = {
  none: "ok",
  maintenance: "maintenance",
  minor: "degraded",
  major: "partial",
  critical: "major",
};
const SP_IMPACT: Record<string, Level> = {
  none: "degraded",
  maintenance: "maintenance",
  minor: "degraded",
  major: "partial",
  critical: "major",
};

export function fromStatuspage(id: string, page: string, s: SpSummary): VendorStatus {
  const all = s.components ?? [];
  const groups = new Map(all.filter((c) => c.group).map((c) => [c.id, c.name]));
  const components = all
    .filter((c) => !c.group)
    .map((c) => {
      const group = c.group_id ? groups.get(c.group_id) : undefined;
      return { name: group ? `${group} · ${c.name}` : c.name, level: SP_COMPONENT[c.status] ?? "degraded" };
    });
  const base = (s.page?.url ?? page).replace(/\/$/, "");
  const incident = (i: SpIncident, maintenance: boolean): Incident => ({
    title: i.name,
    level: maintenance ? "maintenance" : (SP_IMPACT[i.impact ?? "none"] ?? "degraded"),
    stage: i.status,
    latest: i.incident_updates?.[0]?.body ?? "",
    started: i.started_at ?? i.created_at,
    updated: i.updated_at,
    url: i.shortlink ?? `${base}/incidents/${i.id}`,
    maintenance,
  });
  const incidents = [
    ...(s.incidents ?? [])
      .filter((i) => i.status !== "resolved" && i.status !== "postmortem")
      .map((i) => incident(i, false)),
    ...(s.scheduled_maintenances ?? []).filter((i) => i.status === "in_progress").map((i) => incident(i, true)),
  ];
  const level = worst([
    SP_INDICATOR[s.status?.indicator ?? "none"] ?? "degraded",
    ...components.map((c) => c.level),
    ...incidents.map((i) => i.level),
  ]);
  return { id, level, components, incidents };
}

// ---- Google Cloud (Gemini on Vertex AI) ----

export type GcIncident = {
  id: string;
  begin: string;
  end?: string;
  modified: string;
  external_desc: string;
  status_impact?: string;
  uri: string;
  most_recent_update?: { text?: string; status?: string };
  affected_products?: { title: string }[];
};

const GC_IMPACT: Record<string, Level> = {
  SERVICE_INFORMATION: "degraded",
  SERVICE_DISRUPTION: "partial",
  SERVICE_OUTAGE: "major",
};
const GEMINI = /gemini/i;

export function fromGoogle(id: string, list: GcIncident[]): VendorStatus {
  const open = list.filter((i) => !i.end && (i.affected_products ?? []).some((p) => GEMINI.test(p.title)));
  const incidents = open.map<Incident>((i) => ({
    title: i.external_desc,
    level: GC_IMPACT[i.status_impact ?? ""] ?? "degraded",
    stage: (i.most_recent_update?.status ?? "").toLowerCase(),
    latest: i.most_recent_update?.text ?? "",
    started: i.begin,
    updated: i.modified,
    url: `https://status.cloud.google.com/${i.uri}`,
    maintenance: false,
  }));
  const level = worst(incidents.map((i) => i.level));
  return { id, level, components: [{ name: "Vertex Gemini API", level }], incidents };
}

// ---- Flashduty (DeepSeek) ----
// The page is a Next.js app that inlines its data as `self.__next_f.push([1,"…"])` string chunks. Joined
// and unescaped, they hold the component list (`"components":[{"component_id":…}]`) and the recent
// changes (`"changes":[…]`), each change with its stage and the current status of every component it
// touches. A component is as bad as the worst open change says; one no open change touches is fine.

type FdComponent = { component_id: string; section_id?: string; name: string };
type FdChange = {
  change_id: number;
  type: string;
  title: string;
  description?: string;
  status: string;
  start_at_seconds: number;
  updates?: { at_seconds: number; description?: string }[];
  affected_components?: { component_id: string; status: string }[];
};

const FD_COMPONENT: Record<string, Level> = {
  operational: "ok",
  maintenance: "maintenance",
  degraded: "degraded",
  partial_outage: "partial",
  full_outage: "major",
};
const FD_CLOSED = new Set(["resolved", "completed", "cancelled", "scheduled"]);

/** The JSON array that starts at `from` (an index of `[`), or null when it does not close. */
function arrayAt(text: string, from: number): unknown[] | null {
  let depth = 0;
  let inString = false;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(from, i + 1)) as unknown[];
    }
  }
  return null;
}

function nextData(html: string): string {
  const chunks: string[] = [];
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g))
    chunks.push(JSON.parse(m[1] ?? '""') as string);
  return chunks.join("");
}

export function fromFlashduty(id: string, page: string, html: string): VendorStatus {
  const data = nextData(html);
  const cAt = data.indexOf('"components":[{"component_id"');
  const chAt = data.indexOf('"changes":[');
  if (cAt < 0 || chAt < 0) throw new Error("flashduty: page data not found");
  const list = (arrayAt(data, cAt + '"components":'.length) ?? []) as FdComponent[];
  const changes = (arrayAt(data, chAt + '"changes":'.length) ?? []) as FdChange[];
  if (!list.length) throw new Error("flashduty: no components");
  const open = changes.filter((c) => !FD_CLOSED.has(c.status));
  const now = new Map<string, Level>();
  const incidents = open.map<Incident>((c) => {
    const maintenance = c.type === "maintenance";
    const touched = (c.affected_components ?? []).map((a) => {
      const l = maintenance ? "maintenance" : (FD_COMPONENT[a.status] ?? "degraded");
      now.set(a.component_id, worst([now.get(a.component_id) ?? "ok", l]));
      return l;
    });
    const last = c.updates?.at(-1);
    const level = maintenance ? "maintenance" : worst(touched);
    return {
      title: c.title,
      level: level === "ok" ? "degraded" : level,
      stage: c.status,
      latest: last?.description ?? c.description ?? "",
      started: new Date(c.start_at_seconds * 1000).toISOString(),
      updated: new Date((last?.at_seconds ?? c.start_at_seconds) * 1000).toISOString(),
      url: page,
      maintenance,
    };
  });
  // Component names read "对话服务(Chat Service)"; keep them as written.
  const components = list.map((c) => ({ name: c.name, level: now.get(c.component_id) ?? "ok" }));
  return {
    id,
    level: worst([...components.map((c) => c.level), ...incidents.map((i) => i.level)]),
    components,
    incidents,
  };
}

// ---- Fetching ----

const UA = "zhuoqidev.com AI status page (+https://zhuoqidev.com/status/)";
const TIMEOUT_MS = 5000;

class HttpError extends Error {}

/** One retry when the connection itself fails: the answer is cached for a minute, so one dropped
 * connection would otherwise show "couldn't read" to every reader for that minute. */
async function read(url: string, as: "json" | "text", tries = 2): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: as === "json" ? "application/json" : "text/html" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new HttpError(`HTTP ${res.status}`);
    return as === "json" ? await res.json() : await res.text();
  } catch (e) {
    if (tries > 1 && !(e instanceof HttpError)) return read(url, as, tries - 1);
    throw e;
  }
}

export async function vendorStatus(v: Vendor): Promise<VendorStatus> {
  try {
    switch (v.source) {
      case "statuspage":
        return fromStatuspage(
          v.id,
          v.page,
          (await read(`${v.feed ?? v.page}/api/v2/summary.json`, "json")) as SpSummary,
        );
      case "google":
        return fromGoogle(v.id, (await read(v.feed ?? v.page, "json")) as GcIncident[]);
      case "flashduty":
        return fromFlashduty(v.id, v.page, (await read(v.feed ?? v.page, "text")) as string);
      case "link":
        return { id: v.id, level: null, components: [], incidents: [] };
    }
  } catch (e) {
    return { id: v.id, level: null, components: [], incidents: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function allStatus(vendors = VENDORS): Promise<{ updated: string; vendors: VendorStatus[] }> {
  return { updated: new Date().toISOString(), vendors: await Promise.all(vendors.map(vendorStatus)) };
}
