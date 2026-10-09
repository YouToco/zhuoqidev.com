// Article page enhancements. Everything here is optional: the article is complete without JS.
import { store } from "./store";

const zh = document.documentElement.lang.startsWith("zh");
const label = zh
  ? { copy: "复制", done: "已复制", fail: "复制失败" }
  : { copy: "Copy", done: "Copied", fail: "Copy failed" };

async function copyText(btn: HTMLButtonElement, text: () => Promise<string> | string) {
  const original = btn.textContent;
  try {
    await navigator.clipboard.writeText(await text());
    btn.textContent = label.done;
  } catch {
    btn.textContent = label.fail;
  }
  setTimeout(() => (btn.textContent = original), 1600);
}

// Copy buttons on code blocks ship hidden so there is no dead control without JS.
if (navigator.clipboard) {
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".code .copy")) {
    btn.hidden = false;
    btn.addEventListener("click", () =>
      // textContent, not innerText: the block may be folded, and folded text has no rendered layout.
      copyText(btn, () => btn.closest(".code")?.querySelector("code")?.textContent ?? ""),
    );
  }
  for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-copy-md]")) {
    btn.hidden = false;
    btn.addEventListener("click", () =>
      copyText(btn, () => fetch(btn.dataset.copyMd!).then((r) => (r.ok ? r.text() : Promise.reject()))),
    );
  }
}

// Highlight the section being read in the table of contents.
const toc = document.querySelector(".toc");
if (toc) {
  const links = new Map(
    [...toc.querySelectorAll<HTMLAnchorElement>("a")].map((a) => [decodeURIComponent(a.hash.slice(1)), a]),
  );
  const heads = [...document.querySelectorAll<HTMLElement>(".prose h2[id]")];
  let current: string | null = null;
  const mark = () => {
    const line = window.innerHeight * 0.3;
    let id: string | null = null;
    for (const h of heads) {
      if (h.getBoundingClientRect().top <= line) id = h.id;
      else break;
    }
    if (id === current) return;
    current = id;
    links.forEach((a) => a.classList.remove("on"));
    if (id) links.get(id)?.classList.add("on");
  };
  window.addEventListener("scroll", mark, { passive: true });
  mark();
}

// Reading progress bar, for browsers without scroll timelines (or with reduced motion). Where the
// CSS bar (.read-progress) runs, this one is hidden and never listens to scroll.
const bar = document.querySelector<HTMLElement>(".progress");
const article = document.querySelector<HTMLElement>(".paper");
const cssBar = CSS.supports("animation-timeline: view()") && matchMedia("(prefers-reduced-motion: no-preference)").matches;
if (bar && article && !cssBar) {
  const update = () => {
    const r = article.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const pct = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    bar.style.transform = `scaleX(${pct})`;
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}

// Reading width: four column widths for the article, kept per reader. The head script applies the
// stored one before first paint; switching keeps the paragraph at the top of the window in view.
const picker = document.querySelector<HTMLElement>(".width-pick");
if (picker) {
  const root = document.documentElement;
  const buttons = [...picker.querySelectorAll<HTMLButtonElement>("[data-width-set]")];
  const paint = () => {
    const now = root.dataset.width ?? "default";
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.widthSet === now));
  };
  for (const b of buttons) {
    b.addEventListener("click", () => {
      const next = b.dataset.widthSet!;
      const anchor = [...document.querySelectorAll<HTMLElement>(".prose > *")].find(
        (el) => el.getBoundingClientRect().bottom > 90,
      );
      const before = anchor?.getBoundingClientRect().top;
      if (next === "default") {
        delete root.dataset.width;
        store.del("zq-width");
      } else {
        root.dataset.width = next;
        store.set("zq-width", next);
      }
      paint();
      if (anchor && before !== undefined) window.scrollBy(0, anchor.getBoundingClientRect().top - before);
    });
  }
  paint();
  picker.hidden = false;
}

