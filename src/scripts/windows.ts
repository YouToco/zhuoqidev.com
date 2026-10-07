// Desk icons open pages in little windows over the desk: drag by the title bar, resize from the
// corner, traffic lights close / roll up / fill the screen, ↗ opens the page in its own tab.
// The page inside is the normal site in embedded mode (no top bar, dock or footer; see Base.astro).
// Without JS, on narrow screens or with a modifier key, the icons are plain links.
const icons = [...document.querySelectorAll<HTMLAnchorElement>("a.desk-icon")];
const wide = window.matchMedia("(min-width: 1001px)");
const zh = document.documentElement.lang.startsWith("zh");
const words = zh
  ? { close: "关闭", shade: "收起", zoom: "放大", tab: "在新标签页打开", resize: "拖动调整大小" }
  : { close: "Close", shade: "Roll up", zoom: "Zoom", tab: "Open in a new tab", resize: "Drag to resize" };

// Windows live in one fixed layer that sits under the dock, so the dock stays reachable.
let layer: HTMLElement | null = null;
const getLayer = () => {
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "wins";
    document.body.append(layer);
  }
  return layer;
};

let z = 1;
let opened = 0;
const front = (w: HTMLElement) => {
  if (w.style.zIndex !== String(z)) w.style.zIndex = String(++z);
  for (const o of document.querySelectorAll(".win.on")) o.classList.remove("on");
  w.classList.add("on");
};

// Follow the pointer from pointerdown until it lets go. Frames swallow pointer events, so they
// stop listening while a window is being moved or resized.
function track(w: HTMLElement, e: PointerEvent, step: (dx: number, dy: number) => void) {
  const el = e.currentTarget as HTMLElement;
  const x0 = e.clientX;
  const y0 = e.clientY;
  el.setPointerCapture(e.pointerId);
  w.classList.add("busy");
  const move = (ev: PointerEvent) => step(ev.clientX - x0, ev.clientY - y0);
  const up = () => {
    el.removeEventListener("pointermove", move);
    w.classList.remove("busy");
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up, { once: true });
  el.addEventListener("pointercancel", up, { once: true });
}

const TOP = 64; // keep the title bar below the site's top bar

