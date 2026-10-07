import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

// mermaid-to-excalidraw has no mindmap support (it falls back to a bitmap), so lay one out here:
// root in the middle, branches split left/right by leaf count, leaves stacked beside their branch.
const FILLS = ["#ffec99", "#a5d8ff", "#b2f2bb", "#ffc9c9", "#d0bfff", "#ffd8a8"];
const STROKES = ["#f08c00", "#1971c2", "#2f9e44", "#e03131", "#6741d9", "#e8590c"];

export function parseMindmap(src) {
  const lines = src.split("\n").filter((l) => l.trim() && !/^\s*mindmap\s*$/.test(l));
  const strip = (t) => t.trim().replace(/^[\w-]*\(\((.*)\)\)$/, "$1").replace(/^[\w-]*\[(.*)\]$/, "$1").replace(/^[\w-]*\((.*)\)$/, "$1");
  const root = { text: strip(lines[0]), kids: [] };
  const stack = [{ node: root, indent: lines[0].search(/\S/) }];
  for (const l of lines.slice(1)) {
    const indent = l.search(/\S/);
    while (stack.length > 1 && stack.at(-1).indent >= indent) stack.pop();
    const node = { text: strip(l), kids: [] };
    stack.at(-1).node.kids.push(node);
    stack.push({ node, indent });
  }
  return root;
}

const measure = (text, fontSize) => {
  const [t] = convertToExcalidrawElements([{ type: "text", x: 0, y: 0, text, fontSize, fontFamily: 5 }]);
  return { w: t.width, h: t.height };
};

export function mindmapElements(src) {
  const root = parseMindmap(src);
  const S = { root: 24, branch: 18, leaf: 16 };
  const gapLeaf = 10, gapBranch = 26, padX = 14, padY = 9, toBranch = 64, toLeaf = 38, maxLeaf = 175;
  const sk = [];
  const rs = measure(root.text, S.root);
  // an ellipse fits its label in the inscribed rectangle, about 70% of its width
  const rw = rs.w * 1.5 + 24, rh = rs.h + 40;
  sk.push({ type: "ellipse", x: -rw / 2, y: -rh / 2, width: rw, height: rh, backgroundColor: "#fff9db", fillStyle: "hachure", strokeWidth: 2,
    label: { text: root.text, fontSize: S.root, fontFamily: 5 } });
  // Balance the two sides by leaf count; the first branches go right, like a clock.
  const total = root.kids.reduce((n, b) => n + Math.max(1, b.kids.length), 0);
  let acc = 0;
  const sides = { right: [], left: [] };
  root.kids.forEach((b, i) => {
    const side = acc < total / 2 ? "right" : "left";
    acc += Math.max(1, b.kids.length);
    sides[side].push({ ...b, i });
  });
  for (const [side, branches] of Object.entries(sides)) {
    const dir = side === "right" ? 1 : -1;
    const blocks = branches.map((b) => {
      const bs = measure(b.text, S.branch);
      const leaves = b.kids.map((l) => {
        let text = l.text;
        if (measure(text, S.leaf).w > maxLeaf) {
          const spaces = [...text.matchAll(/ /g)].map((m) => m.index);
          const mid = spaces.sort((a, b) => Math.abs(a - text.length / 2) - Math.abs(b - text.length / 2))[0];
          if (mid !== undefined) text = `${text.slice(0, mid)}\n${text.slice(mid + 1)}`;
        }
        return { ...l, text, ...measure(text, S.leaf) };
      });
      const leavesH = leaves.reduce((h, l) => h + l.h + gapLeaf, -gapLeaf);
      return { b, bw: bs.w + padX * 2, bh: bs.h + padY * 2, leaves, h: Math.max(bs.h + padY * 2, leavesH) };
    });
    const height = blocks.reduce((h, k) => h + k.h + gapBranch, -gapBranch);
    let y = -height / 2;
    for (const k of blocks) {
      const cy = y + k.h / 2;
      const bx = dir > 0 ? rw / 2 + toBranch : -rw / 2 - toBranch - k.bw;
      const c = k.b.i % FILLS.length;
      sk.push({ type: "rectangle", x: bx, y: cy - k.bh / 2, width: k.bw, height: k.bh, roundness: { type: 3 },
        backgroundColor: FILLS[c], fillStyle: "solid", strokeColor: STROKES[c], strokeWidth: 2,
        label: { text: k.b.text, fontSize: S.branch, fontFamily: 5, strokeColor: "#1e1e1e" } });
      // root → branch: a gentle S-curve
      const sx = dir * rw * 0.42, sy = (cy / Math.max(1, Math.abs(cy))) * Math.min(Math.abs(cy), rh * 0.3);
      const ex = dir > 0 ? bx : bx + k.bw;
      sk.push({ type: "line", x: sx, y: sy, strokeColor: STROKES[c], strokeWidth: 2.5, roundness: { type: 2 },
        points: [[0, 0], [(ex - sx) * 0.55, (cy - sy) * 0.85], [ex - sx, cy - sy]] });
      // branch → leaves
      let ly = cy - (k.leaves.reduce((h, l) => h + l.h + gapLeaf, -gapLeaf)) / 2;
      const ox = dir > 0 ? bx + k.bw : bx;
      for (const l of k.leaves) {
        const lx = dir > 0 ? ox + toLeaf : ox - toLeaf - l.w; // left edge, for the connector
        const lcy = ly + l.h / 2;
        // a right-aligned text element is placed by its right edge
        sk.push({ type: "text", x: dir > 0 ? lx : lx + l.w, y: ly, text: l.text, fontSize: S.leaf, fontFamily: 5, strokeColor: "#1e1e1e", textAlign: dir > 0 ? "left" : "right" });
        const tx = dir > 0 ? lx - 8 : lx + l.w + 8;
        sk.push({ type: "line", x: ox, y: cy, strokeColor: STROKES[c], strokeWidth: 1.5, roundness: { type: 2 },
          points: [[0, 0], [(tx - ox) * 0.5, (lcy - cy) * 0.9], [tx - ox, lcy - cy]] });
        ly += l.h + gapLeaf;
      }
      y += k.h + gapBranch;
    }
  }
  return convertToExcalidrawElements(sk, { regenerateIds: false });
}
