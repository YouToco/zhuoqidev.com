// Decision trees (a flowchart marked `%% layout: tree`) are drawn as an indented outline, like the
// ASCII trees they replace, instead of Mermaid's columns: a column per level adds every level's
// width side by side, which made the inference-engine tree 1,480px wide. Here each level steps
// right under its parent, and a node whose only child is a leaf ("condition → answer") shares its
// row with that leaf, with all such answers in one aligned column.
//
// Input and output are Excalidraw element skeletons from mermaid-to-excalidraw; the boxes keep the
// size and colours Mermaid gave them. Edge labels are not drawn in this layout.
const INDENT = 40; // how far a child steps right of its parent
const SPINE = 16; // the vertical tree line, measured from the parent's left edge
const ROW_GAP = 12;
const BRANCH_GAP = 24; // before each top-level branch
const PAIR_GAP = 56; // condition → answer arrow length
const INK = "#1e1e1e";

export function treeLayout(elements) {
  const shapes = new Map(elements.filter((e) => e.type !== "arrow").map((e) => [e.id, e]));
  const kids = new Map();
  const hasParent = new Set();
  for (const a of elements.filter((e) => e.type === "arrow")) {
    if (!kids.has(a.start.id)) kids.set(a.start.id, []);
    kids.get(a.start.id).push(a.end.id);
    hasParent.add(a.end.id);
  }
  const roots = [...shapes.keys()].filter((id) => !hasParent.has(id));
  if (roots.length !== 1) throw new Error(`layout: tree needs one root, found ${roots.length}`);
  const children = (id) => kids.get(id) ?? [];
  const answerOf = (id) => (children(id).length === 1 && !children(children(id)[0]).length ? children(id)[0] : null);

  // One row per node, depth-first; an answer shares its condition's row.
  const rows = [];
  const walk = (id, depth) => {
    const answer = answerOf(id);
    rows.push({ id, depth, answer });
    if (!answer) for (const k of children(id)) walk(k, depth + 1);
  };
  walk(roots[0], 0);

  const answerX = Math.max(...rows.filter((r) => r.answer).map((r) => r.depth * INDENT + shapes.get(r.id).width)) + PAIR_GAP;
  let y = 0;
  rows.forEach((r, i) => {
    const s = shapes.get(r.id);
    const a = r.answer && shapes.get(r.answer);
    const h = Math.max(s.height, a ? a.height : 0);
    if (i > 0 && r.depth === 1) y += BRANCH_GAP - ROW_GAP;
    Object.assign(s, { x: r.depth * INDENT, y: y + (h - s.height) / 2 });
    if (a) Object.assign(a, { x: answerX, y: y + (h - a.height) / 2 });
    y += h + ROW_GAP;
  });

  const lines = [];
  const line = (x, y, points) => lines.push({ type: "line", x, y, points, strokeColor: INK, strokeWidth: 2, roundness: null });
  for (const r of rows) {
    const s = shapes.get(r.id);
    const cy = (e) => e.y + e.height / 2;
    if (r.answer) {
      const a = shapes.get(r.answer);
      const x = s.x + s.width;
      lines.push({ type: "arrow", x, y: cy(s), points: [[0, 0], [a.x - x, 0]], strokeColor: INK, strokeWidth: 2,
        roundness: null, endArrowhead: "arrow", start: { id: s.id }, end: { id: a.id } });
      continue;
    }
    const below = children(r.id).map((k) => shapes.get(k));
    if (!below.length) continue;
    const sx = s.x + SPINE;
    const top = s.y + s.height;
    line(sx, top, [[0, 0], [0, cy(below.at(-1)) - top]]);
    for (const k of below) line(sx, cy(k), [[0, 0], [k.x - sx, 0]]);
  }
  return [...shapes.values(), ...lines];
}
