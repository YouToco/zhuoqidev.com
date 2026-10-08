// The clay scene on the Argus project page, built from primitives in code (about 8 KB gzipped, no
// model file to download). One real search through Argus's sample video in six step groups
// (step0_video … step5_browser); focus_step* empties mark where the web camera looks in each step
// and pin_* empties are where the HTML labels hang. ./argus-story-scene.ts animates it by those
// names; tools/models/argus-poster.mjs path-traces the same scene for the poster.
//
// The scene was first modelled in Blender, so everything is laid out in Blender's axes (z up, x to
// the right, y away from the viewer) and turned to three's y-up at the end; shading, bevels and
// curves follow what Blender did, so the look stayed the same when the model moved here.
import {
  BoxGeometry,
  type BufferGeometry,
  CircleGeometry,
  CubicBezierCurve3,
  CurvePath,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { Font, type FontData } from "three/addons/loaders/FontLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import glyphs from "../assets/models/argus-story-glyphs.json";

type V3 = [number, number, number];
const PI = Math.PI;
const rad = (d: number) => (d * PI) / 180;

const STEPS = ["step0_video", "step1_scan", "step2_refine", "step3_helpers", "step4_answer", "step5_browser"];
const SW = 10.6;
const SD = 6.6;
const STH = 0.3;
const STRIP_Y = -1.3;
const FRAME_PITCH = 0.72;
const T0_X = -3.91;
const tx = (t: number) => T0_X + (t / 15) * FRAME_PITCH;

// The poster's view direction (from the scene towards the camera); cards and bubbles face it.
const CAM_DIR = new Vector3(0.42, -1.3, 1.15).normalize();
const YAW = Math.atan2(CAM_DIR.y, CAM_DIR.x) + PI / 2;
const TILT = rad(-24);
const faceCam = (extra = 0): V3 => [TILT + extra, 0, YAW];

const HEX: Record<string, string | undefined> = {
  stage: "#efe8d8",
  ink: "#1c2230",
  screen: "#263048",
  seal: "#d24a30",
  blue: "#4f74d9",
  blue_dark: "#3a5bb8",
  yellow: "#f6d453",
  note: "#ffe27a",
  green: "#4f9a6c",
  cream: "#fbf6ea",
  white: "#ffffff",
  grey: "#a3a8b4",
  glass: "#dfeaff",
  cloud: "#dfe6f3",
  lavender: "#b9aee6",
};

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const materials = new Map<string, MeshStandardMaterial>();
const material = (key: string) => {
  let m = materials.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ name: `clay_${key}`, color: HEX[key]!, roughness: 0.72, metalness: 0 });
    materials.set(key, m);
  }
  return m;
};
// Many pieces repeat (eyes, dots, frame parts): one geometry per distinct shape.
const geometries = new Map<string, BufferGeometry>();
const shared = (key: string, make: () => BufferGeometry) => {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g;
};

// Every mesh is shaded smooth (only prisms and text flat). On a plain box or disc that bends
// the light across its sharp edges, which gives the thin screens their glow and the red discs their
// dome; welding the corners and averaging the normals does the same here.
const smooth = (g: BufferGeometry) => {
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const welded = mergeVertices(g);
  welded.computeVertexNormals();
  return welded;
};

const v = (p: V3 | Vector3) => (p instanceof Vector3 ? p.clone() : new Vector3(...p));

// Blender's XYZ Euler applies X, then Y, then Z: three's "ZYX" order.
function place<T extends Object3D>(o: T, name: string, loc: V3 | Vector3, rot: V3, parent: Object3D): T {
  o.name = name;
  o.position.copy(v(loc));
  o.rotation.set(rot[0], rot[1], rot[2], "ZYX");
  parent.add(o);
  return o;
}
const mesh = (name: string, geo: BufferGeometry, loc: V3 | Vector3, rot: V3, mat: string, parent: Object3D) =>
  place(new Mesh(geo, material(mat)), name, loc, rot, parent);