function open(icon: HTMLAnchorElement) {
  const href = icon.href;
  const existing = [...getLayer().querySelectorAll<HTMLElement>(".win")].find((w) => w.dataset.href === href);
  if (existing) {
    existing.classList.remove("shaded");
    front(existing);
    return;
  }
  const label = icon.querySelector(".name")?.textContent ?? "";
  const w = document.createElement("section");
  w.className = "win";
  w.dataset.href = href;
  w.setAttribute("role", "dialog");
  w.setAttribute("aria-label", label);
  w.innerHTML = `
    <header class="win-bar">
      <span class="lights">
        <button type="button" class="l-close" aria-label="${words.close}" title="${words.close}"></button>
        <button type="button" class="l-shade" aria-label="${words.shade}" title="${words.shade}"></button>
        <button type="button" class="l-zoom" aria-label="${words.zoom}" title="${words.zoom}"></button>
      </span>
      <span class="win-title"></span>
      <a class="win-tab" target="_blank" rel="noopener" aria-label="${words.tab}" title="${words.tab}">↗</a>
    </header>
    <div class="win-body"><iframe title=""></iframe></div>
    <span class="win-grip" aria-hidden="true" title="${words.resize}"></span>`;
  const title = w.querySelector<HTMLElement>(".win-title")!;
  const tab = w.querySelector<HTMLAnchorElement>(".win-tab")!;
  const frame = w.querySelector("iframe")!;
  title.textContent = label;
  frame.title = label;
  tab.href = href;

  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const width = Math.min(780, vw - 80);
  const height = Math.min(600, vh - TOP - 110);
  const step = (opened++ % 6) * 28;
  w.style.width = `${width}px`;
  w.style.height = `${height}px`;
  w.style.left = `${Math.max(16, (vw - width) / 2 + 60 + step)}px`;
  w.style.top = `${TOP + 16 + step}px`;
  getLayer().append(w);
  front(w);

  const close = () => {
    w.classList.add("closing");
    setTimeout(() => w.remove(), 160);
    icon.focus({ preventScroll: true });
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };

  frame.addEventListener("load", () => {
    // Same origin: name the window after the page now showing, and let Esc close it from inside.
    try {
      const doc = frame.contentDocument!;
      const t = doc.title.split(" · ")[0] || label;
      title.textContent = t;
      frame.title = t;
      tab.href = frame.contentWindow!.location.href;
      frame.contentWindow!.addEventListener("keydown", keys);
    } catch {}
  });
  frame.src = href;

  w.addEventListener("pointerdown", () => front(w));
  w.addEventListener("keydown", keys);
  w.querySelector(".l-close")!.addEventListener("click", close);
  // Rolling up and zooming spring between sizes (.win.morph); dragging stays direct.
  const morph = (change: () => void) => {
    w.classList.add("morph");
    change();
    clearTimeout(Number(w.dataset.morph));
    w.dataset.morph = String(setTimeout(() => w.classList.remove("morph"), 600));
  };
  w.querySelector(".l-shade")!.addEventListener("click", () => morph(() => w.classList.toggle("shaded")));
  w.querySelector(".l-zoom")!.addEventListener("click", () =>
    morph(() => {
      w.classList.remove("shaded");
      w.classList.toggle("max");
    }),
  );

  const bar = w.querySelector<HTMLElement>(".win-bar")!;
  bar.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || (e.target as Element).closest("button, a") || w.classList.contains("max")) return;
    const x = w.offsetLeft;
    const y = w.offsetTop;
    track(w, e, (dx, dy) => {
      const maxX = document.documentElement.clientWidth - 80;
      w.style.left = `${Math.min(maxX, Math.max(80 - w.offsetWidth, x + dx))}px`;
      w.style.top = `${Math.min(window.innerHeight - 40, Math.max(TOP, y + dy))}px`;
    });
  });
  bar.addEventListener("dblclick", (e) => {
    if (!(e.target as Element).closest("button, a")) morph(() => w.classList.toggle("max"));
  });

  w.querySelector<HTMLElement>(".win-grip")!.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const x = w.offsetWidth;
    const y = w.offsetHeight;
    track(w, e, (dx, dy) => {
      w.style.width = `${Math.max(320, x + dx)}px`;
      w.style.height = `${Math.max(200, y + dy)}px`;
    });
  });
}

if (icons.length && window.self === window.top) {
  const select = (icon: HTMLAnchorElement | null) => {
    for (const i of icons) i.classList.toggle("sel", i === icon);
  };
  for (const icon of icons) {
    icon.addEventListener("click", (e) => {
      if (!wide.matches || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      // Keyboard (Enter) and touch open straight away; a mouse selects first, like a desktop.
      const touch = (e as PointerEvent).pointerType === "touch" || (e as PointerEvent).pointerType === "pen";
      if (e.detail === 0 || touch || e.detail >= 2) open(icon);
      else select(icon);
    });
  }
  document.addEventListener("pointerdown", (e) => {
    if (!(e.target as Element).closest("a.desk-icon")) select(null);
  });
  // Clicking into a page inside a window moves focus to its frame; bring that window forward.
  window.addEventListener("blur", () => {
    setTimeout(() => {
      const a = document.activeElement;
      if (a instanceof HTMLIFrameElement) {
        const w = a.closest<HTMLElement>(".win");
        if (w) front(w);
      }
    });
  });
}

// The clock on the desk's tool strip.
const clock = document.querySelector<HTMLTimeElement>("[data-clock]");
if (clock) {
  const tick = () => {
    const d = new Date();
    const hm = d.toLocaleTimeString(zh ? "zh-CN" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    clock.textContent = hm;
    clock.dateTime = hm;
  };
  tick();
  clock.hidden = false;
  setTimeout(() => {
    tick();
    setInterval(tick, 60_000);
  }, (60 - new Date().getSeconds()) * 1000);
}
