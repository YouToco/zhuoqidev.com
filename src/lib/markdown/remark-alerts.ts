import type { Blockquote, Paragraph, Root, Text } from "mdast";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { fileLang } from "./lang";

const STAMP = {
  zh: { NOTE: "注意", TIP: "提示", IMPORTANT: "重要", WARNING: "警告", CAUTION: "当心" },
  en: { NOTE: "Note", TIP: "Tip", IMPORTANT: "Key", WARNING: "Warn", CAUTION: "Careful" },
} as const;
type Kind = keyof (typeof STAMP)["zh"];

/**
 * GitHub alert blockquotes (`> [!NOTE]`) become stamped call-out boxes.
 * The Markdown source stays plain GFM, which agents and GitHub both understand.
 */
export function remarkAlerts() {
  return (tree: Root, file: VFile) => {
    const lang = fileLang(file);
    visit(tree, "blockquote", (node: Blockquote) => {
      const first = node.children[0];
      if (first?.type !== "paragraph") return;
      const head = first.children[0];
      if (head?.type !== "text") return;
      const m = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\n?/.exec(head.value);
      if (!m) return;
      const kind = m[1] as Kind;
      head.value = head.value.slice(m[0].length);
      if (!head.value) first.children.shift();
      if (!first.children.length) node.children.shift();

      const stamp: Paragraph = {
        type: "paragraph",
        data: { hName: "span", hProperties: { className: ["stamp"] } },
        children: [{ type: "text", value: STAMP[lang][kind] } satisfies Text],
      };
      const body: Blockquote = { type: "blockquote", data: { hName: "div" }, children: node.children };
      node.data = {
        hName: "aside",
        hProperties: { className: ["callout", `callout-${kind.toLowerCase()}`], role: "note" },
      };
      node.children = [stamp, body];
    });
  };
}