function box(name: string, size: V3, loc: V3 | Vector3, mat: string, parent: Object3D, bevel = 0.05, seg = 4, rot: V3 = [0, 0, 0]) {
  const [sx, sy, sz] = size;
  const b = Math.min(bevel, 0.45 * Math.min(...size));
  // RoundedBoxGeometry also subdivides the flat middle of every face, so it needs about three times
  // the triangles of Blender's bevel for the same segments; small rounds get by with two.
  const s = b < 0.04 ? 2 : seg;
  const geo = shared(`box ${size} ${b > 0.002 ? b : 0} ${s}`, () =>
    b > 0.002 ? new RoundedBoxGeometry(sx, sy, sz, s, b) : smooth(new BoxGeometry(sx, sy, sz)),
  );
  return mesh(name, geo, loc, rot, mat, parent);
}

function cyl(name: string, r: number, h: number, loc: V3 | Vector3, mat: string, parent: Object3D, seg = 32, rot: V3 = [0, 0, 0], bevel = 0) {
  const geo = shared(`cyl ${r} ${h} ${seg} ${bevel}`, () => {
    if (bevel <= 0) return smooth(new CylinderGeometry(r, r, h, seg).rotateX(PI / 2));
    // the profile of a disc with rounded rims, spun about its axis
    const pts = [new Vector2(0, -h / 2)];
    const arc = (cx: number, cy: number, from: number) => {
      for (let k = 0; k <= 4; k++) {
        const a = from + (k / 4) * (PI / 2);
        pts.push(new Vector2(cx + bevel * Math.cos(a), cy + bevel * Math.sin(a)));
      }
    };
    arc(r - bevel, -h / 2 + bevel, -PI / 2);
    arc(r - bevel, h / 2 - bevel, 0);
    pts.push(new Vector2(0, h / 2));
    return new LatheGeometry(pts, seg).rotateX(PI / 2);
  });
  return mesh(name, geo, loc, rot, mat, parent);
}

function sphere(name: string, r: number, loc: V3 | Vector3, mat: string, parent: Object3D, u = 24, vs = 14, scale: V3 = [1, 1, 1], cutBelow?: number) {
  const geo = shared(`sphere ${r} ${u} ${vs} ${scale} ${cutBelow}`, () => {
    let g: BufferGeometry;
    if (cutBelow === undefined) {
      g = new SphereGeometry(r, u, vs);
    } else {
      // Blender drops the vertices below the cut, so the cut lands on the last ring above it.
      const rings = Math.floor(Math.acos(cutBelow) / (PI / vs));
      const theta = (rings * PI) / vs;
      const cap = new CircleGeometry(r * Math.sin(theta), u).rotateX(PI / 2).translate(0, r * Math.cos(theta), 0);
      g = mergeGeometries([new SphereGeometry(r, u, rings, 0, 2 * PI, 0, theta), cap])!;
    }
    return g.rotateX(PI / 2).scale(...scale);
  });
  return mesh(name, geo, loc, [0, 0, 0], mat, parent);
}

function torus(name: string, R: number, r: number, loc: V3, mat: string, parent: Object3D, maj = 48, mnr = 12, arc = 2 * PI, rot: V3 = [0, 0, 0]) {
  const geo = shared(`torus ${R} ${r} ${maj} ${mnr} ${arc}`, () => new TorusGeometry(R, r, mnr, maj, arc));
  return mesh(name, geo, loc, rot, mat, parent);
}

function prism(name: string, pts: [number, number][], h: number, loc: V3 | Vector3, mat: string, parent: Object3D, rot: V3 = [0, 0, 0]) {
  const geo = shared(`prism ${pts} ${h}`, () =>
    new ExtrudeGeometry(new Shape(pts.map(([x, y]) => new Vector2(x, y))), { depth: h, bevelEnabled: false }),
  );
  return mesh(name, geo, loc, rot, mat, parent);
}

