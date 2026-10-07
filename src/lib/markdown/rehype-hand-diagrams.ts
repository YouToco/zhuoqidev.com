import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Element, Root } from "hast";
import { toText } from "hast-util-to-text";
import { visit } from "unist-util-visit";
import { diagramId } from "./diagram-id";

const SVGS = join(process.cwd(), "public/diagrams");
const SCENES = join(process.cwd(), "diagrams");

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
 * keeps the Mermaid text, so index.md and the feeds stay readable as text.
 */
export function rehypeHandDiagrams() {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre" || !parent || index === undefined) return;
      const code = node.children.find((c): c is Element => c.type === "element" && c.tagName === "code");
      const cls = code?.properties?.className;
      if (!code || !Array.isArray(cls) || !cls.includes("language-mermaid")) return;
      const id = diagramId(toText(code, { whitespace: "pre" }));
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
      // Clicking opens the post's image viewer (zoomSources in src/lib/content.ts lists diagrams too).
      parent.children[index] = { type: "element", tagName: "figure", properties: { className: ["diagram", "hand"] }, children: [img] };
      return "skip";
    });
  };
}
