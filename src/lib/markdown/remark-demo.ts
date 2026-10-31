import type { Code, Root } from "mdast";
import { visit } from "unist-util-visit";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The site's colours, light and dark, so a demo can draw with var(--ink), var(--seal) and friends.
// A sandboxed frame only sees the system setting, so the page also posts its own day / night choice
// ({ zqTheme: "dark" | "light" }, src/scripts/site.ts) and the frame puts it on its root.
const LIGHT =
  "--paper:#fbf8f1;--paper-2:#f3eee2;--card:#fffdf8;--ink:#1c2230;--ink-2:#4a5163;--ink-3:#636877;--line:#e6dfd0;" +
  "--seal:#c0391f;--blue:#2f5bd3;--green:#277a4b;--gold:#c9a400;--gray:#bdb5a5;color-scheme:light";
const DARK =
  "--paper:#14161b;--paper-2:#1c1f26;--card:#1e2129;--ink:#ece7dc;--ink-2:#bab6ac;--ink-3:#959aa8;--line:#31353f;" +
  "--seal:#f0694e;--blue:#8eaaff;--green:#5cc189;--gold:#e2bd4f;--gray:#596070;color-scheme:dark";
const THEME =
  '<script>addEventListener("message",function(e){var t=e.data&&e.data.zqTheme;' +
  'if(t==="dark"||t==="light")document.documentElement.dataset.theme=t})</script>' +
  `<style>:root{${LIGHT}}:root[data-theme="dark"]{${DARK}}` +
  `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${DARK}}}</style>`;
// The frame's height is fixed in the fence, so on a narrow screen a demo whose content wraps would be
// cut off. The frame reports how tall its body is ({ zqDemoHeight }; the body's min-height is the fence
// height, so this is never less) and site.ts grows or shrinks the iframe to that, never below the fence.
// It measures the body, not the document, which is at least as tall as the frame and would never shrink.
const FIT =
  '<script>(function(){function s(){parent.postMessage({zqDemoHeight:Math.ceil(document.body.getBoundingClientRect().height)},"*")}' +
  'addEventListener("load",s);if(window.ResizeObserver)new ResizeObserver(s).observe(document.body)})()</script>';

/**
 * ```html demo height=300 caption="..."  →  a sandboxed live preview.
 * The markup lives in `srcdoc`, so it is in the static HTML (no script needed),
 * and the Markdown export keeps the original fenced block for agents.
 * The frame follows the site's day / night switch; see THEME above.
 */
export function remarkDemo() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code, index, parent) => {
      if (!parent || index === undefined) return;
      if (node.lang !== "html" || !node.meta?.startsWith("demo")) return;
      const height = Number(/height=(\d+)/.exec(node.meta)?.[1] ?? 280);
      const caption = /caption="([^"]*)"/.exec(node.meta)?.[1] ?? "";
      const doc =
        '<!DOCTYPE html><html><head><meta charset="utf-8">' +
        THEME +
        `<style>*{box-sizing:border-box}body{margin:0;display:flex;align-items:center;justify-content:center;min-height:${height}px;` +
        "background:var(--card);color:var(--ink);font-family:system-ui,sans-serif}</style></head><body>" +
        node.value +
        FIT +
        "</body></html>";
      const html =
        `<figure class="demo"><iframe title="${esc(caption || "Live demo")}" sandbox="allow-scripts" ` +
        `loading="lazy" style="height:${height}px" srcdoc="${esc(doc)}"></iframe>` +
        (caption ? `<figcaption>${esc(caption)}</figcaption>` : "") +
        "</figure>";
      parent.children[index] = { type: "html", value: html };
    });
  };
}
