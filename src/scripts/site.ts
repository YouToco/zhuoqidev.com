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