// A Bezier curve through the points with Catmull-Rom handles; the cable's sampled path is kept for the
// page, which runs the frames and the tool call along it.
const PATHS: Record<string, Vector3[]> = {};
function tube(name: string, points: Vector3[], r: number, mat: string, parent: Object3D, res = 16, record = false) {
  const n = points.length;
  const tan = points.map((_, i) => points[Math.min(i + 1, n - 1)]!.clone().sub(points[Math.max(i - 1, 0)]!).divideScalar(6));
  const path = new CurvePath<Vector3>();
  const samples = [points[0]!.clone()];
  for (let i = 0; i < n - 1; i++) {
    const c = new CubicBezierCurve3(points[i]!, points[i]!.clone().add(tan[i]!), points[i + 1]!.clone().sub(tan[i + 1]!), points[i + 1]!);
    path.add(c);
    for (let k = 1; k <= res; k++) samples.push(c.getPoint(k / res));
  }
  if (record) PATHS[name] = samples;
  const start = points[0]!;
  const end = points[n - 1]!;
  const ends = [start, end].map((p) => new SphereGeometry(r, 12, 6).translate(p.x, p.y, p.z));
  const geo = mergeGeometries([new TubeGeometry(path, res * (n - 1), r, 12, false), ...ends])!.translate(-start.x, -start.y, -start.z);
  // origin at the start, so the page can grow it from there
  return mesh(name, geo, start, [0, 0, 0], mat, parent);
}

const font = new Font(glyphs as unknown as FontData);
function text(name: string, body: string, size: number, loc: V3, mat: string, parent: Object3D, rot: V3 = [0, 0, 0], depth = 0.03) {
  const geo = shared(`text ${body} ${size} ${depth}`, () => {
    // Blender extrudes a text curve by depth to both sides; centred like its align CENTER
    const g = new TextGeometry(body, { font, size, depth: 2 * depth, curveSegments: 3, bevelEnabled: false });
    g.computeBoundingBox();
    const b = g.boundingBox!;
    return g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -depth);
  });
  return mesh(name, geo, loc, rot, mat, parent);
}

function dots(name: string, a: V3 | Vector3, c: V3 | Vector3, n: number, mat: string, parent: Object3D, r = 0.028) {
  for (let k = 0; k < n; k++) sphere(`${name}${k}`, r, v(a).lerp(v(c), (k + 0.5) / n), mat, parent, 10, 6);
}

const empty = (name: string, loc: V3 | Vector3, parent: Object3D) => place(new Object3D(), name, loc, [0, 0, 0], parent);

// ---------------------------------------------------------------------------
// Characters and props
// ---------------------------------------------------------------------------

/** Argus the hundred-eyed: a gumdrop covered in eyes on the side facing the camera. */
function argus(name: string, loc: V3, parent: Object3D, scale = 1, eyes = 13, color = "blue") {
  const [x, y, z] = loc;
  const r = 0.6 * scale;
  sphere(`${name}_body`, r, [x, y, z + r * 1.2], color, parent, 32, 18, [1, 1, 1.25], -0.82);
  const face = Math.atan2(CAM_DIR.y, CAM_DIR.x);
  const rows: [number, number][] = eyes >= 13 ? [[-0.05, 5], [0.32, 4], [0.62, 3], [0.9, 1]] : [[0.15, 2], [0.55, 1]];
  let k = 0;
  for (const [el, count] of rows) {
    const span = count > 1 ? (rad(110) * (count - 1)) / 4 : 0;
    for (let i = 0; i < count; i++) {
      const az = face - span / 2 + (count > 1 ? (span * i) / (count - 1) : 0);
      const n = new Vector3(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el));
      const pos = new Vector3(x, y, z + r * 1.2).add(new Vector3(n.x * r, n.y * r, n.z * r * 1.25).multiplyScalar(0.96));
      const er = r * (el < 0.7 ? 0.16 : 0.13);
      sphere(`${name}_eye${k}`, er, pos, "white", parent, 14, 8);
      sphere(`${name}_pupil${k}`, er * 0.55, pos.clone().addScaledVector(n, er * 0.62), "ink", parent, 12, 8);
      k++;
    }
  }
  for (const s of [-1, 1]) {
    const fx = x + s * r * 0.45 * Math.cos(face + PI / 2);
    const fy = y + s * r * 0.45 * Math.sin(face + PI / 2);
    sphere(`${name}_foot${s > 0 ? "b" : "a"}`, r * 0.28, [fx, fy, z + 0.03], "blue_dark", parent, 16, 8, [1.3, 1.3, 0.55]);
  }
}

