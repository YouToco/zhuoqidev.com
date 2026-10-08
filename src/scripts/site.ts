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
if (toggle) {
  toggle.hidden = false;
  paintToggle();
  toggle.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    store.set("zq-theme", next);
    paintToggle();
  });
  systemDark.addEventListener("change", paintToggle);
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
      if (seen) return io.disconnect();
      cue(bye);
      bye.classList.add("armed");
      bye.addEventListener("focusin", play, { once: true });
    },
    { threshold: 0.3 },
  );
  io.observe(bye);
}
