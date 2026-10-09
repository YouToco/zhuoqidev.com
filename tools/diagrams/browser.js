// Runs inside headless Chrome (bundled by generate.mjs). Exposes:
//   window.fromMermaid(source) → { scene, svg }   a new Excalidraw scene drawn from Mermaid text
//   window.fromScene(scene)    → { svg }          re-export a scene (e.g. one edited on excalidraw.com)
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { convertToExcalidrawElements, exportToSvg, restoreElements } from "@excalidraw/excalidraw";
import { mindmapElements } from "./mindmap.js";
import { treeLayout } from "./tree.js";

// mermaid-to-excalidraw 2.2.2 looks subgraphs up by [id='S1'], but Mermaid 11.17 renders them as
// id="<diagram>-S1", so every flowchart with a subgraph fell back to a bitmap. Retry that one
// lookup pattern with the suffixed id.
const qs = Element.prototype.querySelector;
Element.prototype.querySelector = function (sel) {
  const hit = qs.call(this, sel);
  const m = !hit && /^\[id='([^']+)'\]$/.exec(sel);
  return m ? qs.call(this, `g.cluster[id$='-${CSS.escape(m[1])}']`) : hit;
};

// Text is measured on a canvas, so the hand fonts (Excalifont, Xiaolai for CJK) must be live in
// this document first, or every width comes from the fallback font and labels overflow. An
// exported SVG carries @font-face rules for exactly the characters it uses; attaching one that
// uses all of the diagram's characters registers them.
// Keep one space among them: without it the space is measured in the browser's default font, about
// 3px narrower than Excalifont's at 18px, so lines with spaces came out wider than measured.
async function warmFonts(text) {
  const chars = [...new Set(text.replace(/\s+/g, " ").trim())].join("");
  const els = convertToExcalidrawElements([{ type: "text", x: 0, y: 0, text: chars, fontSize: 20, fontFamily: 5 }]);
  const svg = await exportToSvg({ elements: els, appState: { exportBackground: false }, files: null });
  svg.style.cssText = "position:absolute;left:-99999px;top:0";
  document.body.append(svg);
  await document.fonts.ready;
  await Promise.all([...document.fonts].map((f) => f.load().catch(() => {})));
}

const BR = /<br\s*\/?>/gi;

async function toSvg(elements, files) {
  const svg = await exportToSvg({
    elements,
    files: files ?? null,
    appState: { exportBackground: false, exportWithDarkMode: false, viewBackgroundColor: "#ffffff" },
    exportPadding: 12,
  });
  return svg.outerHTML;
}

window.fromMermaid = async (source) => {
  await warmFonts(source.replace(BR, ""));
  let elements;
  let files = null;
  if (/^\s*mindmap\b/.test(source)) {
    // The converter has no mindmap support (it falls back to a bitmap), so lay these out here.
    elements = mindmapElements(source);
  } else {
    // Subgraph ids are looked up in the DOM, which fails for non-ASCII ids: rename those first.
    let src = source;
    let n = 0;
    for (const m of source.matchAll(/^\s*subgraph\s+([^\s[]+)/gm)) {
      if (!/[^\x00-\x7f]/.test(m[1])) continue;
      src = src.replace(new RegExp(`(^|[\\s>|&])${m[1]}(?=$|[\\s[-])`, "gm"), `$1sg_${n++}`);
    }
    // Mermaid sizes the boxes, so let it measure in the hand fonts (loaded by warmFonts above) and
    // break lines only where the source has <br>; otherwise labels wrap or overflow their boxes.
    const parsed = await parseMermaidToExcalidraw(src, {
      themeVariables: { fontSize: "16px", fontFamily: "Excalifont, Xiaolai" },
      flowchart: { curve: "linear", wrappingWidth: 640, nodeSpacing: 26, rankSpacing: 44 },
    });
    // Mermaid sized the boxes for <br> line breaks; Excalidraw needs real newlines.
    for (const e of parsed.elements) {
      if (e.label?.text) e.label.text = e.label.text.replace(BR, "\n");
      if (e.type === "text") e.text = e.text.replace(BR, "\n");
      if (e.name) e.name = e.name.replace(BR, "\n");
    }
    if (parsed.elements.some((e) => e.type === "image")) throw new Error("the converter fell back to a bitmap for this diagram");
    const skeleton = /^\s*%%\s*layout:\s*tree\s*$/m.test(source) ? treeLayout(parsed.elements) : parsed.elements;
    elements = convertToExcalidrawElements(skeleton, { regenerateIds: false });
    files = parsed.files ?? null;
  }
  const scene = {
    type: "excalidraw",
    version: 2,
    source: "https://zhuoqidev.com",
    elements,
    appState: { viewBackgroundColor: "#ffffff", gridSize: null },
    files: files ?? {},
  };
  return { scene, svg: await toSvg(elements, files) };
};

window.fromScene = async (scene) => {
  const elements = restoreElements(scene.elements, null);
  await warmFonts(elements.filter((e) => e.type === "text").map((e) => e.text).join(""));
  return { svg: await toSvg(elements, scene.files) };
};

window.ready = true;
