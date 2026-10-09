import type { Code, Root } from "mdast";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { type ComicError, comicCols, parseComic } from "./comic.ts";
import { renderComicHtml } from "./comic-html.ts";
import { fileLang } from "./lang";

/**
 * ```comic  →  a comic drawn at build time as HTML panels (./comic-html.ts). A script error fails
 * the build with the file and line, instead of shipping a broken comic.
 */
export function remarkComic() {
  return (tree: Root, file: VFile) => {
    const lang = fileLang(file);
    visit(tree, "code", (node: Code, index, parent) => {
      if (!parent || index === undefined || node.lang !== "comic") return;
      try {
        const html = renderComicHtml(parseComic(node.value), comicCols(node.meta ?? ""), lang);
        parent.children[index] = { type: "html", value: html };
      } catch (e) {
        const at = (node.position?.start.line ?? 0) + ((e as ComicError).line ?? 0);
        throw new Error(`${file.path}:${at}: comic: ${(e as Error).message}`);
      }
    });
  };
}
