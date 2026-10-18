import type { Code, Root } from "mdast";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { type OpenerSpec, renderOpener } from "./opener";

/**
 * ```opener  →  an opening scene drawn at build time (src/lib/markdown/opener.ts).
 * The fence holds JSON; a malformed one fails the build instead of shipping a broken scene.
 */
export function remarkOpener() {
  return (tree: Root, file: VFile) => {
    let n = 0;
    visit(tree, "code", (node: Code, index, parent) => {
      if (!parent || index === undefined || node.lang !== "opener") return;
      let spec: OpenerSpec;
      try {
        spec = JSON.parse(node.value) as OpenerSpec;
      } catch (e) {
        throw new Error(`${file.path}: opener fence ${n + 1} is not valid JSON: ${(e as Error).message}`, { cause: e });
      }
      if (!spec.word || !spec.headline)
        throw new Error(`${file.path}: opener fence ${n + 1} needs "word" and "headline"`);
      parent.children[index] = { type: "html", value: renderOpener(spec, `opener-${++n}`) };
    });
  };
}
