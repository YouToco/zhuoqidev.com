// Visitor map page (src/pages/[...lang]/visitors/): fetches the public counts (functions/api/stats.ts),
// fills in the numbers, lists and charts, and after the reader's first scroll, tap or mouse move
// swaps the two placeholders for the 3D globe and map of China. Waiting for that input keeps
// three.js out of the page's first load, as on the Argus page.
import { PROVINCES } from "../../server/regions";
import { apiBase } from "../site";
import type { ChinaScene } from "./visitors-china";
import type { GlobeScene } from "./visitors-globe";

type Visits = { views: number; visitors: number };
type Stats = {
  range: { key: string; from: string; to: string };
  since: string | null;
  cnLatestDay: string | null;
  updated: string;
  totals: Visits & { countries: number; crawlers: number };
  countries: ({ code: string } & Visits)[];
  provinces: ({ adcode: number } & Visits)[];
  chinaElsewhere: Visits;
  crawlers: {
    categories: { key: string; hits: number }[];
    bots: { bot: string; company: string; category: string; cf: number; cn: number }[];
    rest: number;
  };
  days: { day: string; views: number; visitors: number; crawlers: number }[];
};
type Msg = {
  kpi: Record<string, string>;
  regionNames: Record<string, string>;
  botNames: Record<string, string>;
  cats: Record<string, string>;
  [k: string]: unknown;
};
/** What a hovered (or tapped) bar or province says. */
export type Tip = { title: string; visitors: number; views: number };

const KEY = "zq-vis-range";
const root = document.querySelector<HTMLElement>("[data-vis]");
if (root) {
  const go = () => setTimeout(() => init(root));
  if (document.readyState === "complete") go();
  else addEventListener("load", go, { once: true });
}

