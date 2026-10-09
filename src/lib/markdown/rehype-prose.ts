import type { Element, ElementContent, Root } from "hast";
import { toText } from "hast-util-to-text";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { fileLang } from "./lang";
import { numberedByAuthor } from "./numbering";

const el = (tagName: string, properties: Element["properties"], children: ElementContent[] = []): Element => ({
  type: "element",
  tagName,
  properties,
  children,
});
const text = (value: string): ElementContent => ({ type: "text", value });

const COPY = { zh: "复制", en: "Copy" } as const;
const FOLD = {
  zh: { show: (n: number) => `展开 · ${n} 行`, hide: "收起", count: (n: number) => `${n} 行代码` },
  en: { show: (n: number) => `Show ${n} lines`, hide: "Hide", count: (n: number) => `${n} lines of code` },
} as const;
// A block this short is about as tall as its folded bar, so folding it would only hide it.
const SHORT = 3;
// The first line as the block's title when it is a comment (`// …`, `# …` but not `#!`, `-- …`, `/* … */`, `<!-- … -->`).
const COMMENT_LINE = /^\s*(?:\/\/+|#(?!!)|--|;+|\/\*+|<!--)\s*(.*?)\s*(?:\*+\/|-->)?\s*$/;
// github-dark-dimmed's comment colour is 4.49:1 on --term (#161a22); this shade is 4.88:1.
const COMMENT = { from: /#768390/gi, to: "#7c8996" };
const COLUMN = 652;

/**
 * Presentation wrappers that the stylesheet hangs off:
 * - highlighted code blocks get a terminal-style frame that folds: the bar shows the language, the
 *   first line as a title when it is a comment, and the line count, and opens the code. Blocks of up
 *   to three lines stay open; a fence marked `open` or `fold` (```ts open) overrides that (the Shiki
 *   transformer in astro.config.ts copies the mark onto the <pre>). The copy button sits outside the
 *   bar, ships `hidden` and is revealed by the page script, so there is no dead control without JS.
 *   The theme's comment grey is lifted to pass WCAG AA on the frame's darker background;
 * - tables get a horizontally scrollable wrapper, and a table with an empty corner cell labels its
 *   rows with the first column (row headers, so screen readers announce what each cell is about);
 * - build-time Mermaid SVGs get a figure frame;
 * - local images get the column width so their srcset is sized for it;
 * - a paragraph made of one emphasised sentence is marked as an editorial note;
 * - h2s of an article that numbers its own sections opt out of the automatic §01 counter.
 */
export function rehypeProse() {
  return (tree: Root, file: VFile) => {
    const lang = fileLang(file);
    const h2s = tree.children.filter((n): n is Element => n.type === "element" && n.tagName === "h2");
    if (numberedByAuthor(h2s.map((h) => toText(h)))) {
      for (const h of h2s) h.properties.className = ["own-number"];
    }
    visit(tree, "element", (node, index, parent) => {
      if (!parent || index === undefined) return;
      // Shiki emits raw `class` / `data-language` keys rather than hast's camel-cased ones.
      const props = node.properties ?? {};
      const cls = props.className ?? props["class"];
      const classes = Array.isArray(cls) ? cls.map(String) : typeof cls === "string" ? cls.split(" ") : [];

      if (node.tagName === "pre" && classes.includes("astro-code")) {
        const language = String(props.dataLanguage ?? props["data-language"] ?? "text");
        const source = toText(node, { whitespace: "pre" }).replace(/\n$/, "");
        const lines = source.split("\n").length;
        const mark = String(props.dataFold ?? props["data-fold"] ?? "");
        const open = mark === "open" || (mark !== "fold" && lines <= SHORT);
        const title = COMMENT_LINE.exec(source.split("\n")[0] ?? "")?.[1];
        const bar = el("summary", { className: ["code-bar"] }, [
          el("i", { ariaHidden: "true" }),
          el("i", { ariaHidden: "true" }),
          el("i", { ariaHidden: "true" }),
          el("span", { className: ["code-lang"] }, [text(language === "plaintext" ? "text" : language)]),
          ...(title ? [el("span", { className: ["code-title"] }, [text(title)])] : []),
          el("span", { className: ["code-fold"], dataShow: FOLD[lang].show(lines), dataHide: FOLD[lang].hide }, [
            // The words on the bar are drawn by CSS from these attributes; screen readers get the count
            // here and the open / closed state from <summary> itself.
            el("span", { className: ["sr-only"] }, [text(FOLD[lang].count(lines))]),
          ]),
        ]);
        visit(node, "element", (span) => {
          if (typeof span.properties?.style === "string") span.properties.style = span.properties.style.replace(COMMENT.from, COMMENT.to);
        });
        const copy = el("button", { className: ["copy"], type: "button", hidden: true }, [text(COPY[lang])]);
        parent.children[index] = el("figure", { className: ["code"] }, [el("details", open ? { open: true } : {}, [bar, node]), copy]);
        return "skip";
      }
      // Article images render at most at the text column width (652 CSS px). Declaring it
      // here gives Astro a 1x/2x srcset around that width instead of one up to the 4K original.
      if (node.tagName === "img" && !/^(https?:)?\/\//.test(String(node.properties?.src ?? ""))) {
        node.properties.width ??= COLUMN;
        return;
      }
      // A paragraph that is only an *emphasised* sentence is an editorial note (dates, sources).
      if (node.tagName === "p") {
        const kids = node.children.filter((c) => !(c.type === "text" && !c.value.trim()));
        if (kids.length === 1 && kids[0]!.type === "element" && kids[0]!.tagName === "em") {
          node.properties.className = ["ednote"];
        }
        return;
      }
      if (node.tagName === "table") {
        rowHeaders(node);
        parent.children[index] = el("div", { className: ["table-wrap"] }, [node]);
        return "skip";
      }
      if (node.tagName === "svg" && String(node.properties?.id ?? "").startsWith("mermaid")) {
        parent.children[index] = el("figure", { className: ["diagram"] }, [node]);
        return "skip";
      }
      return undefined;
    });
  };
}

const child = (node: Element, tagName: string) =>
  node.children.find((c): c is Element => c.type === "element" && c.tagName === tagName);

/** `| | A | B |` tables: the first column names the rows, so its cells become `<th scope="row">`. */
function rowHeaders(table: Element) {
  const corner = child(child(child(table, "thead") ?? table, "tr") ?? table, "th");
  if (!corner || toText(corner).trim()) return;
  for (const row of child(table, "tbody")?.children ?? []) {
    if (row.type !== "element" || row.tagName !== "tr") continue;
    const first = child(row, "td");
    if (first) Object.assign(first, { tagName: "th", properties: { ...first.properties, scope: "row" } });
  }
}
