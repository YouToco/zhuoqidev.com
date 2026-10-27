// AI vendor status page (src/pages/[...lang]/status/), set as a newspaper front page. The vendors,
// their names, links and notes are in the HTML (the classifieds); this fetches what their status
// pages say now (functions/api/ai-status.ts) and sets the rest of the page from it: the weather
// ear, the headline and deck, the lead story, the incident timeline and the weather box. It is
// "reprinted" every minute while the page is visible. Vendor text is set with textContent only.
import type { Incident, Level, VendorStatus } from "../../server/ai-status";
import { apiBase } from "../site";

type Kind = Level | "unknown" | "none";
type Msg = {
  levels: Record<Kind, string>;
  weather: Record<Kind, string>;
  stages: Record<string, string>;
  intl: string;
  cn: string;
  loadFailed: string;
  np: Record<string, string | string[]>;
};

const EVERY_MS = 60_000;
// Worst first; the weather rank also decides the order of the classifieds and the legend.
const RANK: Record<Kind, number> = { major: 6, partial: 5, degraded: 4, maintenance: 3, unknown: 2, ok: 1, none: 0 };
const GLYPH: Record<Kind, string> = {
  ok: "sun",
  maintenance: "cloud",
  degraded: "rain",
  partial: "thunder",
  major: "storm",
  unknown: "fog",
  none: "none",
};
const LEGEND: Kind[] = ["ok", "maintenance", "degraded", "partial", "major", "unknown", "none"];
// Names as people say them in a headline.
const ALIAS: Record<string, string> = { anthropic: "Claude", gemini: "Vertex Gemini", aistudio: "AI Studio" };

const root = document.querySelector<HTMLElement>("[data-np]");
if (root) init(root);

