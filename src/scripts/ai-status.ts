// AI vendor status page (src/pages/[...lang]/status/): the vendors, their names and links are in the
// HTML; this fetches what their status pages say now (functions/api/ai-status.ts) and lights each one.
// It refreshes every minute while the page is visible. Vendor text is set with textContent only.
import type { Incident, Level, VendorStatus } from "../../server/ai-status";
import { apiBase } from "../site";

type Msg = {
  levels: Record<Level | "unknown" | "none", string>;
  stages: Record<string, string>;
  [k: string]: unknown;
};

const EVERY_MS = 60_000;
const root = document.querySelector<HTMLElement>("[data-st]");
if (root) init(root);

function init(root: HTMLElement) {
  const lang = root.dataset.lang === "en" ? "en" : "zh";
  const M = JSON.parse(root.dataset.msg!) as Msg;
  const s = (k: string, vars: Record<string, string | number> = {}) => {
    const v = M[k];
    return (typeof v === "string" ? v : "").replace(/\{(\w+)\}/g, (_, n: string) => String(vars[n] ?? ""));
  };
  const time = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const when = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : time.format(d);
  };
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const summary = root.querySelector<HTMLElement>("[data-summary]")!;
  const updated = root.querySelector<HTMLElement>("[data-updated]")!;
  const refresh = root.querySelector<HTMLButtonElement>("[data-refresh]")!;
  let last = 0;
  let busy = false;

  const incidentItem = (i: Incident) => {
    const li = el("li", "st-incident");
    li.dataset.level = i.level;
    const head = el("p", "st-inc-head");
    const a = el("a", "", i.title);
    a.href = i.url;
    a.rel = "noopener";
    a.target = "_blank";
    head.append(el("span", "st-dot"), a);
    const meta = el(
      "p",
      "st-inc-meta",
      [
        i.maintenance ? s("maintenance") : M.levels[i.level],
        M.stages[i.stage] ?? i.stage,
        s("started", { t: when(i.started) }),
      ]
        .filter(Boolean)
        .join(" · "),
    );
    li.append(head, meta);
    if (i.latest) {
      const q = el("p", "st-inc-text", i.latest.length > 400 ? `${i.latest.slice(0, 400)}…` : i.latest);
      li.append(q);
    }
    return li;
  };

  const paint = (v: VendorStatus) => {
    const card = root.querySelector<HTMLElement>(`[data-vendor="${CSS.escape(v.id)}"]`);
    if (!card || card.dataset.level === "none") return;
    const level = v.level ?? "unknown";
    card.dataset.level = level;
    card.querySelector("[data-level-text]")!.textContent = M.levels[level];
    const headline = card.querySelector<HTMLElement>("[data-headline]")!;
    const first = v.incidents[0];
    headline.hidden = !(v.error ?? first);
    headline.textContent = v.error ? s("failedAt", { e: v.error }) : first ? first.title : "";
    const more = card.querySelector<HTMLDetailsElement>("[data-more]");
    if (!more) return;
    more.hidden = !v.components.length && !v.incidents.length;
    more.querySelector("summary")!.textContent = v.incidents.length
      ? `${s("incidents")} (${v.incidents.length}) · ${s("components")} (${v.components.length})`
      : `${s("components")} (${v.components.length})`;
    if (v.incidents.length && level !== "ok") more.open = true;
    more.querySelector("[data-incidents]")!.replaceChildren(...v.incidents.map(incidentItem));
    // Worst first, so a long list (OpenAI, Cohere) still shows its trouble at the top.
    const order: Level[] = ["major", "partial", "degraded", "maintenance", "ok"];
    const comps = [...v.components].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
    more.querySelector("[data-components]")!.replaceChildren(
      ...comps.map((c) => {
        const li = el("li");
        li.dataset.level = c.level;
        const name = el("span", "", c.name);
        li.title = M.levels[c.level];
        li.append(el("span", "st-dot"), name, el("span", "sr-only", ` — ${M.levels[c.level]}`));
        return li;
      }),
    );
  };

  const load = async () => {
    if (busy) return;
    busy = true;
    root.classList.add("loading");
    try {
      const res = await fetch(`${apiBase(location.hostname)}/api/ai-status`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { updated: string; vendors: VendorStatus[] };
      data.vendors.forEach(paint);
      const read = data.vendors.filter((v) => v.level);
      const bad = read.filter((v) => v.level !== "ok" && v.level !== "maintenance").length;
      const unread = data.vendors.filter((v) => v.error).length;
      summary.textContent = [
        bad ? s("summaryBad", { n: bad }) : s("summaryOk", { n: read.length }),
        unread > 0 ? s("summaryUnread", { n: unread }) : "",
      ]
        .filter(Boolean)
        .join(" · ");
      summary.dataset.level = bad ? "bad" : "ok";
      updated.textContent = s("updated", { t: when(data.updated) });
      last = Date.now();
    } catch {
      summary.textContent = s("loadFailed");
      summary.dataset.level = "bad";
      for (const card of root.querySelectorAll<HTMLElement>('[data-level="loading"]')) {
        card.dataset.level = "unknown";
        card.querySelector("[data-level-text]")!.textContent = M.levels.unknown;
      }
    } finally {
      busy = false;
      root.classList.remove("loading");
    }
  };

  refresh.addEventListener("click", () => void load());
  setInterval(() => {
    if (document.visibilityState === "visible") void load();
  }, EVERY_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - last > EVERY_MS) void load();
  });
  void load();
}
