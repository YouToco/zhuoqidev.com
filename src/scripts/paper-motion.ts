// Chart data and the about page stamps play once, the first time they scroll into view (the motion
// itself is CSS, "Paper motion" in global.css). Without this script, with reduced motion, or for
// anything already in sight when the page opens, they rest in their final state: only what is still
// below the fold is set back to its start, so nothing on screen jumps.
const NUM = /-?\d[\d,]*(?:\.\d+)?/g;
const STEP = 70; // ms between rows, as --i in the CSS
const COUNT_MS = 900;

interface Counter {
  node: Text;
  text: string;
  at: number;
  token: string;
  delay: number;
}

// A value label counts up with its bar when it holds exactly one number ("约 6,600", "0.8%", "$1.2"):
// "25.4 → 41.9" or "3 / 10" stay as they are.
function counters(chart: HTMLElement): Counter[] {
  return [...chart.querySelectorAll<HTMLElement>(".cst-v, .cb-val")].flatMap((el, n) => {
    if (el.textContent.match(NUM)?.length !== 1) return [];
    const node = [...el.childNodes].find((c): c is Text => c instanceof Text && /\d/.test(c.data));
    if (!node) return [];
    const token = node.data.match(NUM)![0];
    const i = Number(el.closest<HTMLElement>(".cb-track")?.style.getPropertyValue("--i") || n);
    return [{ node, text: node.data, at: node.data.indexOf(token), token, delay: i * STEP + 100 }];
  });
}

function show(c: Counter, share: number) {
  const dec = c.token.split(".")[1]?.length ?? 0;
  const v = Number(c.token.replaceAll(",", "")) * share;
  const s = c.token.includes(",")
    ? v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : v.toFixed(dec);
  c.node.data = share === 1 ? c.text : c.text.slice(0, c.at) + s + c.text.slice(c.at + c.token.length);
}

function count(list: Counter[]) {
  const t0 = performance.now();
  const tick = (now: number) => {
    let running = false;
    for (const c of list) {
      const t = Math.min(1, Math.max(0, (now - t0 - c.delay) / COUNT_MS));
      show(c, t === 1 ? 1 : 1 - (1 - t) ** 3);
      running ||= t < 1;
    }
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

if (!matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
  const pending = new Map<Element, Counter[]>();
  const go = (el: Element) => {
    el.classList.add("pm-go");
    count(pending.get(el) ?? []);
    pending.delete(el);
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        go(e.target);
      }
    },
    { rootMargin: "0px 0px -15% 0px" },
  );
  const targets = document.querySelectorAll<HTMLElement>(".prose .chart, .proj:has(.pstamp), .proj.certs");
  for (const el of targets) {
    if (el.getBoundingClientRect().top < innerHeight) continue;
    // Rows stagger within their own list (each tab of a tabbed chart starts again from 0).
    for (const list of el.querySelectorAll(".cb, .cd")) {
      list
        .querySelectorAll<HTMLElement>(":scope > .cb-track, :scope > .cd-track, :scope > .cm-track")
        .forEach((row, i) => {
          row.style.setProperty("--i", String(i));
        });
    }
    el.querySelectorAll<HTMLElement>(".stamp-round").forEach((s, i) => s.style.setProperty("--i", String(i)));
    const list = counters(el);
    for (const c of list) show(c, 0);
    pending.set(el, list);
    el.classList.add("pm");
    io.observe(el);
  }
  // A printout shows every chart finished.
  addEventListener("beforeprint", () => {
    for (const [el, list] of pending) {
      io.unobserve(el);
      el.classList.remove("pm");
      for (const c of list) show(c, 1);
    }
    pending.clear();
  });
}