function init(root: HTMLElement) {
  const lang = root.dataset.lang === "en" ? "en" : "zh";
  const M = JSON.parse(root.dataset.msg!) as Msg;
  const N = M.np as Record<string, string>;
  const TOD = M.np.tod as string[];
  const OPENS = M.np.opens as string[];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const q = (sel: string) => root.querySelector<HTMLElement>(sel)!;

  // ---- text helpers -------------------------------------------------------------------------
  /** A template from M.np with {names} filled; a Node value is kept as a node (a live duration). */
  const fill = (tpl: string, vars: Record<string, string | number | Node> = {}): (string | Node)[] =>
    tpl.split(/(\{\w+\})/).flatMap((part) => {
      const m = /^\{(\w+)\}$/.exec(part);
      if (!m) return part ? [part] : [];
      const v = vars[m[1]!];
      return v === undefined ? [] : [typeof v === "object" ? v : String(v)];
    });
  const f = (key: string, vars: Record<string, string | number> = {}) =>
    (N[key] ?? "").replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    cls?: string | null,
    ...kids: (string | Node | null | false | undefined)[]
  ) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    for (const k of kids) if (k) e.append(k);
    return e;
  };
  const isCjk = (s: string) => /[㐀-鿿]/.test(s);
  const langOf = (s: string) => (isCjk(s) ? "zh-CN" : "en");
  const quoted = (title: string) => {
    const s = el("span", "np-ttl", title || N.noTitle!);
    s.lang = langOf(title);
    return s;
  };

  // ---- time ----------------------------------------------------------------------------------
  const clock = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const day = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-GB", { month: "2-digit", day: "2-digit" });
  const date = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const ms = (iso?: string) => {
    const n = iso ? Date.parse(iso) : Number.NaN;
    return Number.isNaN(n) ? null : n;
  };
  const hm = (t: number) => clock.format(t);
  const dur = (span: number) => durText(span).replaceAll(" ", "\u00a0");
  const durText = (span: number) => {
    const m = Math.max(0, Math.floor(span / 60_000));
    if (m < 1) return N.dur0!;
    if (m < 60) return f("durM", { m });
    const h = Math.floor(m / 60);
    if (h < 24) return m % 60 ? f("durHM", { h, m: m % 60 }) : f("durH", { h });
    const d = Math.floor(h / 24);
    return h % 24 ? f("durDH", { d, h: h % 24 }) : f("durD", { d });
  };
  /** A duration that keeps counting: tick() refreshes every [data-since]. */
  const since = (iso: string) => {
    const s = el("span", "np-dur");
    s.dataset.since = iso;
    const t = ms(iso);
    s.textContent = t === null ? "—" : dur(Date.now() - t);
    return s;
  };
  const tod = (h: number) => TOD[h < 5 ? 0 : h < 8 ? 1 : h < 11 ? 2 : h < 13 ? 3 : h < 18 ? 4 : h < 20 ? 5 : 6]!;

  // ---- weather glyphs: line icons on a 32 grid ---------------------------------------------------
  const SVG = "http://www.w3.org/2000/svg";
  const CLOUD = "M10 22h12.5a4.5 4.5 0 0 0 .4-8.98 6.5 6.5 0 0 0-12.6 1.2A3.9 3.9 0 0 0 10 22z";
  const svgEl = (tag: string, attrs: Record<string, string | number>) => {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  };
  const glyph = (kind: Kind) => {
    const svg = svgEl("svg", {
      viewBox: "0 0 32 32",
      class: "np-g",
      "aria-hidden": "true",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.6,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    const add = (tag: string, a: Record<string, string | number>) => svg.append(svgEl(tag, a));
    const rays = (cx: number, cy: number, r1: number, r2: number, degs: number[]) => {
      for (const deg of degs) {
        const a = (deg * Math.PI) / 180;
        const [c, s] = [Math.cos(a), Math.sin(a)];
        add("line", { x1: cx + c * r1, y1: cy + s * r1, x2: cx + c * r2, y2: cy + s * r2 });
      }
    };
    switch (GLYPH[kind]) {
      case "sun":
        add("circle", { cx: 16, cy: 16, r: 5.2 });
        rays(16, 16, 8.6, 11.8, [0, 45, 90, 135, 180, 225, 270, 315]);
        break;
      case "cloud":
        add("circle", { cx: 11.5, cy: 11.5, r: 3.7 });
        rays(11.5, 11.5, 5.9, 8.2, [180, 225, 270, 315]);
        add("path", { d: CLOUD, class: "np-occ", transform: "translate(2.6 3.2)" });
        break;
      case "rain":
        add("path", { d: CLOUD, transform: "translate(0 -3.5)" });
        for (const x of [12, 16.6, 21.2]) add("line", { x1: x, y1: 21.6, x2: x - 1.4, y2: 26 });
        break;
      case "thunder":
        add("path", { d: CLOUD, transform: "translate(0 -3.5)" });
        add("polyline", { points: "17.2 20.6 13.9 25.3 17.7 25.3 14.6 29.6" });
        add("line", { x1: 10.6, y1: 21.6, x2: 9.6, y2: 24.4 });
        add("line", { x1: 22.4, y1: 21.6, x2: 21.4, y2: 24.4 });
        break;
      case "storm":
        svg.setAttribute("stroke-width", "1.8");
        add("circle", { cx: 16, cy: 16, r: 3.3 });
        add("path", { d: "M16 12.7C16 7.2 19.6 4.6 24.8 4.6" });
        add("path", { d: "M16 19.3C16 24.8 12.4 27.4 7.2 27.4" });
        break;
      case "fog":
        add("line", { x1: 7, y1: 10.5, x2: 25, y2: 10.5 });
        add("line", { x1: 4.5, y1: 15, x2: 27.5, y2: 15, "stroke-dasharray": "9 3" });
        add("line", { x1: 6.5, y1: 19.5, x2: 25.5, y2: 19.5 });
        add("line", { x1: 10, y1: 24, x2: 22, y2: 24 });
        break;
      default:
        add("circle", { cx: 16, cy: 16, r: 9, "stroke-dasharray": "2.2 3.1" });
        add("line", { x1: 13, y1: 16, x2: 19, y2: 16, opacity: 0.7 });
    }
    return svg;
  };

  // ---- the vendors, in page order ------------------------------------------------------------
  type Row = {
    id: string;
    name: string;
    region: "intl" | "cn";
    order: number;
    link: boolean;
    ad: HTMLElement;
    status?: VendorStatus;
  };
  const rows: Row[] = [...root.querySelectorAll<HTMLElement>("[data-vendor]")].map((ad, order) => ({
    id: ad.dataset.vendor!,
    name: ad.querySelector(".np-nm")!.textContent,
    region: regionOf(ad),
    order,
    link: ad.dataset.level === "none",
    ad,
  }));
  function regionOf(ad: HTMLElement): "intl" | "cn" {
    // The classifieds list each region after its heading.
    let p = ad.previousElementSibling;
    while (p && !p.matches("[data-cat]")) p = p.previousElementSibling;
    return (p as HTMLElement | null)?.dataset.cat === "cn" ? "cn" : "intl";
  }
  const cats = [...root.querySelectorAll<HTMLElement>("[data-cat]")];
  const kindOf = (r: Row): Kind => (r.link ? "none" : (r.status?.level ?? "unknown"));
  const troubled = (r: Row) => RANK[kindOf(r)] >= 3;
  const short = (r: Row) => ALIAS[r.id] ?? r.name.replace(/\s*\(.*\)$/, "");
  const incidents = (r: Row) => [...(r.status?.incidents ?? [])].sort((a, b) => RANK[b.level] - RANK[a.level]);
  const badComps = (r: Row) => (r.status?.components ?? []).filter((c) => c.level !== "ok");
  const sorted = () => [...rows].sort((a, b) => RANK[kindOf(b)] - RANK[kindOf(a)] || a.order - b.order);
  const joinNames = (list: string[]) => list.join(N.list);

  // ---- masthead and headline --------------------------------------------------------------------
  const setTop = (failed: boolean) => {
    const all = sorted();
    const bad = all.filter(troubled);
    const readable = all.filter((r) => kindOf(r) !== "none");
    const count = (k: Kind) => all.filter((r) => kindOf(r) === k).length;
    const worst = bad[0];
    const earKind: Kind = failed ? "unknown" : worst ? kindOf(worst) : count("unknown") ? "unknown" : "ok";
    q("[data-ear-glyph]").replaceChildren(glyph(earKind));
    q("[data-ear-word]").textContent = M.weather[earKind];
    q("[data-ear-sub]").textContent = failed
      ? ""
      : worst
        ? f("earWorst", { name: short(worst) })
        : f("earFine", { n: readable.length });
    q("[data-ear]").classList.toggle("bad", !!worst);

    const kicker = q("[data-kicker]");
    const hed = q("[data-hed]");
    const deck = q("[data-deck]");
    if (failed) {
      kicker.textContent = N.kickerFail!;
      hed.textContent = N.hedFail!;
      deck.textContent = M.loadFailed;
      return;
    }
    kicker.textContent = bad.length
      ? f(bad.length === 1 ? "kickerBad1" : "kickerBad", { n: bad.length, names: joinNames(bad.map(short)) })
      : f("kickerOk", { n: readable.length });

    const name = (r: Row) => {
      const s = short(r);
      return isCjk(s) ? s : el("span", "np-latin", s);
    };
    if (worst) {
      const k = kindOf(worst);
      const inc = incidents(worst)[0];
      const vars = { name: name(worst), level: M.levels[k] };
      if (inc && ms(inc.started) !== null)
        hed.replaceChildren(
          ...fill(N[k === "maintenance" ? "hedMaint" : "hedLasting"]!, { ...vars, d: since(inc.started) }),
        );
      else if (badComps(worst).length)
        hed.replaceChildren(
          ...fill(N.hedComps!, {
            ...vars,
            comps: badComps(worst)
              .slice(0, 2)
              .map((c) => c.name)
              .join(N.list),
          }),
        );
      else hed.replaceChildren(...fill(N.hedPlain!, vars));
    } else if (count("unknown")) hed.textContent = f("hedUnknown", { n: count("unknown") });
    else hed.textContent = f("hedOk", { n: count("ok") });

    const parts: string[] = [];
    if (bad.length > 1)
      parts.push(
        f("deckOthers", {
          list: joinNames(bad.slice(1).map((r) => f("deckItem", { name: short(r), level: M.levels[kindOf(r)] }))),
        }),
      );
    const rest = [f("deckRest", { n: count("ok") })];
    if (count("unknown")) rest.push(f("deckUnknown", { n: count("unknown") }));
    if (count("none")) rest.push(f("deckNone", { n: count("none") }));
    parts.push(rest.join(N.clause));
    deck.textContent = `${parts.join(N.part)}${N.stop}`;
  };

  /** Edition number = minute of the day the data was read, as a daily paper counts its runs. */
  const setEdition = (read: number) => {
    const d = new Date(read);
    const ed = d.getHours() * 60 + d.getMinutes() + 1;
    q("[data-date]").textContent = date.format(d);
    q("[data-ed]").textContent = f("edition", { n: ed });
    q("[data-time]").textContent = f("updated", { t: hm(read) });
    q("[data-stamp-ed]").textContent = f("stampEd", { n: ed, t: hm(read) });
    const readable = rows.filter((r) => kindOf(r) !== "none").length;
    q("[data-byline]").replaceChildren(
      ...[f("byFrom"), f("byAsOf", { t: hm(read) }), f("bySources", { n: readable }), f("byVerbatim")].map((s) =>
        el("span", null, s),
      ),
    );
    return ed;
  };

  // ---- the lead story ------------------------------------------------------------------------
  const setLead = (read: number) => {
    const lead = q("[data-lead]");
    const all = sorted();
    const bad = all.filter(troubled);
    const cols = el("div", "np-cols");
    lead.replaceChildren(el("p", "np-slug", el("b", null, N.slug), ` ${N.slugSub}`), cols);
    const when = f("when", { tod: tod(new Date(read).getHours()) });
    if (!bad.length) cols.append(el("p", "np-first", f("quiet", { when })));

    bad.forEach((r, idx) => {
      const k = kindOf(r);
      const incs = incidents(r);
      const comps = badComps(r)
        .map((c) => f("q", { t: c.name }))
        .join(N.list);
      if (idx > 0)
        cols.append(
          el(
            "h3",
            "np-sub",
            glyph(k),
            el("span", null, short(r)),
            el("span", "np-sub-k", `${M.weather[k]} · ${M.levels[k]}`),
          ),
        );
      const p = el("p", idx === 0 ? "np-first" : null);
      p.append(
        ...(idx === 0
          ? fill(N.leadFirst!, { when, name: r.name, comps: comps || N.overall!, level: M.levels[k] })
          : fill(N.leadOther!, {
              open: OPENS[(idx - 1) % OPENS.length]!,
              name: r.name,
              level: M.levels[k],
              withComps: comps ? f("withComps", { comps }) : "",
            })),
      );
      incs.forEach((inc, j) => {
        const started = ms(inc.started);
        const stage = M.stages[inc.stage] ?? inc.stage;
        if (j === 0) {
          p.append(
            ...fill(N[idx === 0 ? "incLead" : "incOther"]!, {
              word: inc.maintenance ? N.maintenance! : N.incident!,
              title: quoted(inc.title),
              stage,
            }),
          );
          if (started !== null) p.append(...fill(N.since!, { t: hm(started), d: since(inc.started) }));
          const upd = ms(inc.updated);
          if (idx === 0 && upd !== null && upd !== started) p.append(f("lastUpd", { t: hm(upd) }));
          p.append(N.stop!);
        } else {
          p.append(
            ...fill(N.incMore!, {
              title: quoted(inc.title),
              level: M.levels[inc.level],
              stage,
              lasting: started === null ? "" : el("span", null, ...fill(N.incMoreLasting!, { d: since(inc.started) })),
            }),
          );
        }
      });
      if (!incs.length) p.append(N.noInc!);
      const jump = el("button", "np-jump", N.jump);
      jump.type = "button";
      jump.addEventListener("click", () => openAd(r.id, true));
      p.append(jump);
      cols.append(p);

      const first = incs[0];
      if (first?.latest) {
        const upd = ms(first.updated);
        const cite = f("cite", { name: short(r), t: upd === null ? "" : hm(upd) });
        const text = first.latest.length > 420 ? `${first.latest.slice(0, 420)}…` : first.latest;
        if (idx === 0) {
          const bq = el("blockquote", null, text);
          bq.lang = langOf(text);
          cols.append(el("figure", "np-pull", el("span", "np-q", "“"), bq, el("figcaption", null, cite)));
        } else {
          const bq = el("blockquote", "np-inq", text, el("cite", null, cite));
          bq.lang = langOf(text);
          cols.append(bq);
        }
      }
    });

    const close = el("p", "np-ind");
    const ok = (region: "intl" | "cn") => all.filter((r) => kindOf(r) === "ok" && r.region === region).map(short);
    const segs = [
      ok("intl").length ? f("okIntl", { names: joinNames(ok("intl")), n: ok("intl").length }) : "",
      ok("cn").length ? f("okCn", { names: joinNames(ok("cn")), n: ok("cn").length }) : "",
    ].filter(Boolean);
    if (bad.length && segs.length) close.append(f("closeOk", { segs: segs.join(N.part) }));
    const unknown = all.filter((r) => kindOf(r) === "unknown").map(short);
    if (unknown.length) close.append(f("closeUnknown", { names: joinNames(unknown) }));
    const none = all.filter((r) => kindOf(r) === "none").map(short);
    if (none.length) close.append(f("closeNone", { names: joinNames(none) }));
    close.append(N.closeEnd!);
    cols.append(close);

    const fig = el("figure", "np-tl");
    fig.append(el("div", "np-tl-svg"), el("figcaption", null, el("b", null, N.fig), ` ${N.figCaption}`));
    lead.append(fig);
  };

  // ---- the timeline: open incidents from their start to this edition ---------------------------
  let printed = Date.now();
  const setTimeline = () => {
    const fig = root.querySelector<HTMLElement>(".np-tl");
    const box = fig?.querySelector<HTMLElement>(".np-tl-svg");
    if (!fig || !box) return;
    const bars = sorted()
      .filter(troubled)
      .flatMap((r) => incidents(r).map((i) => ({ r, i, t: ms(i.started) })))
      .filter((b): b is { r: Row; i: Incident; t: number } => b.t !== null)
      .sort((a, b) => RANK[b.i.level] - RANK[a.i.level] || a.t - b.t);
    fig.hidden = !bars.length;
    if (!bars.length) return;
    const W = Math.max(260, Math.floor(box.clientWidth || 600));
    const narrow = W < 520;
    const [LW, DW, TOP, RH] = [narrow ? 70 : 104, narrow ? 76 : 96, 24, narrow ? 30 : 32];
    const H = TOP + bars.length * RH + 22;
    const now = Date.now();
    const HALF = 1_800_000;
    const t0 = Math.floor((Math.min(...bars.map((b) => b.t)) - 600_000) / HALF) * HALF;
    const t1 = now + Math.max(300_000, (now - t0) * 0.03);
    const span = t1 - t0;
    const step =
      span <= 3 * 3600e3 ? HALF : span <= 8 * 3600e3 ? 3600e3 : span <= 24 * 3600e3 ? 3 * 3600e3 : 12 * 3600e3;
    const x = (t: number) => LW + ((t - t0) / span) * (W - LW - DW);
    const text = (attrs: Record<string, string | number>, s: string) => {
      const n = svgEl("text", attrs);
      n.textContent = s;
      return n;
    };
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img" });
    svg.setAttribute(
      "aria-label",
      f("figAria", {
        rows: bars
          .map((b) => f("figRow", { name: short(b.r), level: M.levels[b.i.level], t: hm(b.t), d: dur(now - b.t) }))
          .join(N.part),
      }),
    );
    const defs = svgEl("defs", {});
    for (const [id, cls] of [
      ["np-hs", "hs"],
      ["np-hi", "hi"],
    ] as const) {
      const pat = svgEl("pattern", {
        id,
        width: 4,
        height: 4,
        patternUnits: "userSpaceOnUse",
        patternTransform: "rotate(45)",
      });
      pat.append(svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 4, class: cls }));
      defs.append(pat);
    }
    svg.append(defs);
    let lastLabel = -1e9;
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) {
      const xx = x(t);
      svg.append(svgEl("line", { x1: xx, y1: TOP - 6, x2: xx, y2: H - 18, class: "tk" }));
      if (xx - lastLabel > 44 && Math.abs(xx - x(now)) > 30) {
        svg.append(text({ x: xx, y: TOP - 11, "text-anchor": "middle" }, hm(t)));
        lastLabel = xx;
      }
    }
    bars.forEach((b, i) => {
      const cy = TOP + i * RH + RH / 2;
      svg.append(text({ x: 0, y: cy + 4.5, class: "rl" }, short(b.r)));
      svg.append(svgEl("line", { x1: LW, y1: cy, x2: W - DW + 6, y2: cy, class: "trk" }));
      const bx = x(b.t);
      svg.append(
        svgEl("rect", {
          x: bx,
          y: cy - 5,
          width: Math.max(2, x(now) - bx),
          height: 10,
          class: `b-${b.i.level}`,
          "stroke-width": 1,
        }),
      );
      svg.append(text({ x: W, y: cy + 4, "text-anchor": "end", class: "rd" }, dur(now - b.t)));
    });
    const nx = x(now);
    svg.append(svgEl("line", { x1: nx, y1: TOP - 8, x2: nx, y2: H - 16, class: "now" }));
    svg.append(
      text(
        { x: Math.min(nx, W - DW), y: H - 3, "text-anchor": "middle", class: "nowl" },
        f("figNow", { t: hm(printed) }),
      ),
    );
    box.replaceChildren(svg);
  };

  // ---- the weather box and legend -----------------------------------------------------------
  const setRail = () => {
    const all = sorted();
    const wx = q("[data-wx]");
    wx.replaceChildren(
      ...(["intl", "cn"] as const).flatMap((region) => {
        const list = all.filter((r) => r.region === region);
        const bad = list.filter(troubled).length;
        const grid = el("div", "np-wx-grid");
        for (const r of list) {
          const k = kindOf(r);
          const b = el("button", `np-wx-c${troubled(r) ? " bad" : ""}${k === "none" || k === "unknown" ? " dim" : ""}`);
          b.type = "button";
          b.title = r.name;
          b.setAttribute("aria-label", f("wxOpen", { name: r.name, weather: M.weather[k], level: M.levels[k] }));
          b.append(glyph(k), el("span", "np-wx-n", short(r)), el("span", "np-wx-w", M.weather[k]));
          b.addEventListener("click", () => openAd(r.id, true));
          grid.append(b);
        }
        return [
          el(
            "p",
            "np-wx-reg",
            el("span", null, f("wxRegion", { region: M[region], n: list.length })),
            el("span", null, bad ? f("wxBad", { n: bad }) : N.wxCalm!),
          ),
          grid,
        ];
      }),
    );
    q("[data-legend]").replaceChildren(
      ...LEGEND.map((k) => {
        const n = all.filter((r) => kindOf(r) === k).length;
        return el(
          "li",
          `${n ? "" : "zero"}${RANK[k] >= 3 && n ? " bad" : ""}`.trim() || null,
          glyph(k),
          el("span", "np-lw", M.weather[k]),
          el("span", "np-ln", k === "none" ? N.legendNone! : M.levels[k]),
          el("span", "np-lc", f("legendCount", { n })),
        );
      }),
    );
  };

  // ---- the classifieds ------------------------------------------------------------------------
  const detail = (r: Row) => {
    const box = el("div");
    const k = kindOf(r);
    if (k === "none") {
      box.append(el("p", "np-dt-quiet", N.dtLinkOnly));
      return box;
    }
    const incs = incidents(r);
    box.append(el("p", "np-dt-h", f("dtOpen", { n: incs.length })));
    if (!incs.length) box.append(el("p", "np-dt-quiet", k === "unknown" ? N.dtUnread! : N.dtNone!));
    for (const i of incs) {
      const started = ms(i.started);
      const upd = ms(i.updated);
      const meta = el("p", "np-inc-m");
      if (started !== null)
        meta.append(
          ...fill(N.dtStarted!, { t: el("b", null, `${day.format(started)} ${hm(started)}`) }),
          " · ",
          ...fill(N.dtLasting!, { d: el("b", null, since(i.started)) }),
        );
      if (upd !== null && upd !== started) meta.append(started === null ? "" : " · ", f("dtUpdated", { t: hm(upd) }));
      const title = el("p", "np-inc-t", i.title || N.noTitle!);
      title.lang = langOf(i.title);
      const inc = el(
        "div",
        "np-inc",
        el("p", "np-inc-k", `${i.maintenance ? N.maintenance : M.levels[i.level]} · ${M.stages[i.stage] ?? i.stage}`),
        title,
      );
      if (i.latest) {
        const text = el("p", "np-inc-q", i.latest.length > 600 ? `${i.latest.slice(0, 600)}…` : i.latest);
        text.lang = langOf(i.latest);
        inc.append(text);
      }
      inc.append(meta);
      if (i.url) {
        const a = el("a", "np-inc-a", N.dtNotice);
        a.href = i.url;
        a.rel = "noopener";
        a.target = "_blank";
        inc.append(a);
      }
      box.append(inc);
    }
    const comps = [...(r.status?.components ?? [])].sort((a, b) => RANK[b.level] - RANK[a.level]);
    if (comps.length) {
      const nb = badComps(r).length;
      box.append(
        el("p", "np-dt-h", f("dtComps", { n: comps.length }) + (nb ? f("dtCompsBad", { n: nb }) : f("dtCompsOk"))),
      );
      const ul = el("ul", "np-comps");
      for (const c of comps) {
        const name = el("span", "np-cn", c.name);
        name.lang = langOf(c.name);
        ul.append(
          el(
            "li",
            c.level === "ok" ? null : "bad",
            name,
            el("span", "np-cl-l"),
            el("span", "np-cs", M.levels[c.level]),
          ),
        );
      }
      box.append(ul);
    }
    return box;
  };
  const metaText = (r: Row) => {
    const k = kindOf(r);
    if (k === "none") return N.metaLink!;
    if (k === "unknown") return N.metaUnknown!;
    const c = r.status?.components.length ?? 0;
    const b = badComps(r).length;
    const i = r.status?.incidents.length ?? 0;
    return f("metaComps", { n: c }) + (b ? f("metaBad", { n: b }) : "") + (i ? f("metaInc", { n: i }) : "");
  };
  const paintAd = (r: Row) => {
    const k = kindOf(r);
    const ad = r.ad;
    ad.dataset.level = k;
    ad.classList.toggle("bad", troubled(r));
    ad.querySelector("[data-glyph]")!.replaceChildren(glyph(k));
    ad.querySelector("[data-cond]")!.textContent = M.levels[k];
    ad.querySelector("[data-meta]")!.textContent = metaText(r);
    ad.querySelector("[data-detail]")!.replaceChildren(detail(r));
  };
  const setOpen = (ad: HTMLElement, open: boolean) => {
    ad.classList.toggle("open", open);
    ad.querySelector("button")!.setAttribute("aria-expanded", String(open));
  };
  const openAd = (id: string, scroll: boolean) => {
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    setOpen(r.ad, true);
    if (!scroll) return;
    r.ad.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "start" });
    r.ad.querySelector("button")!.focus({ preventScroll: true });
    r.ad.classList.remove("flash");
    r.ad.getBoundingClientRect(); // a layout pass, so taking the class off and on replays the flash
    r.ad.classList.add("flash");
  };
  for (const r of rows)
    r.ad.querySelector("button")!.addEventListener("click", () => setOpen(r.ad, !r.ad.classList.contains("open")));

  // Columns are dealt by hand rather than with CSS columns, so opening an ad grows its own column
  // instead of shuffling every ad after it into the next one.
  const colsBox = q("[data-cols]");
  let columns = 0;
  const layout = (k: number) => {
    columns = k;
    const items: { node: HTMLElement; w: number; cat: boolean }[] = [];
    for (const region of ["intl", "cn"] as const) {
      items.push({ node: cats.find((c) => c.dataset.cat === region)!, w: 0.8, cat: true });
      for (const r of sorted().filter((x) => x.region === region))
        items.push({ node: r.ad, w: troubled(r) ? 1.7 : 1.15, cat: false });
    }
    const total = items.reduce((s, it) => s + it.w, 0);
    let acc = 0;
    const at = items.map((it) => {
      const c = Math.min(k - 1, Math.floor((acc + it.w * 0.5) / (total / k)));
      acc += it.w;
      return c;
    });
    // A region heading never ends a column: it moves down with its first ad.
    for (let i = items.length - 2; i >= 0; i--) if (items[i]!.cat && at[i + 1]! > at[i]!) at[i] = at[i + 1]!;
    const colEls = Array.from({ length: k }, () => el("div", "np-cl-col"));
    items.forEach((it, j) => colEls[at[j]!]!.append(it.node));
    colsBox.replaceChildren(...colEls.filter((c) => c.childNodes.length));
    colsBox.style.setProperty("--k", String(colsBox.childElementCount));
  };
  const relayout = () => {
    const w = colsBox.clientWidth;
    const k = w >= 1000 ? 4 : w >= 720 ? 3 : w >= 480 ? 2 : 1;
    if (k !== columns) layout(k);
  };
  const setClassifieds = () => {
    rows.forEach(paintAd);
    for (const cat of cats) {
      const list = rows.filter((r) => r.region === cat.dataset.cat);
      const bad = list.filter(troubled).length;
      cat.querySelector("[data-cat-count]")!.textContent =
        f("catCount", { n: list.length }) + (bad ? f("catBad", { n: bad }) : "");
    }
    const counts = cats.map(
      (c) => `${M[c.dataset.cat as "intl" | "cn"]} ${rows.filter((r) => r.region === c.dataset.cat).length}`,
    );
    q("[data-cl-note]").textContent = f("clNote", { n: rows.length, counts: counts.join(" · ") });
    columns = 0; // the order may have changed even when the column count hasn't
    relayout();
  };

  // ---- the press -----------------------------------------------------------------------------
  const stamp = q("[data-stamp]");
  let stampTimer = 0;
  let due = 0;
  let busy = false;
  let first = true;
  const load = async () => {
    if (busy) return;
    busy = true;
    root.classList.add("loading");
    try {
      const res = await fetch(`${apiBase(location.hostname)}/api/ai-status`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { updated: string; vendors: VendorStatus[] };
      const byId = new Map(data.vendors.map((v) => [v.id, v]));
      for (const r of rows) {
        const s = byId.get(r.id);
        if (s && !r.link) r.status = s;
      }
      printed = ms(data.updated) ?? Date.now();
      setTop(false);
      const ed = setEdition(printed);
      setLead(printed);
      setRail();
      setClassifieds();
      setTimeline();
      if (first) {
        const hash = location.hash.replace(/^#v-/, "");
        if (hash) openAd(hash, false);
        first = false;
      } else {
        stamp.classList.add("on");
        clearTimeout(stampTimer);
        stampTimer = window.setTimeout(() => stamp.classList.remove("on"), 2600);
      }
      q("[data-live]").textContent = f("reprinted", { n: ed, t: hm(printed) });
    } catch {
      setTop(true);
      for (const r of rows) if (!r.link && !r.status) r.ad.querySelector("[data-meta]")!.textContent = N.metaUnknown!;
    } finally {
      busy = false;
      due = Date.now() + EVERY_MS;
      root.classList.remove("loading");
    }
  };

  // One clock for the countdown ear, the running durations and the reprint; a hidden tab doesn't
  // fetch, and catches up when it is shown again.
  const cd = q("[data-cd]");
  const bar = q("[data-cd-bar]");
  const tick = () => {
    const left = Math.max(0, due - Date.now());
    const s = Math.ceil(left / 1000);
    cd.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    bar.style.width = `${((left / EVERY_MS) * 100).toFixed(2)}%`;
    for (const n of root.querySelectorAll<HTMLElement>("[data-since]")) {
      const t = ms(n.dataset.since);
      if (t !== null) n.textContent = dur(Date.now() - t);
    }
    if (!busy && !left && document.visibilityState === "visible") void load();
  };

  if ("ResizeObserver" in window) {
    new ResizeObserver(relayout).observe(colsBox);
    let lastW = 0;
    new ResizeObserver(() => {
      const w = root.querySelector(".np-tl-svg")?.clientWidth ?? 0;
      if (Math.abs(w - lastW) >= 2) {
        lastW = w;
        setTimeline();
      }
    }).observe(q("[data-lead]"));
  }
  // A link to #v-<vendor> opens that ad, on load (above) and when only the fragment changes.
  addEventListener("hashchange", () => openAd(location.hash.replace(/^#v-/, ""), false));
  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", tick);
  void load().then(tick);
}