/** A standing frame: white border, dark screen, and the sample video's shape at that time. */
function frameCard(name: string, w: number, h: number, kind: string, loc: V3 | Vector3, parent: Object3D, rot?: V3, thick = 0.04) {
  const card = box(name, [w, thick, h], loc, "white", parent, 0.018, 4, rot ?? faceCam());
  box(`${name}_scr`, [w - 0.08, 0.01, h - 0.08], [0, -thick / 2 - 0.004, 0], "screen", card, 0);
  const fy = -thick / 2 - 0.012;
  const s = Math.min(w, h);
  if (kind === "red") cyl(`${name}_red`, 0.2 * s, 0.012, [0.08 * w, fy, 0], "seal", card, 24, [PI / 2, 0, 0]);
  else if (kind === "blue") box(`${name}_blue`, [0.3 * s, 0.012, 0.3 * s], [0.2 * w, fy, 0], "blue", card, 0);
  else if (kind === "green")
    prism(`${name}_green`, [[-0.16 * s, -0.13 * s], [0.16 * s, -0.13 * s], [0, 0.17 * s]], 0.012, [0, fy + 0.006, 0], "green", card, [PI / 2, 0, 0]);
  else if (kind === "hello") box(`${name}_hello`, [0.5 * w, 0.012, 0.1 * h], [0, fy, 0], "white", card, 0);
  // the small white timecode bar in the corner (every frame of the sample video has one)
  box(`${name}_tc`, [0.22 * w, 0.012, 0.07 * h], [-0.3 * w, fy, 0.33 * h], "grey", card, 0);
  return card;
}

const FRAME_KINDS: Record<number, string> = { 1: "red", 4: "hello", 7: "blue", 10: "green", 11: "green" };

// ---------------------------------------------------------------------------
// The six steps
// ---------------------------------------------------------------------------

