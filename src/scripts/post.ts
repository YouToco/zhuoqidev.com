// Article page enhancements. Everything here is optional: the article is complete without JS.
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
      copyText(btn, () => btn.closest(".code")?.querySelector("code")?.innerText ?? ""),
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

// Reading progress bar.
const bar = document.querySelector<HTMLElement>(".progress");
const article = document.querySelector<HTMLElement>(".paper");
if (bar && article) {
  const update = () => {
    const r = article.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const pct = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    bar.style.transform = `scaleX(${pct})`;
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}

// Click an article image to see it large. Figures render at the column width; the viewer loads
// a 1600w copy (the same file the Markdown export links to) and fits all of it in the window,
// which needs the picture's aspect ratio before the copy arrives.
const zoomMap = document.getElementById("zoom-map");
const dialog = document.querySelector<HTMLDialogElement>("dialog.zoom");
if (zoomMap && dialog && typeof dialog.showModal === "function") {
  const big = JSON.parse(zoomMap.textContent ?? "{}") as Record<string, string>;
  const view = dialog.querySelector("img")!;
  const label = dialog.getAttribute("aria-label") ?? "";
  for (const img of document.querySelectorAll<HTMLImageElement>(".prose img")) {
    const name = (img.getAttribute("src") ?? "").split("/").pop() ?? "";
    const stem = Object.keys(big).find((k) => name.startsWith(`${k}.`));
    if (!stem) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "zoom-btn";
    btn.setAttribute("aria-label", `${label}: ${img.alt}`);
    img.replaceWith(btn);
    btn.append(img);
    btn.addEventListener("click", () => {
      const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : img.width / img.height;
      if (ratio > 0) view.style.setProperty("--r", String(ratio));
      else view.style.removeProperty("--r");
      view.src = big[stem]!;
      view.alt = img.alt;
      dialog.showModal();
    });
  }
  // A click on the backdrop (outside the picture) closes the viewer.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => view.removeAttribute("src"));
}

export {};
