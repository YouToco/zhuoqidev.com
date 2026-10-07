import { createHash } from "node:crypto";

/**
 * File name of a Mermaid block's hand-drawn version: `diagrams/<id>.excalidraw` and
 * `public/diagrams/<id>.svg`. Shared by the build (rehype-hand-diagrams.ts) and the generator
 * (tools/diagrams/generate.mjs), so editing a diagram's text gives it a new id and a new drawing.
 */
export const diagramId = (source: string): string =>
  createHash("sha256").update(source.replace(/\r\n/g, "\n").trim()).digest("hex").slice(0, 12);
