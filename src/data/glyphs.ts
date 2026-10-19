// One drawn object per article or project, named in its front matter (`glyph: mac-mini`). Each glyph is a
// list of plain shapes on a 100 x 100 grid. src/lib/glyphs.ts draws the same shapes twice: as a
// rough pen sketch for the post lists (src/components/PostGlyph.astro) and as a bold ink object
// on a colored tile for the article header (src/components/PostSticker.astro).

/** How a closed shape is filled: pen hatching (solid ink on the tile), solid ink, paper, or nothing. */
export type Fill = "hatch" | "ink" | "paper" | "none";

interface Style {
  fill?: Fill;
  /** Drawn in the seal red instead of ink. */
  accent?: boolean;
  /** A finer pen, for details. */
  thin?: boolean;
  /** Sits on an inked area: the tile draws it in paper color so it stays visible. */
  onInk?: boolean;
  /** A tiny detail (a port, a light): the sketch draws it with a steadier hand so it stays legible. */
  small?: boolean;
}

export type Shape =
  | ({ k: "poly"; pts: [number, number][] } & Style)
  | ({ k: "path"; d: string } & Style)
  | ({ k: "ellipse"; cx: number; cy: number; w: number; h: number } & Style)
  | ({ k: "rect"; x: number; y: number; w: number; h: number } & Style)
  | ({ k: "line"; x1: number; y1: number; x2: number; y2: number } & Style)
  /** A keyword or number from the article, lettered in the hand face. Keep it the same in both
   * languages (a term, a figure), since one drawing serves both editions. */
  | ({ k: "text"; x: number; y: number; t: string; size: number } & Style);

export interface Glyph {
  /** What the drawing shows, used as its accessible name. */
  label: { zh: string; en: string };
  /** Background of the article-header tile: 1 lilac, 2 sky, 3 coral, 4 butter. */
  tile: 1 | 2 | 3 | 4;
  /** Small four-point stars around the object on the tile: [x, y, scale]. */
  sparks: [number, number, number][];
  shapes: Shape[];
}

const P = (pts: [number, number][], s: Style = {}): Shape => ({ k: "poly", pts, ...s });
const D = (d: string, s: Style = {}): Shape => ({ k: "path", d, ...s });
const E = (cx: number, cy: number, w: number, h: number, s: Style = {}): Shape => ({ k: "ellipse", cx, cy, w, h, ...s });
const R = (x: number, y: number, w: number, h: number, s: Style = {}): Shape => ({ k: "rect", x, y, w, h, ...s });
const L = (x1: number, y1: number, x2: number, y2: number, s: Style = {}): Shape => ({ k: "line", x1, y1, x2, y2, ...s });
const T = (x: number, y: number, t: string, size: number, s: Style = {}): Shape => ({ k: "text", x, y, t, size, ...s });

const paper = { fill: "paper" } as const;
const hatch = { fill: "hatch" } as const;
const ink = { fill: "ink" } as const;
const thin = { thin: true } as const;
const red = { accent: true } as const;