function step0Video(g: Object3D) {
  box("s0_stage", [SW, SD, STH], [0, 0, -STH / 2], "stage", g, 0.12, 5);
  const [rx, ry] = [-4.62, STRIP_Y + 0.1];
  cyl("s0_reel", 0.62, 0.2, [rx, ry, 0.1], "ink", g, 40, [0, 0, 0], 0.03);
  cyl("s0_reel_hub", 0.15, 0.24, [rx, ry, 0.12], "grey", g, 24, [0, 0, 0], 0.02);
  for (let k = 0; k < 5; k++) {
    const a = (2 * PI * k) / 5 + 0.3;
    cyl(`s0_reel_hole${k}`, 0.11, 0.02, [rx + 0.38 * Math.cos(a), ry + 0.38 * Math.sin(a), 0.205], "cream", g, 18);
  }
  const length = 12 * FRAME_PITCH + 0.5;
  box("s0_strip", [length, 0.95, 0.05], [T0_X - 0.25 + length / 2, STRIP_Y, 0.025], "ink", g, 0.015);
  for (let i = 0; i < 12; i++) {
    const x = T0_X + FRAME_PITCH * (i + 0.5);
    box(`s0_f${i}`, [0.6, 0.6, 0.012], [x, STRIP_Y, 0.056], "screen", g, 0);
    for (const s of [-1, 1])
      for (const d of [-1, 1])
        box(`s0_f${i}_h${s > 0 ? "b" : "a"}${d > 0 ? "b" : "a"}`, [0.1, 0.07, 0.012], [x + d * 0.17, STRIP_Y + s * 0.4, 0.056], "cream", g, 0);
    const kind = FRAME_KINDS[i];
    const z = 0.068;
    if (kind === "red") cyl(`s0_f${i}_red`, 0.11, 0.016, [x + 0.06, STRIP_Y, z], "seal", g, 24);
    else if (kind === "hello") box(`s0_f${i}_hello`, [0.32, 0.07, 0.016], [x, STRIP_Y, z], "white", g, 0);
    else if (kind === "blue") box(`s0_f${i}_blue`, [0.17, 0.17, 0.016], [x + 0.12, STRIP_Y, z], "blue", g, 0);
    else if (kind === "green") prism(`s0_f${i}_green`, [[-0.1, -0.08], [0.1, -0.08], [0, 0.11]], 0.016, [x, STRIP_Y, 0.06], "green", g);
  }
  const [bx, by, bz] = [-4.75, -1.0, 1.55];
  const bub = box("s0_bubble", [1.25, 0.12, 0.78], [bx, by, bz], "white", g, 0.1, 5, faceCam());
  prism("s0_bubble_tail", [[-0.08, 0], [0.14, 0], [-0.14, -0.3]], 0.1, [-0.2, 0.05, -0.36], "white", bub, [PI / 2, 0, 0]);
  text("s0_bubble_q", "?", 0.62, [0, -0.07, -0.02], "seal", bub, [PI / 2, 0, 0], 0.03);
  for (const [t, key] of [[0, "t0"], [60, "t60"], [120, "t120"], [180, "t180"]] as const)
    empty(`pin_s0_${key}`, [tx(t), STRIP_Y - 0.62, 0.05], g);
  empty("pin_s0_question", [bx, by, bz + 0.5], g);
  empty("pin_s0_video", [rx, ry, 0.35], g);
}

const ARGUS_POS: V3 = [-3.05, 0.75, 0.0];
const CLOUD = new Vector3(2.6, SD / 2 + 1.6, 3.3);

/** The point a share u (0-1) of the way along a sampled path. */
function along(points: Vector3[], u: number) {
  const seg = points.slice(1).map((p, i) => p.distanceTo(points[i]!));
  let left = u * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i]!) return points[i]!.clone().lerp(points[i + 1]!, seg[i] ? left / seg[i]! : 0);
    left -= seg[i]!;
  }
  return points[points.length - 1]!.clone();
}

function packetFrame(name: string, loc: Vector3, parent: Object3D) {
  const card = box(name, [0.4, 0.04, 0.3], loc, "white", parent, 0.02, 4, faceCam());
  box(`${name}_scr`, [0.33, 0.01, 0.23], [0, -0.024, 0], "screen", card, 0);
  cyl(`${name}_red`, 0.05, 0.012, [0.03, -0.031, 0], "seal", card, 18, [PI / 2, 0, 0]);
}

function packetCall(name: string, loc: Vector3, parent: Object3D) {
  const tag = box(name, [0.48, 0.05, 0.24], loc, "yellow", parent, 0.05, 4, faceCam());
  [0.28, 0.17].forEach((w, j) => box(`${name}_l${j}`, [w, 0.01, 0.034], [-0.13 + w / 2, -0.028, 0.04 - j * 0.08], "ink", tag, 0));
}

