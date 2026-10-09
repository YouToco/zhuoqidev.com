import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Element, Root } from "hast";
import { toText } from "hast-util-to-text";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { diagramId } from "./diagram-id";
import { fileLang } from "./lang";

const SVGS = join(process.cwd(), "public/diagrams");
const SCENES = join(process.cwd(), "diagrams");
const SOURCE = { zh: "查看源码（Mermaid）", en: "View source (Mermaid)" } as const;

/** The labels of a scene, in drawing order (a box's label where the box is), as the image's text alternative. */
function describe(id: string): string {
  type El = { id: string; type: string; text?: string; containerId?: string | null; isDeleted?: boolean };
  const { elements } = JSON.parse(readFileSync(join(SCENES, `${id}.excalidraw`), "utf8")) as { elements: El[] };
  const live = elements.filter((e) => !e.isDeleted);
  const label = (e: El | undefined) => e?.text?.replace(/\s+/g, " ").trim() ?? "";
  const bound = new Map(live.filter((e) => e.type === "text" && e.containerId).map((e) => [e.containerId!, e]));
  const labels = live.map((e) => (e.type === "text" ? (e.containerId ? "" : label(e)) : label(bound.get(e.id)))).filter(Boolean);
  return [...new Set(labels)].join(" · ");
}

/**
 * Swaps each ```mermaid block for its hand-drawn Excalidraw version (`npm run diagrams` draws
 * them into public/diagrams/). Runs before rehype-mermaid, which still draws any block that has
 * no hand-drawn version yet; `npm run verify` fails the build when that happens. The Markdown
 * keeps the Mermaid text, so index.md and the feeds stay readable as text. The page keeps it too,
 * folded under the drawing: an agent reading the HTML gets the diagram's structure (the picture's
 * alt text only lists its labels), and a reader can open and copy it.
 */
export function rehypeHandDiagrams() {
  return (tree: Root, file: VFile) => {
    const lang = fileLang(file);
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre" || !parent || index === undefined) return;
      const code = node.children.find((c): c is Element => c.type === "element" && c.tagName === "code");
      const cls = code?.properties?.className;
      if (!code || !Array.isArray(cls) || !cls.includes("language-mermaid")) return;
      const source = toText(code, { whitespace: "pre" });
      const id = diagramId(source);
      const svg = join(SVGS, `${id}.svg`);
      if (!existsSync(svg)) return;
      const head = readFileSync(svg, "utf8").slice(0, 400);
      const size = (attr: string) => Math.round(Number(new RegExp(`\\s${attr}="([\\d.]+)"`).exec(head)?.[1] ?? 0));
      const src = `/diagrams/${id}.svg`;
      const img: Element = {
        type: "element",
        tagName: "img",
        // alt last: labels can hold ">" (valid in an attribute), which ends naive <img …> matches early
        properties: { src, width: size("width"), height: size("height"), loading: "lazy", decoding: "async", alt: describe(id) },
        children: [],
      };
      // rehype-prose frames the <pre> like any other code block (language label, copy button); it is
      // already folded behind this toggle, so the block itself opens unfolded.
      const folded: Element = {
        type: "element",
        tagName: "details",
        properties: { className: ["diagram-src"], dataPagefindIgnore: true },
        children: [
          { type: "element", tagName: "summary", properties: {}, children: [{ type: "text", value: SOURCE[lang] }] },
          {
            type: "element",
            tagName: "pre",
            properties: { className: ["astro-code"], dataLanguage: "mermaid", dataFold: "open", tabIndex: 0, style: "color:#adbac7" },
            children: [{ type: "element", tagName: "code", properties: {}, children: [{ type: "text", value: source.replace(/\n$/, "") }] }],
          },
        ],
      };
      // Clicking opens the post's image viewer (zoomSources in src/lib/content.ts lists diagrams too).
      parent.children[index] = { type: "element", tagName: "figure", properties: { className: ["diagram", "hand"] }, children: [img, folded] };
      return "skip";
    });
  };
}