export const GLYPHS = {
  "mac-mini": {
    // The current Mac mini as Apple shows it, seen from the front: two USB-C slots on the left,
    // the status light and headphone jack on the right, and the dark vented base tucked in
    // underneath. The light is red, as in the article's opening scene.
    label: { zh: "一台 Mac mini", en: "A Mac mini" },
    tile: 2,
    sparks: [[20, 22, 1.3], [70, 16, 0.9], [92, 74, 0.6]],
    shapes: [
      P([[17, 37], [22, 31], [78, 31], [83, 37]], paper),
      D("M20 37 H80 Q86 37 86 43 V63 Q86 66 83 66 H17 Q14 66 14 63 V43 Q14 37 20 37 Z", paper),
      D("M21 66 H79 Q77 73 70 74 H30 Q23 73 21 66 Z", hatch),
      D("M26 47.5 a1.5 1.5 0 0 1 3 0 v8 a1.5 1.5 0 0 1 -3 0 Z", { ...ink, small: true }),
      D("M34 47.5 a1.5 1.5 0 0 1 3 0 v8 a1.5 1.5 0 0 1 -3 0 Z", { ...ink, small: true }),
      E(66, 51.5, 2.4, 2.4, { ...ink, ...red, small: true }),
      E(74, 51.5, 4.4, 4.4, { ...ink, small: true }),
    ],
  },
  // The three bills the article teaches you to split (waiting or computing, bytes moved, a row
  // per request), adding up to zero: most apps start on free tiers.
  "three-bills": {
    label: { zh: "一张三行账单，合计 ¥0", en: "A three-line bill that adds up to ¥0" },
    tile: 4,
    sparks: [[86, 20, 1.3], [10, 40, 0.8]],
    shapes: [
      D("M20 10 L66 8 L70 84 L64 80 L58 85 L52 80 L46 85 L40 80 L34 85 L28 81 Z", paper),
      T(34, 25, "CPU", 9),
      L(46, 22, 60, 22, thin),
      T(34, 39, "KB", 9),
      L(46, 36, 60, 36, thin),
      T(34, 53, "DB", 9),
      L(46, 50, 60, 50, thin),
      R(28, 60, 36, 13, hatch),
      T(46, 70.5, "¥0", 11, { onInk: true }),
      E(82, 84, 22, 8, { ...paper, ...red }),
      E(82, 78, 22, 8, { ...hatch, ...red }),
    ],
  },
  // Who can post, read comments and answer DMs is set by each platform's own API; the tools only
  // carry those abilities. A hand truck carrying the three jobs.
  "hand-truck": {
    label: { zh: "一辆手推车，运着发帖、评论、私信三只箱子", en: "A hand truck carrying three boxes: posts, comments, DMs" },
    tile: 4,
    sparks: [[84, 18, 1.3], [92, 34, 0.7]],
    shapes: [
      L(22, 8, 34, 8),
      L(28, 8, 28, 86),
      L(28, 86, 70, 86),
      R(32, 60, 30, 25, paper),
      T(47, 78, "#", 15),
      R(34, 36, 26, 23, hatch),
      T(47, 53, "@", 15, { onInk: true }),
      R(36, 14, 22, 21, { ...paper, ...red }),
      T(47, 29, "DM", 10, red),
      E(30, 88, 15, 15, paper),
      E(30, 88, 4, 4, { ...ink, small: true }),
    ],
  },
  // Ebbinghaus's forgetting curve, the start of the article's history of memory, with the review
  // points that flatten it.
  "forgetting-curve": {
    label: { zh: "艾宾浩斯遗忘曲线和两次复习", en: "Ebbinghaus's forgetting curve with two reviews" },
    tile: 4,
    sparks: [[86, 14, 1.2], [92, 30, 0.7]],
    shapes: [
      L(14, 10, 14, 86),
      L(14, 86, 92, 86),
      D("M10 16 L14 10 L18 16", thin),
      D("M86 82 L92 86 L86 90", thin),
      L(14, 30, 92, 30, thin),
      L(14, 58, 92, 58, thin),
      D("M16 14 Q20 58 36 66", {}),
      D("M36 66 L36 22 Q44 50 62 56", red),
      D("M62 56 L62 26 Q72 36 90 40", red),
      E(36, 22, 4, 4, { ...ink, ...red, small: true }),
      E(62, 26, 4, 4, { ...ink, ...red, small: true }),
    ],
  },
  // The article is a correction: how far up the chain can the coupon's source be proven? Lower
  // rungs are checked; the top ones stay dashed.
  "evidence-ladder": {
    label: { zh: "一架证据梯：下面几级核实了，上面几级还是虚线", en: "An evidence ladder: lower rungs checked, upper rungs still dashed" },
    tile: 4,
    sparks: [[90, 12, 1.1], [94, 50, 0.7]],
    shapes: [
      L(34, 94, 44, 6),
      L(64, 94, 74, 6),
      L(35.5, 80, 65.5, 80),
      L(37.3, 64, 67.3, 64),
      L(39.1, 48, 69.1, 48),
      L(41, 32, 47, 32, thin),
      L(52, 32, 58, 32, thin),
      L(63, 32, 71, 32, thin),
      L(42.8, 16, 48, 16, thin),
      L(53, 16, 59, 16, thin),
      L(64, 16, 72.8, 16, thin),
      D("M72 78 l3 3 6 -7", red),
      D("M74 62 l3 3 6 -7", red),
      D("M76 46 l3 3 6 -7", red),
      T(84, 26, "?", 15, red),
      P([[4, 72], [30, 68], [33, 90], [7, 94]], paper),
      T(18, 86, "%", 13),
    ],
  },
  // Programmatic tool calling: the pile of tool results stays inside a code sandbox, and only one
  // small, filtered result goes back to the model.
  "code-sandbox": {
    label: { zh: "一摞工具结果进代码沙箱，只出来一张小纸条", en: "A pile of tool results goes into a code sandbox; one small note comes out" },
    tile: 1,
    sparks: [[88, 14, 1.2], [10, 88, 0.8]],
    shapes: [
      R(4, 28, 26, 32, paper),
      R(8, 33, 26, 32, paper),
      R(12, 38, 26, 32, paper),
      L(17, 47, 33, 47, thin),
      L(17, 54, 31, 54, thin),
      L(17, 61, 29, 61, thin),
      D("M40 54 h8 M44 50 l4 4 -4 4", {}),
      R(50, 34, 40, 32, ink),
      T(70, 55, "</>", 14, { onInk: true }),
      D("M70 68 v6 M66.5 71 l3.5 3.5 3.5 -3.5", red),
      R(60, 78, 22, 14, { ...paper, ...red }),
      L(65, 85, 77, 85, { ...thin, ...red }),
    ],
  },
  // The article's two plain-language pictures of the Codex harness: a long command is like taking
  // a queue number (the window can serve others, the job is not lost) and a goal is a work order
  // that outlives a shift.
  "queue-ticket": {
    label: { zh: "取号机吐出一张号码票，旁边是一张工单", en: "A queue-number machine with a ticket, beside a work order" },
    tile: 1,
    sparks: [[10, 12, 1.1], [94, 92, 0.8]],
    shapes: [
      R(58, 26, 32, 50, paper),
      R(66, 21, 16, 8, hatch),
      D("M63 40 l3 3 5 -6", red),
      L(74, 41, 85, 41, thin),
      D("M63 54 l3 3 5 -6", red),
      L(74, 55, 84, 55, thin),
      R(63, 64, 8, 8, thin),
      L(74, 69, 82, 69, thin),
      R(10, 16, 42, 58, paper),
      R(16, 23, 30, 15, ink),
      T(31, 35, "A07", 11, { onInk: true }),
      L(18, 56, 44, 56),
      P([[20, 56], [42, 56], [46, 88], [24, 92]], { ...paper, ...red }),
      T(33, 79, "07", 12, red),
    ],
  },
  // A model is an engineer with a small desk: hundreds of manuals stay on the shelf, BM25 ranks
  // them, and only the top few come to the desk.
  "small-desk": {
    label: { zh: "一张小书桌只放三本书，几百本说明书留在书架上，由 BM25 挑", en: "A small desk holding three books, the hundreds of manuals left on the shelf, picked by BM25" },
    tile: 1,
    sparks: [[52, 10, 1.1], [8, 30, 0.7]],
    shapes: [
      R(64, 8, 28, 7, thin),
      R(62, 15, 28, 7, thin),
      R(65, 22, 28, 7, thin),
      R(63, 29, 28, 7, thin),
      R(64, 36, 28, 7, thin),
      R(62, 43, 28, 7, thin),
      R(65, 50, 28, 7, thin),
      R(63, 57, 28, 7, thin),
      T(78, 76, "BM25", 11, red),
      D("M62 40 Q48 26 38 38", red),
      D("M38 38 l1 -7 M38 38 l7 -1", red),
      R(12, 46, 8, 22, paper),
      R(21, 42, 8, 26, { ...hatch, ...red }),
      R(30, 48, 8, 20, paper),
      P([[6, 68], [56, 68], [56, 74], [6, 74]], hatch),
      L(10, 74, 10, 94),
      L(52, 74, 52, 94),
    ],
  },
  // Outcomes: an independent reviewer marks each line of the rubric and sends failures back for
  // another pass. Dreaming: between sessions, at night, the memory is tidied.
  "rubric-loop": {
    label: { zh: "一张评分表，不合格的一条被打回重做，旁边一弯月亮", en: "A rubric with one failed line sent back for rework, and a crescent moon" },
    tile: 1,
    sparks: [[94, 52, 1.0], [8, 10, 0.8]],
    shapes: [
      R(10, 20, 50, 70, paper),
      R(24, 14, 22, 10, hatch),
      D("M18 36 l4 4 7 -8", {}),
      L(34, 37, 52, 37, thin),
      D("M18 52 l4 4 7 -8", {}),
      L(34, 53, 50, 53, thin),
      D("M19 66 l8 8 M27 66 l-8 8", red),
      L(34, 71, 52, 71, thin),
      D("M58 72 Q80 74 78 50 Q76 32 64 32", red),
      D("M64 32 l7 -4 M64 32 l6 5", red),
      D("M92 28 A14 14 0 1 1 79 7 A11 11 0 1 0 92 28 Z", hatch),
    ],
  },
  // Three kinds of agent memory, one decision: the article's whole framework on a signpost.
  "signpost": {
    label: { zh: "一根路标，三块牌子：RAG、Wiki、纯文本", en: "A signpost with three signs: RAG, Wiki, plain text" },
    tile: 4,
    sparks: [[92, 12, 1.1], [8, 92, 0.7]],
    shapes: [
      R(46, 14, 8, 80, paper),
      P([[16, 18], [74, 18], [84, 28], [74, 38], [16, 38]], paper),
      T(46, 33, "RAG", 13),
      P([[84, 44], [26, 44], [16, 54], [26, 64], [84, 64]], hatch),
      T(54, 59, "Wiki", 13, { onInk: true }),
      P([[20, 70], [72, 70], [82, 80], [72, 90], [20, 90]], { ...paper, ...red }),
      T(48, 85, "TXT", 13, red),
      L(28, 96, 72, 96),
    ],
  },
  // One missing absolute path in SKILL.md cost 15 exec calls a run; adding that one line cut tool
  // calls by 84%.
  "skill-path": {
    label: { zh: "SKILL.md 里补上的一行路径，工具调用少了 84%", en: "One added path line in SKILL.md, 84% fewer tool calls" },
    tile: 3,
    sparks: [[90, 12, 1.1], [8, 94, 0.7]],
    shapes: [
      D("M12 8 H52 L64 20 V92 H12 Z", paper),
      D("M52 8 V20 H64", thin),
      T(30, 20, "SKILL.md", 8),
      L(18, 32, 54, 32, thin),
      L(18, 40, 48, 40, thin),
      R(16, 46, 42, 10, { ...hatch, ...red }),
      L(18, 64, 52, 64, thin),
      L(18, 72, 46, 72, thin),
      L(18, 80, 50, 80, thin),
      E(76, 70, 36, 36, { ...paper, ...red }),
      T(76, 75, "-84%", 12, red),
    ],
  },
  // Vector search was down and BM25 text search kept memory working; a free embedding API was the
  // last piece of the puzzle.
  "last-piece": {
    label: { zh: "拼好三块的拼图（一块写着 BM25），最后一块 vec 正要放进去", en: "A puzzle with three pieces in place, one marked BM25, and the vec piece going in last" },
    tile: 3,
    sparks: [[90, 10, 1.1], [8, 94, 0.7]],
    shapes: [
      D("M12 12 H48 V24 a6 6 0 0 1 0 12 V48 H36 a6 6 0 0 1 -12 0 H12 Z", paper),
      T(30, 33, "BM25", 10),
      D("M48 12 H84 V48 H66 a6 6 0 0 1 -12 0 H48 V36 a6 6 0 0 0 0 -12 Z", hatch),
      D("M12 48 H24 a6 6 0 0 0 12 0 H48 V60 a6 6 0 0 1 0 12 V84 H12 Z", paper),
      D("M48 48 H54 a6 6 0 0 0 12 0 H84 V84 H48 V72 a6 6 0 0 0 0 -12 Z", thin),
      D("M58 58 H64 a6 6 0 0 0 12 0 H94 V94 H58 V82 a6 6 0 0 0 0 -12 Z", { ...paper, ...red }),
      T(78, 82, "vec", 12, red),
    ],
  },
  // The worst failure in the article: compaction silently swallowed the bot's replies. A reply
  // bubble squeezed flat in a press.
  "compactor": {
    label: { zh: "一个回复气泡被压缩机压扁", en: "A reply bubble squeezed flat in a press" },
    tile: 3,
    sparks: [[90, 12, 1.1], [8, 50, 0.7]],
    shapes: [
      L(38, 4, 62, 4),
      L(50, 4, 50, 14),
      R(14, 14, 72, 10, hatch),
      R(14, 78, 72, 10, hatch),
      D("M22 44 Q22 36 30 36 H70 Q78 36 78 44 V56 Q78 64 70 64 H40 L30 72 L32 64 H30 Q22 64 22 56 Z", paper),
      E(40, 50, 4, 4, { ...ink, small: true }),
      E(50, 50, 4, 4, { ...ink, small: true }),
      E(60, 50, 4, 4, { ...ink, small: true }),
      D("M50 26 v7 M46.5 30 l3.5 3.5 3.5 -3.5", red),
      D("M50 76 v-7 M46.5 72 l3.5 -3.5 3.5 3.5", red),
    ],
  },
  // Temporal keeps an event history for every workflow: finished steps stay done, the failed one
  // is retried, and the whole run can be replayed.
  "event-history": {
    label: { zh: "一条事件历史：前三步已完成，失败的那一步单独重试，整段可以重放", en: "An event history: three steps done, the failed step retried on its own, the whole run replayable" },
    tile: 2,
    sparks: [[90, 88, 1.1], [8, 88, 0.7]],
    shapes: [
      D("M86 36 Q50 12 14 36", red),
      D("M14 36 l2 -9 M14 36 l9 -1", red),
      T(50, 15, "replay", 11, red),
      R(6, 42, 88, 22, paper),
      L(20.7, 42, 20.7, 64, thin),
      L(35.3, 42, 35.3, 64, thin),
      L(50, 42, 50, 64, thin),
      L(64.7, 42, 64.7, 64, thin),
      L(79.3, 42, 79.3, 64, thin),
      D("M9 53 l3 3 5 -6", {}),
      D("M24 53 l3 3 5 -6", {}),
      D("M38 53 l3 3 5 -6", {}),
      R(50, 42, 14.7, 22, { ...hatch, ...red }),
      D("M57.4 70 v-4 M55 68 l2.4 -2.4 2.4 2.4", { ...thin, ...red }),
      T(57.4, 82, "retry", 11, red),
    ],
  },
  // The 2026 map has three layers: local single machine, a serving engine, and disaggregated
  // prefill / decode on top.
  "three-tiers": {
    label: { zh: "三层台子：L1 本地、L2 服务，最上一层拆成 P（预填充）和 D（解码）两半", en: "Three tiers: L1 local, L2 serving, the top one split into P (prefill) and D (decode)" },
    tile: 2,
    sparks: [[92, 92, 1.0], [8, 92, 0.7]],
    shapes: [
      P([[50, 68], [86, 76], [50, 84], [14, 76]], paper),
      P([[14, 76], [50, 84], [50, 90], [14, 82]], paper),
      P([[50, 84], [86, 76], [86, 82], [50, 90]], hatch),
      T(50, 79.5, "L1", 10),
      P([[50, 46], [86, 54], [50, 62], [14, 54]], paper),
      P([[14, 54], [50, 62], [50, 68], [14, 60]], paper),
      P([[50, 62], [86, 54], [86, 60], [50, 68]], hatch),
      T(50, 57.5, "L2", 10),
      P([[35, 24], [71, 32], [71, 37], [35, 29]], { ...paper, ...red }),
      P([[35, 24], [53, 20], [89, 28], [71, 32]], { ...paper, ...red }),
      P([[71, 32], [89, 28], [89, 33], [71, 37]], { ...hatch, ...red }),
      P([[11, 32], [29, 28], [65, 36], [47, 40]], { ...paper, ...red }),
      P([[11, 32], [47, 40], [47, 45], [11, 37]], { ...paper, ...red }),
      P([[47, 40], [65, 36], [65, 41], [47, 45]], { ...hatch, ...red }),
      T(16, 24, "P", 14, red),
      T(84, 20, "D", 14, red),
    ],
  },
  // One build goes out on two lines: DNS sends mainland readers to Aliyun's CDN and everyone else to
  // Cloudflare.
  "dual-line": {
    label: { zh: "一份产物经 DNS 分线路，分到两朵云", en: "One build split by DNS onto two clouds" },
    tile: 2,
    sparks: [[10, 14, 1.1], [10, 92, 0.7]],
    shapes: [
      D("M6 46 h12 l4 4 h14 v24 h-30 Z", paper),
      T(21, 68, "dist", 10),
      L(36, 60, 46, 60),
      D("M52 60 Q60 60 62 42 H70", {}),
      D("M52 60 Q60 60 62 78 H70", {}),
      P([[46, 54], [52, 60], [46, 66], [40, 60]], ink),
      D("M70 44 a7 7 0 0 1 4 -13 a9 9 0 0 1 17 3 a6 6 0 0 1 1 11 Z", { ...hatch, ...red }),
      T(82, 57, "CN", 11, red),
      D("M70 82 a7 7 0 0 1 4 -13 a9 9 0 0 1 17 3 a6 6 0 0 1 1 11 Z", paper),
      T(82, 96, "CF", 11),
    ],
  },
  // A Hugo shortcode puts a live CSS demo inside the article itself: the article is the demo.
  "embedded-demo": {
    label: { zh: "一页文章里嵌着一个会动的 demo 窗口", en: "An article page with a live demo window inside" },
    tile: 2,
    sparks: [[90, 14, 1.1], [92, 80, 0.7]],
    shapes: [
      R(14, 8, 66, 84, paper),
      T(47, 22, "{{< demo >}}", 10.5, red),
      L(22, 30, 70, 30, thin),
      R(22, 37, 50, 32, paper),
      L(22, 44, 72, 44, thin),
      D("M28 62 Q36 46 48 56", thin),
      E(58, 57, 13, 13, { ...hatch, ...red }),
      L(22, 77, 70, 77, thin),
      L(22, 84, 56, 84, thin),
    ],
  },
  // Argus, named after the hundred-eyed giant: the agent looks over a long video and decides for
  // itself which frames to pull out, all inside the browser.
  "argus-eye": {
    label: { zh: "一只眼睛盯着一条胶片，只看挑中的两帧", en: "An eye watching a film strip, looking only at the two frames it picked" },
    tile: 2,
    sparks: [[90, 10, 1.1], [8, 92, 0.7]],
    shapes: [
      R(6, 56, 88, 28, paper),
      R(13, 58, 4, 3, { ...ink, small: true }),
      R(31, 58, 4, 3, { ...ink, small: true }),
      R(49, 58, 4, 3, { ...ink, small: true }),
      R(67, 58, 4, 3, { ...ink, small: true }),
      R(85, 58, 4, 3, { ...ink, small: true }),
      R(13, 79, 4, 3, { ...ink, small: true }),
      R(31, 79, 4, 3, { ...ink, small: true }),
      R(49, 79, 4, 3, { ...ink, small: true }),
      R(67, 79, 4, 3, { ...ink, small: true }),
      R(85, 79, 4, 3, { ...ink, small: true }),
      R(10, 63, 17, 14, thin),
      R(30, 63, 17, 14, { ...paper, ...red }),
      R(50, 63, 17, 14, thin),
      R(70, 63, 17, 14, { ...hatch, ...red }),
      L(44, 40, 38, 62, { ...thin, ...red }),
      L(56, 40, 78, 62, { ...thin, ...red }),
      D("M16 28 Q50 4 84 28 Q50 52 16 28 Z", paper),
      E(50, 28, 22, 22, hatch),
      E(50, 28, 8, 8, { ...ink, small: true }),
      L(30, 16, 26, 10, thin),
      L(50, 10, 50, 4, thin),
      L(70, 16, 74, 10, thin),
    ],
  },
  // Vane scores every item from many sources against your profile, sends only what is worth
  // reading, and your feedback tunes the profile.
  "vane-scores": {
    label: { zh: "几张资讯卡片打了分，9 分那张推给人，反馈再绕回来", en: "Scored news cards: the 9 goes to the reader, and the feedback loops back" },
    tile: 3,
    sparks: [[10, 14, 1.1], [94, 94, 0.7]],
    shapes: [
      R(4, 46, 28, 38, paper),
      T(15, 72, "3", 18),
      R(22, 32, 30, 40, paper),
      T(34, 60, "5", 18),
      R(56, 12, 32, 44, { ...paper, ...red }),
      T(72, 44, "9", 24, red),
      D("M88 50 Q98 70 82 84", red),
      D("M82 84 l3 -8 M82 84 l8 -1", red),
      E(70, 82, 10, 10, paper),
      D("M60 98 Q70 86 80 98", {}),
      D("M58 86 Q42 88 40 74", thin),
      D("M40 74 l-3 6 M40 74 l5 4", thin),
    ],
  },
} satisfies Record<string, Glyph>;

export type GlyphName = keyof typeof GLYPHS;
export const GLYPH_NAMES = Object.keys(GLYPHS) as [GlyphName, ...GlyphName[]];