function step1Scan(g: Object3D) {
  argus("s1_argus", ARGUS_POS, g);
  for (const i of [1, 4, 7, 10]) {
    const x = T0_X + FRAME_PITCH * (i + 0.5);
    const top = new Vector3(x, STRIP_Y + 0.25, 1.62);
    frameCard(`s1_card${i}`, 0.62, 0.5, FRAME_KINDS[i] ?? "empty", top, g);
    dots(`s1_thread${i}_`, [x, STRIP_Y, 0.12], top.clone().sub(new Vector3(0, 0, 0.3)), 6, "ink", g, 0.022);
  }
  const puffs: [number, number, number, number][] = [
    [0, 0, 0, 0.62], [-0.6, 0.05, -0.15, 0.46], [0.6, 0.02, -0.12, 0.5],
    [-0.2, 0.1, 0.42, 0.46], [0.3, -0.05, 0.36, 0.42], [0.0, -0.25, -0.22, 0.44],
  ];
  puffs.forEach(([dx, dy, dz, r], k) => sphere(`s1_cloud${k}`, r, CLOUD.clone().add(new Vector3(dx, dy, dz)), "cloud", g, 24, 14));
  const head = new Vector3(ARGUS_POS[0], ARGUS_POS[1], 1.62);
  tube("s1_cable", [head, head.clone().add(new Vector3(0.3, 0.6, 0.9)), new Vector3(0, SD / 2 + 0.2, 2.6), CLOUD.clone().sub(new Vector3(0.7, 0.2, 0.25))], 0.04, "ink", g, 16, true);
  const wire = PATHS.s1_cable!;
  packetFrame("s1_pktA", along(wire, 0.2), g);
  packetFrame("s1_pktB", along(wire, 0.66), g);
  packetCall("s1_pktC", along(wire, 0.84), g);
  empty("pin_s1_argus", [ARGUS_POS[0], ARGUS_POS[1], 1.75], g);
  empty("pin_s1_scan", [T0_X + FRAME_PITCH * 7.5, STRIP_Y + 0.25, 1.95], g);
  empty("pin_s1_model", CLOUD.clone().add(new Vector3(0, 0, 1)), g);
}

const EDGES: [number, string, number][] = [[10.0, "in", -0.07], [24.9, "out", 0.07]];
const ROWS: [number, number, number][] = [[0.25, 0.27, 1.12], [0.19, 0.205, 0.86], [0.145, 0.16, 0.63]];
const FUNNEL_Y = STRIP_Y - 0.66;

function step2Refine(g: Object3D) {
  for (const [t, side, nudge] of EDGES) {
    const x = tx(t) + nudge;
    ROWS.forEach(([w, dx, z], r) => {
      for (const k of [-1, 0, 1]) {
        const red = side === "in" ? k >= 0 : k <= 0;
        frameCard(`s2_row${r}${side}_c${k + 1}`, w, w * 0.78, red ? "red" : "empty", [x + k * dx, FUNNEL_Y, z], g, undefined, 0.025);
      }
    });
    dots(`s2_thread${side}_`, [tx(t), STRIP_Y - 0.3, 0.1], [x, FUNNEL_Y, ROWS[2]![2] - 0.1], 5, "ink", g, 0.018);
  }
  empty("pin_s2_in", [tx(EDGES[0]![0]) + EDGES[0]![2], FUNNEL_Y, 1.38], g);
  empty("pin_s2_out", [tx(EDGES[1]![0]) + EDGES[1]![2], FUNNEL_Y, 1.38], g);
}

const TRAY = new Vector3(-1.4, 1.6, 0.0);

function trayStack(name: string, loc: Vector3, n: number, parent: Object3D) {
  const angles = [-6, 5, -2, 7, -4];
  for (let k = 0; k < n; k++) {
    const tile = box(`${name}${k}`, [0.32, 0.24, 0.018], loc.clone().add(new Vector3(0.012 * (k % 2), 0, 0.022 * k)), "white", parent, 0.006, 4, [0, 0, rad(angles[k % 5]!)]);
    box(`${name}${k}_scr`, [0.27, 0.19, 0.004], [0, 0, 0.01], "screen", tile, 0);
  }
}

