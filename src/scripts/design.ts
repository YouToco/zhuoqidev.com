// Design library entry page: preview width, replay, source tabs and the copy buttons.
// Everything is optional: without JS the demo frame, the notes and the source are all there.

const zh = document.documentElement.lang.startsWith("zh");
const said = zh
  ? { done: "复制好了 ✓", fail: "没复制上，手动选一下吧" }
  : { done: "Copied ✓", fail: "Copy failed; select it by hand" };

/**
 * Safari only lets a click write to the clipboard synchronously, so text that still has to be
 * fetched goes in as a ClipboardItem holding a promise; elsewhere writeText after the await is fine.
 */
async function writeClipboard(text: string | Promise<string>): Promise<void> {
  if (typeof text === "string") {
    await navigator.clipboard.writeText(text);
    return;
  }
  if (typeof ClipboardItem !== "undefined" && "write" in navigator.clipboard) {
    try {
      const blob = text.then((s) => new Blob([s], { type: "text/plain" }));
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      return;
    } catch {
      // Firefox before 127 has no promise-valued ClipboardItem: fall through.
    }
  }
  await navigator.clipboard.writeText(await text);
}

function flash(btn: HTMLButtonElement, ok: boolean) {
  const label = btn.querySelector("b") ?? btn;
  const original = label.textContent;
  label.textContent = ok ? said.done : said.fail;
  btn.classList.toggle("ok", ok);
  setTimeout(() => {
    label.textContent = original;
    btn.classList.remove("ok");
  }, 1800);
}

const fetchText = (path: string) =>
  fetch(path).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))));

export function initDesignEntry() {
  const frame = document.querySelector<HTMLIFrameElement>("[data-ds-frame]");
  const demo = document.querySelector<HTMLElement>("[data-ds-demo]");

  // Preview width: the frame itself narrows, so the demo's own media queries see a phone.
  const vp = demo?.querySelector<HTMLElement>(".ds-vp");
  if (frame && vp) {
    vp.hidden = false;
    vp.addEventListener("click", (event) => {
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-vp]");
      if (!b) return;
      vp.querySelectorAll("[data-vp]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const w = b.dataset["vp"];
      frame.style.width = w ? `${w}px` : "";
      frame.classList.toggle("phone", Boolean(w));
    });
  }

  // The site's day / night switch: demos only know prefers-color-scheme, which in a frame follows the
  // system, not this page. They are same-origin, so their `@media (prefers-color-scheme: …)` rules
  // are rewritten to `all` / `not all` while the reader has picked a theme, and put back otherwise.
  if (frame) {
    const original = new WeakMap<CSSMediaRule, string>();
    const sync = () => {
      const theme = document.documentElement.dataset["theme"];
      let sheets: CSSStyleSheet[];
      try {
        sheets = [...(frame.contentDocument?.styleSheets ?? [])];
      } catch {
        return;
      }
      const walk = (rules: CSSRuleList) => {
        for (const item of rules) {
          // Not instanceof: the frame's rules come from its own window's CSSMediaRule.
          if (!("media" in item && "cssRules" in item)) continue;
          const rule = item as CSSMediaRule;
          const text = original.get(rule) ?? rule.media.mediaText;
          const scheme = /prefers-color-scheme:\s*(dark|light)/.exec(text)?.[1];
          if (scheme) {
            original.set(rule, text);
            rule.media.mediaText = !theme ? text : scheme === theme ? "all" : "not all";
          }
          walk(rule.cssRules);
        }
      };
      for (const sheet of sheets) {
        try {
          walk(sheet.cssRules);
        } catch {
          // A cross-origin stylesheet (a CDN font or library) cannot be read; it has no theme rules.
        }
      }
    };
    frame.addEventListener("load", sync);
    if (frame.contentDocument?.readyState === "complete") sync();
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  // Replay: reload the demo (same origin), so entrance animations run again.
  const replay = demo?.querySelector<HTMLButtonElement>("[data-replay]");
  if (frame && replay) {
    replay.hidden = false;
    replay.addEventListener("click", () => {
      try {
        frame.contentWindow?.location.reload();
      } catch {
        frame.setAttribute("src", frame.getAttribute("src") ?? "");
      }
    });
  }

  // Source tabs.
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('.ds-tabs [role="tab"]')];
  const panes = [...document.querySelectorAll<HTMLElement>(".ds-pane")];
  let current = 0;
  const sourceBtn = document.querySelector<HTMLButtonElement>("[data-copy-source]");
  const select = (i: number) => {
    current = i;
    tabs.forEach((t, k) => t.setAttribute("aria-selected", String(k === i)));
    panes.forEach((p, k) => (p.hidden = k !== i));
    const small = sourceBtn?.querySelector("small");
    if (small) small.textContent = tabs[i]?.textContent.trim() ?? "";
  };
  for (const [i, tab] of tabs.entries()) {
    tab.addEventListener("click", () => select(i));
    tab.addEventListener("keydown", (event) => {
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      const next = (current + step + tabs.length) % tabs.length;
      select(next);
      tabs[next]?.focus();
    });
  }

  // The DOM types promise a clipboard, but browsers leave it undefined outside secure contexts.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see above
  if (!navigator.clipboard) return;
  const copyBox = document.querySelector<HTMLElement>("[data-ds-copy]");
  if (copyBox) copyBox.hidden = false;

  const promptBtn = document.querySelector<HTMLButtonElement>("[data-copy-prompt]");
  if (promptBtn) {
    const path = promptBtn.dataset["copyPrompt"]!.replace(/index\.md$/, "prompt.md");
    // Fetched ahead (after load, when the network is idle) so the click can copy synchronously.
    let cached: string | null = null;
    const warm = () =>
      void fetchText(path).then(
        (s) => (cached = s),
        () => {},
      );
    if (document.readyState === "complete") setTimeout(warm, 600);
    else addEventListener("load", () => setTimeout(warm, 600), { once: true });
    promptBtn.addEventListener("click", () => {
      writeClipboard(cached ?? fetchText(path)).then(
        () => flash(promptBtn, true),
        () => flash(promptBtn, false),
      );
    });
  }

  if (sourceBtn) {
    sourceBtn.addEventListener("click", () => {
      // textContent, not innerText: hidden panes have no rendered layout.
      const text = panes[current]?.querySelector("code")?.textContent ?? "";
      writeClipboard(text).then(
        () => flash(sourceBtn, true),
        () => flash(sourceBtn, false),
      );
    });
  }

  const linkBtn = document.querySelector<HTMLButtonElement>("[data-copy-link]");
  if (linkBtn) {
    linkBtn.addEventListener("click", () => {
      writeClipboard(new URL(linkBtn.dataset["copyLink"]!, location.href).href).then(
        () => flash(linkBtn, true),
        () => flash(linkBtn, false),
      );
    });
  }
}