// Click an article image to see it large. Figures render at the column width; the viewer opens
// with all of the picture in the window (which needs its aspect ratio before the large copy
// arrives) and zooms from there: the − / + buttons, the wheel or a pinch, a double-click, or the
// + − 0 keys; drag to pan. Raster images come with 1600w and 3200w copies, and the browser picks
// by the size shown, so zooming in fetches the sharper one only when it is needed.
const zoomMap = document.getElementById("zoom-map");
const dialog = document.querySelector<HTMLDialogElement>("dialog.zoom");
if (zoomMap && dialog && typeof dialog.showModal === "function") {
  const big = JSON.parse(zoomMap.textContent ?? "{}") as Record<string, { src: string; srcset?: string }>;
  const stage = dialog.querySelector<HTMLElement>(".zoom-stage")!;
  const view = stage.querySelector("img")!;
  const btn = (k: string) => dialog.querySelector<HTMLButtonElement>(`[data-zoom="${k}"]`)!;
  const [zoomOut, zoomFit, zoomIn] = [btn("out"), btn("fit"), btn("in")];
  const label = dialog.getAttribute("aria-label") ?? "";
  const MAX = 4;
  let scale = 1;

  const centre = () => {
    const r = stage.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  // Zoom so that the picture point under `at` (a cursor, a pinch, the stage centre) stays put.
  const zoomTo = (next: number, at = centre()) => {
    next = Math.min(MAX, Math.max(1, next));
    if (Math.abs(next - scale) < 0.001) return;
    const a = view.getBoundingClientRect();
    const fx = (at.x - a.left) / a.width;
    const fy = (at.y - a.top) / a.height;
    scale = next;
    view.style.setProperty("--s", String(scale));
    const b = view.getBoundingClientRect();
    stage.scrollLeft += b.left + fx * b.width - at.x;
    stage.scrollTop += b.top + fy * b.height - at.y;
    if (view.srcset) view.sizes = `${Math.ceil(b.width)}px`;
    sync();
  };
  const sync = () => {
    zoomOut.disabled = scale <= 1;
    zoomIn.disabled = scale >= MAX;
    zoomFit.textContent = scale <= 1 ? (zoomFit.dataset.fit ?? "") : `${Math.round(scale * 100)}%`;
    stage.classList.toggle("zoomed", scale > 1);
  };

  for (const img of document.querySelectorAll<HTMLImageElement>(".prose img")) {
    const name = (img.getAttribute("src") ?? "").split("/").pop() ?? "";
    const stem = Object.keys(big).find((k) => name.startsWith(`${k}.`));
    if (!stem) continue;
    const opener = document.createElement("button");
    opener.type = "button";
    opener.className = "zoom-btn";
    opener.setAttribute("aria-label", `${label}: ${img.alt}`);
    img.replaceWith(opener);
    opener.append(img);
    opener.addEventListener("click", () => {
      const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : img.width / img.height;
      if (ratio > 0) view.style.setProperty("--r", String(ratio));
      else view.style.removeProperty("--r");
      scale = 1;
      view.style.removeProperty("--s");
      view.alt = img.alt;
      dialog.showModal();
      // Open first so the shown width is known, then let the browser pick a copy for it.
      const { src, srcset } = big[stem]!;
      if (srcset) {
        view.sizes = `${Math.ceil(view.getBoundingClientRect().width)}px`;
        view.srcset = srcset;
      }
      view.src = src;
      stage.scrollTo(0, 0);
      sync();
    });
  }

  const STEP = 1.5;
  zoomIn.addEventListener("click", () => zoomTo(scale * STEP));
  zoomOut.addEventListener("click", () => zoomTo(scale / STEP));
  zoomFit.addEventListener("click", () => zoomTo(1));
  dialog.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const pan = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] }[e.key];
    if (e.key === "+" || e.key === "=") zoomTo(scale * STEP);
    else if (e.key === "-" || e.key === "_") zoomTo(scale / STEP);
    else if (e.key === "0") zoomTo(1);
    else if (pan && scale > 1) stage.scrollBy(pan[0]!, pan[1]!);
    else return;
    e.preventDefault();
  });
  // A wheel notch is ~100px and zooms ~16%; a trackpad pinch sends small deltas with ctrlKey set.
  stage.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const per = e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.01 : 0.0015;
      zoomTo(scale * Math.exp(-e.deltaY * per), { x: e.clientX, y: e.clientY });
    },
    { passive: false },
  );
  stage.addEventListener("dblclick", (e) => zoomTo(scale > 1 ? 1 : 2.5, { x: e.clientX, y: e.clientY }));

  // One pointer pans (mouse drag or one finger), two pinch. touch-action: none hands touches to us.
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; s: number } | null = null;
  let dragged = 0; // when the last drag ended, so its trailing click doesn't close the viewer
  let travel = 0;
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1;
  };
  stage.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    travel = 0;
    pinch = pointers.size === 2 ? { d: spread(), s: scale } : null;
  });
  stage.addEventListener("pointermove", (e) => {
    const last = pointers.get(e.pointerId);
    if (!last) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, now);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      zoomTo(pinch.s * (spread() / pinch.d), { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 });
      travel = Infinity;
    } else if (pointers.size === 1) {
      stage.scrollLeft -= now.x - last.x;
      stage.scrollTop -= now.y - last.y;
      travel += Math.abs(now.x - last.x) + Math.abs(now.y - last.y);
      if (travel > 4) stage.classList.add("dragging");
    }
  });
  const release = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) {
      stage.classList.remove("dragging");
      if (travel > 4) dragged = e.timeStamp;
    }
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);

  // A click on the backdrop (outside the picture) closes the viewer.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog && e.timeStamp - dragged > 300) dialog.close();
  });
  dialog.addEventListener("close", () => {
    view.removeAttribute("srcset");
    view.removeAttribute("src");
    pointers.clear();
    pinch = null;
  });
}

export {};