function init(root: HTMLElement) {
  const lang = root.dataset.lang === "en" ? "en" : "zh";
  const locale = lang === "zh" ? "zh-CN" : "en";
  const M = JSON.parse(root.dataset.msg!) as Msg;
  const s = (k: string) => String(M[k] ?? "");
  const num = new Intl.NumberFormat(locale);
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const status = $<HTMLElement>("[data-status]");
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  let regions: Intl.DisplayNames | null = null;
  try {
    regions = new Intl.DisplayNames([locale], { type: "region" });
  } catch {}
  const countryName = (code: string) => {
    if (code === "XX") return s("unknown");
    try {
      return M.regionNames[code] ?? regions?.of(code) ?? code;
    } catch {
      return code;
    }
  };
  const provinceName = new Map(PROVINCES.map((p) => [p.adcode, lang === "zh" ? p.zh : p.en]));

  const range0 = (() => {
    try {
      return localStorage.getItem(KEY) ?? "30";
    } catch {
      return "30";
    }
  })();
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-range]")];
  let range = buttons.some((b) => b.dataset.range === range0) ? range0 : "30";
  let data: Stats | null = null;
  let globe: GlobeScene | null = null;
  let china: ChinaScene | null = null;

  // A ranked list with a bar behind each row, as wide as its share of the top row.
  function list(target: HTMLElement, rows: { name: string; visitors: number; views: number }[]) {
    const max = Math.max(1, ...rows.map((r) => r.visitors));
    target.replaceChildren(
      ...(rows.length
        ? rows.map((r) => {
            const li = el("li");
            li.style.setProperty("--w", `${(r.visitors / max) * 100}%`);
            li.append(el("span", "n", r.name), el("span", "v", num.format(r.visitors)));
            li.title = `${num.format(r.visitors)} ${s("visitorsUnit")} · ${num.format(r.views)} ${s("viewsUnit")}`;
            return li;
          })
        : [el("li", "none", s("empty"))]),
    );
  }

  function render(d: Stats) {
    for (const k of ["views", "visitors", "countries", "crawlers"] as const) $(`[data-kpi="${k}"]`).textContent = num.format(d.totals[k]);

    const countries = d.countries.map((c) => ({ ...c, name: countryName(c.code) }));
    list($("[data-list=countries]"), countries.slice(0, 15));
    const provinces = d.provinces.map((p) => ({ ...p, name: provinceName.get(p.adcode) ?? String(p.adcode) }));
    list($("[data-list=provinces]"), [
      ...provinces,
      ...(d.chinaElsewhere.visitors ? [{ ...d.chinaElsewhere, name: s("chinaElsewhere") }] : []),
    ]);

    const catMax = Math.max(1, ...d.crawlers.categories.map((c) => c.hits));
    $("[data-cats]").replaceChildren(
      ...(d.crawlers.categories.length
        ? d.crawlers.categories.map((c) => {
            const li = el("li", c.key === "fake" ? "fake" : "");
            li.style.setProperty("--w", `${(c.hits / catMax) * 100}%`);
            li.append(el("span", "n", M.cats[c.key] ?? c.key), el("span", "v", num.format(c.hits)));
            return li;
          })
        : [el("li", "none", s("empty"))]),
    );
    const cell = (n: number) => el("td", "v", n ? num.format(n) : "–");
    const rows = d.crawlers.bots.map((b) => {
      const tr = el("tr");
      tr.append(el("td", "", M.botNames[b.bot] ?? b.bot), el("td", "co", M.botNames[b.company] ?? b.company), cell(b.cf), cell(b.cn));
      return tr;
    });
    if (d.crawlers.rest) {
      const tr = el("tr", "rest");
      const td = el("td", "", s("rest"));
      td.colSpan = 2;
      tr.append(td, el("td", "v", num.format(d.crawlers.rest)), el("td"));
      rows.push(tr);
    }
    $("[data-bots]").replaceChildren(...rows);

    days(d);

    const notes = [
      d.since && s("since").replace("{d}", d.since),
      d.cnLatestDay && s("cnLatest").replace("{d}", d.cnLatestDay),
      s("updated").replace("{t}", new Date(d.updated).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })),
    ].filter(Boolean);
    $("[data-since]").textContent = notes.join(" · ");

    globe?.update(countries);
    china?.update(provinces);
  }

  // Views per day as bars; the axis shows the first and last day.
  function days(d: Stats) {
    const target = $<HTMLElement>("[data-days]");
    const all = d.days.filter((x) => x.views || x.crawlers);
    if (!all.length) {
      target.replaceChildren(el("p", "none", s("empty")));
      return;
    }
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    const n = d.days.length;
    const max = Math.max(1, ...d.days.map((x) => x.views));
    svg.setAttribute("viewBox", `0 0 ${n * 10} 100`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", s("daily"));
    d.days.forEach((x, i) => {
      const h = Math.max(x.views ? 2 : 0, (x.views / max) * 96);
      const r = document.createElementNS(ns, "rect");
      r.setAttribute("x", String(i * 10 + 1.5));
      r.setAttribute("y", String(100 - h));
      r.setAttribute("width", "7");
      r.setAttribute("height", String(h));
      const t = document.createElementNS(ns, "title");
      t.textContent = `${x.day}: ${num.format(x.views)} ${s("viewsUnit")} · ${num.format(x.visitors)} ${s("visitorsUnit")} · ${M.kpi.crawlers} ${num.format(x.crawlers)}`;
      r.append(t);
      svg.append(r);
    });
    const axis = el("div", "vis-axis");
    axis.append(el("span", "", d.days[0]!.day), el("span", "", `max ${num.format(max)}`), el("span", "", d.days[n - 1]!.day));
    target.replaceChildren(svg, axis);
  }

  async function load() {
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.range === range)));
    root.classList.add("loading");
    status.textContent = s("loading");
    try {
      const res = await fetch(`${apiBase(location.hostname)}/api/stats?range=${range}`);
      if (!res.ok) throw new Error(String(res.status));
      data = (await res.json()) as Stats;
      render(data);
      status.textContent = "";
    } catch {
      status.textContent = s("loadFailed");
    } finally {
      root.classList.remove("loading");
    }
  }

  for (const b of buttons) {
    b.addEventListener("click", () => {
      if (b.dataset.range === range) return;
      range = b.dataset.range!;
      try {
        localStorage.setItem(KEY, range);
      } catch {}
      void load();
    });
  }
  void load();

  // The 3D maps: each starts once the reader has scrolled, tapped or moved the mouse and its stage
  // is on (or near) the screen.
  type Connection = { saveData?: boolean };
  if ((navigator as Navigator & { connection?: Connection }).connection?.saveData) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let wanted = false;
  const pending = new Map<HTMLElement, () => void>();
  const tipFor = (stage: HTMLElement) => {
    const tip = stage.querySelector<HTMLElement>("[data-tip]")!;
    return (t: Tip | null, x = 0, y = 0) => {
      tip.hidden = !t;
      if (!t) return;
      tip.replaceChildren(el("b", "", t.title), el("span", "", `${num.format(t.visitors)} ${s("visitorsUnit")} · ${num.format(t.views)} ${s("viewsUnit")}`));
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
    };
  };
  const failed = (stage: HTMLElement) => {
    // No WebGL, a failed download, an old browser: the lists already say everything.
    stage.classList.add("no3d");
    stage.querySelector(".vis-poster span")!.textContent = s("no3d");
  };
  for (const stage of root.querySelectorAll<HTMLElement>("[data-stage]")) {
    const kind = stage.dataset.stage!;
    pending.set(stage, () => {
      const opts = { stage, reduced, lang, onTip: tipFor(stage) };
      const started =
        kind === "globe"
          ? import("./visitors-globe").then((m) => m.mountGlobe(opts)).then((g) => {
              globe = g;
            })
          : import("./visitors-china").then((m) => m.mountChina({ ...opts, southSea: s("southSea"), names: provinceName })).then((c) => {
              china = c;
            });
      started
        .then(() => {
          stage.classList.add("live");
          if (data) render(data);
        })
        .catch(() => failed(stage));
    });
  }
  const near = new Set<HTMLElement>();
  const start = () => {
    if (!wanted) return;
    for (const stage of near) {
      const go = pending.get(stage);
      pending.delete(stage);
      go?.();
    }
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const stage = e.target as HTMLElement;
        if (e.isIntersecting) near.add(stage);
        else near.delete(stage);
      }
      start();
    },
    { rootMargin: "300px 0px" },
  );
  for (const stage of pending.keys()) io.observe(stage);
  const inputs = ["scroll", "wheel", "pointerdown", "pointermove", "touchstart", "keydown"] as const;
  const onInput = () => {
    wanted = true;
    for (const t of inputs) window.removeEventListener(t, onInput);
    start();
  };
  for (const t of inputs) window.addEventListener(t, onInput, { passive: true });
}
