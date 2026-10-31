// Site-wide enhancements: day/night toggle, the "/" search shortcut, the WeChat card and the
// goodbye terminal. All optional: without JavaScript every page still reads and links work.
import { store } from "./store";
import { cue } from "./typing";

const root = document.documentElement;
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const toggle = document.querySelector<HTMLButtonElement>(".theme-toggle");

const current = () => (root.dataset.theme ?? (systemDark.matches ? "dark" : "light")) as "dark" | "light";
function paintToggle() {
  if (!toggle) return;
  const dark = current() === "dark";
  toggle.setAttribute("aria-pressed", String(dark));
  toggle.setAttribute("aria-label", dark ? toggle.dataset.light! : toggle.dataset.dark!);
  toggle.title = toggle.getAttribute("aria-label")!;
  toggle.firstElementChild!.textContent = dark ? "☀" : "☾";
}
// Live demos (```html demo) are sandboxed frames that only see the system setting: tell them ours.
const demos = [...document.querySelectorAll<HTMLIFrameElement>(".demo iframe")];
const tellDemo = (f: HTMLIFrameElement) => f.contentWindow?.postMessage({ zqTheme: current() }, "*");
for (const f of demos) f.addEventListener("load", () => tellDemo(f));
const tellDemos = () => demos.forEach(tellDemo);
// A demo whose content wraps taller than its fence height (a phone, a narrow reading width) reports
// its real height (src/lib/markdown/remark-demo.ts); grow that frame to fit, never below the fence's.
addEventListener("message", (e) => {
  const h = (e.data as { zqDemoHeight?: unknown } | null)?.zqDemoHeight;
  if (typeof h !== "number" || !Number.isFinite(h)) return;
  const f = demos.find((d) => d.contentWindow === e.source);
  if (!f) return;
  f.dataset.minHeight ??= String(parseFloat(f.style.height) || 0);
  f.style.height = `${Math.min(Math.max(h, Number(f.dataset.minHeight)), 4000)}px`;
});
if (toggle) {
  toggle.hidden = false;
  paintToggle();
  toggle.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    store.set("zq-theme", next);
    paintToggle();
    tellDemos();
  });
  systemDark.addEventListener("change", () => {
    paintToggle();
    tellDemos();
  });
}

// Inside a window on the desk, links that leave the site open in a new tab rather than in the window.
if (root.classList.contains("embedded")) {
  for (const a of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (a.origin !== location.origin) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
  }
}

// "/" opens search from anywhere except while typing.
const searchLink = document.querySelector<HTMLAnchorElement>("[data-search-link]");
addEventListener("keydown", (e) => {
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || !searchLink) return;
  const el = e.target as HTMLElement;
  if (el.closest("input, textarea, select, [contenteditable]")) return;
  e.preventDefault();
  if (location.pathname === new URL(searchLink.href).pathname) {
    document.querySelector<HTMLInputElement>("#q")?.focus();
  } else {
    location.href = searchLink.href;
  }
});

// WeChat card: open in place instead of leaving for the bare image; a click on the backdrop closes it.
const wechat = document.querySelector<HTMLDialogElement>("#wechat");
if (wechat) {
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[data-wechat]")) {
    link.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      wechat.showModal();
    });
  }
  wechat.addEventListener("click", (e) => {
    // The dialog's own padding is also e.target === wechat, so close only outside its box.
    const r = wechat.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (e.target === wechat && !inside) wechat.close();
  });
}

// The email chip carries the address in two halves so scrapers reading the HTML find nothing to
// harvest; here it becomes a real mailto link with the address shown.
for (const link of document.querySelectorAll<HTMLAnchorElement>("a[data-mail]")) {
  const [user, domain] = (link.dataset.mail ?? "").split(" ");
  if (!user || !domain) continue;
  const address = `${user}@${domain}`;
  link.href = `mailto:${address}`;
  link.textContent = `${link.dataset.label ?? ""} · ${address}`;
}

// The goodbye terminal at the bottom of every page plays its session the first time it scrolls
// into view. Pages short enough to show it on arrival keep it still, as does reduced motion. The
// observer's first report tells whether it is on screen on arrival; asking the element itself here
// would force a layout of the whole page while it is still loading.
const bye = document.querySelector<HTMLElement>("[data-bye]");
if (bye && "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let first = true;
  const play = () => {
    bye.classList.add("play");
    io.disconnect();
  };
  const io = new IntersectionObserver(
    (entries) => {
      const seen = entries.some((e) => e.isIntersecting);
      if (!first) {
        if (seen) play();
        return;
      }
      first = false;
      if (seen) {
        io.disconnect();
        return;
      }
      cue(bye);
      bye.classList.add("armed");
      bye.addEventListener("focusin", play, { once: true });
    },
    { threshold: 0.3 },
  );
  io.observe(bye);
}

// Opening scenes (```opener fences, src/lib/markdown/opener.ts) play once when half of one is on screen.
// Without the observer, or with reduced motion, they stay on their last frame.
const openers = document.querySelectorAll<HTMLElement>("[data-opener]");
if (openers.length && "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("play");
        io.unobserve(e.target);
      }
    },
    { threshold: 0.45 },
  );
  openers.forEach((h) => {
    h.classList.add("armed");
    io.observe(h);
  });
}

// Looping decorations (the home terminal's cursor, the footer's floating arrow) pause while off
// screen; see .idle in global.css.
const loops = document.querySelectorAll<HTMLElement>(".cursor, .back-top span");
if (loops.length && "IntersectionObserver" in window) {
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle("idle", !e.isIntersecting);
  });
  loops.forEach((el) => seen.observe(el));
}
