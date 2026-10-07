import type { Code, Root } from "mdast";
import { visit } from "unist-util-visit";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * ```html demo height=300 caption="..."  →  a sandboxed live preview.
 * The markup lives in `srcdoc`, so it is in the static HTML (no script needed),
 * and the Markdown export keeps the original fenced block for agents.
 */
export function remarkDemo() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code, index, parent) => {
      if (!parent || index === undefined) return;
      if (node.lang !== "html" || !node.meta?.startsWith("demo")) return;
      const height = Number(/height=(\d+)/.exec(node.meta)?.[1] ?? 280);
      const caption = /caption="([^"]*)"/.exec(node.meta)?.[1] ?? "";
      const doc =
        '<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}' +
        `body{margin:0;display:flex;align-items:center;justify-content:center;min-height:${height}px;` +
        "background:#faf8f5;font-family:system-ui,sans-serif}</style></head><body>" +
        node.value +
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
