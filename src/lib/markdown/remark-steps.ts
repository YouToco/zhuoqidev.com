import type { Code, Root } from "mdast";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { fileLang } from "./lang";
import { MAX_STEPS, type StepsSpec, renderSteps } from "./steps";

/**
 * ```steps  →  a walk-through drawn at build time (src/lib/markdown/steps.ts).
 * The fence holds JSON; a malformed one, or one with too few or too many stages, fails the build.
 */
export function remarkSteps() {
  return (tree: Root, file: VFile) => {
    const lang = fileLang(file);
    let n = 0;
    visit(tree, "code", (node: Code, index, parent) => {
      if (!parent || index === undefined || node.lang !== "steps") return;
      let spec: StepsSpec;
      try {
        spec = JSON.parse(node.value) as StepsSpec;
      } catch (e) {
        throw new Error(`${file.path}: steps fence ${n + 1} is not valid JSON: ${(e as Error).message}`, { cause: e });
      }
      // JSON from an author: "steps" may be missing however the type reads.
      const count = (spec as Partial<StepsSpec>).steps?.length ?? 0;
      if (count < 2 || count > MAX_STEPS)
        throw new Error(`${file.path}: steps fence ${n + 1} needs 2 to ${MAX_STEPS} steps, has ${count}`);
      parent.children[index] = { type: "html", value: renderSteps(spec, `steps-${++n}`, lang) };
    });
  };
}