function step3Helpers(g: Object3D) {
  const [sx, sy] = [0.35, -2.5];
  argus("s3_sub", [sx, sy, 0], g, 0.62, 3, "lavender");
  [63, 109, 156].forEach((t, j) => {
    const x = tx(t);
    frameCard(`s3_card${j}`, 0.36, 0.3, FRAME_KINDS[Math.floor(t / 15)] ?? "empty", [x, STRIP_Y + 0.1, 1.0 + (j % 2) * 0.08], g, undefined, 0.03);
    dots(`s3_thread${j}_`, [x, STRIP_Y, 0.12], [x, STRIP_Y + 0.1, 0.8], 4, "lavender", g, 0.02);
  });
  const slip = box("s3_report", [0.46, 0.03, 0.3], [sx - 0.95, sy + 0.2, 0.85], "white", g, 0.025, 4, faceCam());
  [0.32, 0.22].forEach((w, j) => box(`s3_report_l${j}`, [w, 0.01, 0.035], [-0.12 + w / 2, -0.018, 0.055 - j * 0.09], "grey", slip, 0));
  const base = box("s3_tray", [1.7, 0.8, 0.06], [TRAY.x, TRAY.y, 0.03], "cream", g, 0.03);
  const rims: [number, number, number, number][] = [[1.7, 0.06, 0, 0.37], [1.7, 0.06, 0, -0.37], [0.06, 0.8, 0.82, 0], [0.06, 0.8, -0.82, 0]];
  rims.forEach(([w, d, x, y], k) => box(`s3_tray_rim${k}`, [w, d, 0.1], [x, y, 0.06], "cream", base, 0.02));
  const slots = [-0.58, -0.2, 0.2, 0.58].map((x) => TRAY.clone().add(new Vector3(x, 0, 0.075)));
  const note = box("s3_tray_slip", [0.3, 0.36, 0.012], slots[0]!, "white", g, 0.004, 4, [0, 0, rad(-8)]);
  [0.2, 0.15, 0.18].forEach((w, j) => box(`s3_tray_slip_l${j}`, [w, 0.03, 0.004], [-0.02, 0.1 - j * 0.085, 0.008], "grey", note, 0));
  trayStack("s3_tray_old", slots[0]!, 3, g);
  [5, 2, 3].forEach((n, k) => trayStack(`s3_tray_b${k}_`, slots[k + 1]!, n, g));
  empty("pin_s3_sub", [sx, sy, 1.3], g);
  empty("pin_s3_tray", [TRAY.x, TRAY.y, 0.45], g);
}

const ANSWER = new Vector3(-0.2, 1.75, 2.85);

function step4Answer(g: Object3D) {
  const card = box("s4_answer", [2.5, 0.08, 1.15], ANSWER, "white", g, 0.08, 5, faceCam());
  cyl("s4_answer_red", 0.17, 0.03, [-0.9, -0.05, 0.12], "seal", card, 28, [PI / 2, 0, 0]);
  const chips: [number, string][] = [[-0.22, "10.0s"], [0.78, "25.0s"]];
  chips.forEach(([x, body], k) => {
    box(`s4_chip${k}`, [0.8, 0.03, 0.3], [x, -0.05, 0.12], "yellow", card, 0.06);
    text(`s4_t${k}`, body, 0.2, [x, -0.075, 0.12], "ink", card, [PI / 2, 0, 0], 0.015);
  });
  text("s4_dash", "-", 0.2, [0.28, -0.075, 0.12], "ink", card, [PI / 2, 0, 0], 0.015);
  [1.9, 1.4].forEach((w, j) => box(`s4_line${j}`, [w, 0.02, 0.07], [-1.0 + w / 2, -0.05, -0.2 - j * 0.17], "grey", card, 0.02));
  card.updateWorldMatrix(true, false);
  [[10.0, chips[0]![0]], [24.9, chips[1]![0]]].forEach(([t, chipX], k) => {
    const head = new Vector3(tx(t!), STRIP_Y - 0.05, 0.42);
    cyl(`s4_pin${k}_needle`, 0.018, 0.34, head.clone().sub(new Vector3(0, 0, 0.2)), "grey", g, 10);
    sphere(`s4_pin${k}_head`, 0.11, head, "seal", g, 18, 12);
    const start = card.localToWorld(new Vector3(chipX, 0.04, -0.15));
    const mid = start.clone().lerp(head, 0.5).add(new Vector3(0, 0, -0.25));
    tube(`s4_thread${k}`, [start, mid, head], 0.016, "seal", g);
  });
  const note = box("s4_note", [0.66, 0.6, 0.02], [TRAY.x - 0.05, -0.12, 0.012], "note", g, 0.01, 4, [0, 0, rad(5)]);
  [0.44, 0.32, 0.38].forEach((w, j) => box(`s4_note_l${j}`, [w, 0.04, 0.008], [-0.08 + w / 2 - 0.12, 0.15 - j * 0.14, 0.014], "ink", note, 0));
  empty("pin_s4_answer", ANSWER.clone().add(new Vector3(0, 0, 0.72)), g);
  empty("pin_s4_pins", [tx(17.4), STRIP_Y - 0.05, 0.6], g);
  empty("pin_s4_note", [TRAY.x - 0.05, -0.12, 0.15], g);
}

