import type { Code, Root } from "mdast";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { type ChartSpec, renderChart } from "./chart";
import { fileLang } from "./lang";

/**
 * ```chart  →  a chart drawn at build time (src/lib/markdown/chart.ts).
 * The fence holds JSON; a malformed one fails the build instead of shipping a broken figure.
 */
export function remarkChart() {
  return (tree: Root, file: VFile) => {
    const lang = fileLang(file);
    let n = 0;
    visit(tree, "code", (node: Code, index, parent) => {
      if (!parent || index === undefined || node.lang !== "chart") return;
      let spec: ChartSpec;
      try {
        spec = JSON.parse(node.value) as ChartSpec;
      } catch (e) {
        throw new Error(`${file.path}: chart fence ${n + 1} is not valid JSON: ${(e as Error).message}`);
      }
      parent.children[index] = { type: "html", value: renderChart(spec, `chart-${++n}`, lang) };
    });
  };
}
