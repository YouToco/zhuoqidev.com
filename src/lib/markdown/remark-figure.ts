import type { Image, Paragraph, Root } from "mdast";
import { visit } from "unist-util-visit";

/**
 * A paragraph holding a single titled image becomes <figure> + <figcaption>.
 * Source form: ![alt](./diagram.png "caption") — plain CommonMark.
 */
export function remarkFigure() {
  return (tree: Root) => {
    visit(tree, "paragraph", (node: Paragraph, index, parent) => {
      if (!parent || index === undefined) return;
      const kids = node.children.filter((c) => !(c.type === "text" && !c.value.trim()));
      if (kids.length !== 1 || kids[0]?.type !== "image") return;
      const image = kids[0] as Image;
      const caption = image.title;
      if (!caption) return;
      image.title = null;
      parent.children[index] = {
        type: "figure",
        data: { hName: "figure", hProperties: { className: ["figure"] } },
        children: [
          image,
          { type: "figcaption", data: { hName: "figcaption" }, children: [{ type: "text", value: caption }] },
        ],
      } as never;
    });
  };
}