function step5Browser(g: Object3D) {
  const by = SD / 2 - 0.42;
  box("s5_titlebar", [SW - 0.3, 0.55, 0.08], [0, by, 0.04], "ink", g, 0.03);
  (["seal", "yellow", "green"] as const).forEach((key, k) => sphere(`s5_dot${k}`, 0.085, [-4.8 + k * 0.28, by, 0.1], key, g, 16, 10));
  box("s5_address", [4.6, 0.3, 0.03], [0.3, by, 0.095], "cream", g, 0.015);
  const lx = -1.75;
  box("s5_lock", [0.16, 0.05, 0.13], [lx, by, 0.2], "green", g, 0.02);
  torus("s5_lock_shackle", 0.055, 0.016, [lx, by, 0.27], "green", g, 20, 6, PI, [PI / 2, 0, 0]);
  empty("pin_s5_browser", [SW / 2 - 0.9, by, 0.12], g);
  empty("pin_s5_cloud", CLOUD.clone().add(new Vector3(0, 0, 1)), g);
  empty("pin_s5_wire", along(PATHS.s1_cable!, 0.76).add(new Vector3(0, 0, 0.25)), g);
}

/** Blender axes (z up) -> three's (y up). */
const Y_UP = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -PI / 2);
/** The poster's view direction in three's axes, from the scene towards the camera. */
export const VIEW_DIR = CAM_DIR.clone().applyQuaternion(Y_UP);

/**
 * The whole scene, in three's axes. `userData.wire` is the cable's sampled path (s1_cable). The last
 * step has no focus empty: the page looks at the poster camera's target there.
 */
export function buildArgusStory(): Object3D {
  materials.clear();
  geometries.clear();
  const root = new Group();
  root.name = "ArgusStory";
  const fns = [step0Video, step1Scan, step2Refine, step3Helpers, step4Answer, step5Browser];
  const groups = STEPS.map((name, i) => {
    const g = new Group();
    g.name = name;
    root.add(g);
    fns[i]!(g);
    return g;
  });
  const focus: V3[] = [[tx(45) - 0.6, STRIP_Y + 0.3, 0.75], [-0.6, 1.2, 1.7], [tx(17.5), FUNNEL_Y + 0.25, 0.8], [-0.65, -0.3, 0.6], [-1.5, 0.35, 1.45]];
  const empties = focus.map((loc, i) => empty(`focus_step${i}`, loc, root));
  // z up -> y up, one level down from the step groups, so the groups themselves keep three's axes
  // (the page squashes eyes along their group's y to blink).
  for (const o of [...groups.flatMap((g) => g.children), ...empties]) {
    o.position.applyQuaternion(Y_UP);
    o.quaternion.premultiply(Y_UP);
  }
  root.userData.wire = PATHS.s1_cable!.map((p) => p.clone().applyQuaternion(Y_UP));
  root.updateMatrixWorld(true);
  return root;
}
