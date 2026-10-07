// Site-wide enhancements: day/night toggle and the "/" search shortcut. Both are optional.
import { store } from "./store";

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
