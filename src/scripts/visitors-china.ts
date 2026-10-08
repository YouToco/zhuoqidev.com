// The map of China on the visitor map, loaded by ./visitors.ts after the reader's first input. Every
// province, plus Hong Kong, Macao and Taiwan (src/data/geo/china.json, DataV.GeoAtlas), stands as a
// block as tall as its readers. The South China Sea Islands and the nine-dash line sit in the inset
// at the lower right, as on the standard map. Hovering (or tapping) a block shows its numbers; the
// five busiest carry labels. Drag to turn it. It only renders while it is on screen.
import {
  BufferGeometry,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import china from "../data/geo/china.json";
import type { Tip } from "./visitors";

export type ProvinceRow = { adcode: number; name: string; visitors: number; views: number };
export interface ChinaScene {
  update(rows: ProvinceRow[]): void;
}

type Ring = number[]; // lon, lat, lon, lat, …
type Poly = Ring[]; // outer ring, then holes

const D = Math.PI / 180;
const S = 0.06; // scene units per degree
const COS = Math.cos(35 * D);
const LABELS = 5;
const BASE = 0.03;
const TALL = 0.55;
// The inset: this box of the South China Sea, at half scale, east of Taiwan.
const INSET = { west: 105, east: 124, south: 2.5, north: 24.5, atLon: 124.5, atLat: 26, k: 0.6 };

function project(lon: number, lat: number, inset = false): [number, number] {
  if (inset) {
    lon = INSET.atLon + (lon - INSET.west) * INSET.k;
    lat = INSET.atLat + (lat - INSET.north) * INSET.k;
  }
  return [(lon - 104) * COS * S, (lat - 36) * S];
}

const ringLat = (r: Ring) => {
  let s = 0;
  for (let i = 1; i < r.length; i += 2) s += r[i]!;
  return s / (r.length / 2);
};

function shapeOf(poly: Poly, inset: boolean): Shape {
  const pts = (r: Ring) => {
    const out: Vector2[] = [];
    for (let i = 0; i < r.length; i += 2) out.push(new Vector2(...project(r[i]!, r[i + 1]!, inset)));
    return out;
  };
  const shape = new Shape(pts(poly[0]!));
  for (const hole of poly.slice(1)) shape.holes.push(new Shape(pts(hole)));
  return shape;
}

/** Outlines of the polygons at height y, as line segment pairs (x, y, z), z pointing south. */
function outline(polys: Poly[], y: number, inset: boolean) {
  const out: number[] = [];
  for (const poly of polys) {
    for (const r of poly) {
      for (let i = 0; i + 3 < r.length; i += 2) {
        const [x1, n1] = project(r[i]!, r[i + 1]!, inset);
        const [x2, n2] = project(r[i + 2]!, r[i + 3]!, inset);
        out.push(x1, y, -n1, x2, y, -n2);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(out, 3));
  return g;
}

const css = (name: string) => new Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888");

export async function mountChina(opts: {
  stage: HTMLElement;
  reduced: boolean;
  southSea: string;
  /** Province names in the page's language, by adcode. */
  names: Map<number, string>;
  onTip: (t: Tip | null, x?: number, y?: number) => void;
}): Promise<ChinaScene> {
  const { stage, reduced, southSea, names, onTip } = opts;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 50);
  const target = new Vector3(0.14, 0, 0.12);
  scene.add(new HemisphereLight(0xffffff, 0x9a958a, 1.7));
  const sun = new DirectionalLight(0xffffff, 1.3);
  sun.position.set(-2, 5, 3);
  scene.add(sun);
  const map = new Group();
  scene.add(map);

  // One block per province: a unit-tall extrusion, stretched to its height. Caps and sides take
  // separate materials so the sides can be a shade darker.
  type Block = { adcode: number; name: string; mesh: Mesh; cap: MeshLambertMaterial; side: MeshLambertMaterial; h: number; to: number; v: number; row: ProvinceRow | undefined; top: Vector3 };
  const blocks: Block[] = [];
  const edgeMat = new LineBasicMaterial({ transparent: true, opacity: 0.85 });
  const insetPolys: Poly[] = [];
  for (const p of china.provinces as { adcode: number; name: string; center: number[]; polys: Poly[] }[]) {
    const main = p.polys.filter((poly) => !(p.adcode === 460000 && ringLat(poly[0]!) < 17.5));
    insetPolys.push(...p.polys.filter((poly) => !main.includes(poly)));
    const geo = new ExtrudeGeometry(
      main.map((poly) => shapeOf(poly, false)),
      { depth: 1, bevelEnabled: false, curveSegments: 1 },
    ).rotateX(-Math.PI / 2);
    const cap = new MeshLambertMaterial();
    const side = new MeshLambertMaterial();
    const mesh = new Mesh(geo, [cap, side]);
    mesh.scale.y = BASE;
    mesh.add(new LineSegments(outline(main, 1.001, false), edgeMat));
    map.add(mesh);
    const [cx, cn] = project(p.center[0]!, p.center[1]!);
    blocks.push({ adcode: p.adcode, name: names.get(p.adcode) ?? p.name, mesh, cap, side, h: BASE, to: BASE, v: 0, row: undefined, top: new Vector3(cx, 0, -cn) });
  }

  // The inset: its frame, the islands and the nine-dash line, lying flat.
  const flat = new MeshBasicMaterial();
  const dashMat = new MeshBasicMaterial();
  const island = new Mesh(new ShapeGeometry(insetPolys.map((poly) => shapeOf(poly, true))).rotateX(-Math.PI / 2), flat);
  const dash = new Mesh(new ShapeGeometry((china.dash as Poly[]).map((poly) => shapeOf(poly, true))).rotateX(-Math.PI / 2), dashMat);
  island.position.y = dash.position.y = 0.004;
  const [fx1, fn1] = project(INSET.west, INSET.north, true);
  const [fx2, fn2] = project(INSET.east, INSET.south, true);
  const frameGeo = new BufferGeometry();
  frameGeo.setAttribute(
    "position",
    new Float32BufferAttribute([fx1, 0, -fn1, fx2, 0, -fn1, fx2, 0, -fn1, fx2, 0, -fn2, fx2, 0, -fn2, fx1, 0, -fn2, fx1, 0, -fn2, fx1, 0, -fn1], 3),
  );
  const frameMat = new LineBasicMaterial();
  const dashLine = new LineSegments(outline(china.dash as Poly[], 0.006, true), frameMat);
  map.add(island, dash, dashLine, new LineSegments(frameGeo, frameMat));
  const insetCorner = new Vector3(fx1, 0, -fn2); // the label goes under the frame's lower left corner

  // HTML labels on the busiest blocks, and one under the inset.
  const labelEls = Array.from({ length: LABELS }, () => {
    const e = document.createElement("span");
    e.className = "vis-label";
    e.hidden = true;
    stage.append(e);
    return e;
  });
  const insetLabel = document.createElement("span");
  insetLabel.className = "vis-label inset";
  insetLabel.textContent = southSea;
  stage.append(insetLabel);
  let insetW = 0;
  let labelled: Block[] = [];
  let sizes: [number, number][] = [];

  let low = new Color();
  let high = new Color();
  let zero = new Color();
  let hovered: Block | null = null;
  const paint = () => {
    const max = Math.max(1, ...blocks.map((b) => b.v));
    for (const b of blocks) {
      const c = b.v ? low.clone().lerp(high, 0.25 + 0.75 * Math.sqrt(b.v / max)) : zero;
      b.cap.color.copy(c);
      b.side.color.copy(c).multiplyScalar(0.78);
      b.cap.emissive.set(b === hovered ? 0x333333 : 0x000000);
    }
  };
  const theme = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    low = css("--blue-soft");
    zero = css(dark ? "--line" : "--paper-2");
    high = css("--blue");
    edgeMat.color = css(dark ? "--paper" : "--card");
    flat.color = zero;
    dashMat.color = css("--ink-2");
    frameMat.color = css("--ink-3");
    paint();
    wake();
  };

  function update(rows: ProvinceRow[]) {
    const by = new Map(rows.map((r) => [r.adcode, r]));
    const max = Math.max(1, ...rows.map((r) => r.visitors));
    for (const b of blocks) {
      const r = by.get(b.adcode);
      b.row = r;
      b.v = r?.visitors ?? 0;
      b.to = BASE + (b.v ? TALL * Math.sqrt(b.v / max) : 0);
    }
    labelled = [...blocks].filter((b) => b.v > 0).sort((a, b) => b.v - a.v).slice(0, LABELS);
    labelled.forEach((b, i) => {
      labelEls[i]!.textContent = `${b.name} ${b.v}`;
    });
    labelEls.forEach((e, i) => (e.hidden = i >= labelled.length));
    sizes = labelEls.map((e) => [e.offsetWidth, e.offsetHeight] as [number, number]);
    insetW = insetLabel.offsetWidth;
    paint();
    wake();
  }

  // Dragging turns the map about its centre and, with a mouse, tilts the view.
  let yaw = 0;
  let pitch = 47 * D; // from straight above
  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;
  let idleSince = performance.now();
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    wake();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) {
      if (e.pointerType === "mouse") hover(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    lastX = e.clientX;
    lastY = e.clientY;
    yaw = Math.min(0.7, Math.max(-0.7, yaw + dx * 0.005));
    if (e.pointerType === "mouse") pitch = Math.min(75 * D, Math.max(22 * D, pitch - dy * 0.004));
    onTip(null);
    wake();
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    idleSince = performance.now();
    if (moved < 6) hover(e.clientX, e.clientY);
  });
  canvas.addEventListener("pointercancel", () => {
    dragging = false;
  });
  canvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse" && !dragging) setHover(null);
  });

  const ray = new Raycaster();
  const ndc = new Vector2();
  function setHover(b: Block | null, x = 0, y = 0) {
    if (b !== hovered) {
      hovered = b;
      paint();
      wake();
    }
    onTip(b && { title: b.name, visitors: b.v, views: b.row?.views ?? 0 }, x, y);
  }
  function hover(x: number, y: number) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(blocks.map((b) => b.mesh), false)[0];
    setHover(blocks.find((b) => b.mesh === hit?.object) ?? null, x - r.left, y - r.top);
  }

  let w = 1;
  let h = 1;
  let fit = 6;
  stage.prepend(canvas);
  new ResizeObserver(([entry]) => {
    ({ width: w, height: h } = entry!.contentRect);
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    // Distance that fits the map's 3.4-unit width (and 2.6-unit depth) in view.
    const t = Math.tan((camera.fov / 2) * D);
    fit = Math.max(1.8 / (t * camera.aspect), 1.45 / t);
    camera.updateProjectionMatrix();
    wake();
  }).observe(stage);

  const v = new Vector3();
  const at = new Vector3();
  const screen = (p: Vector3): [number, number] => {
    v.copy(p).applyMatrix4(map.matrixWorld).project(camera);
    return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
  };
  // Busiest first; a label that would cover one already placed moves up a row, or twice, and is
  // left out if it still does not fit.
  const placeLabels = () => {
    const boxes: [number, number, number, number][] = [];
    labelled.forEach((b, i) => {
      const el = labelEls[i]!;
      const [bw, bh] = sizes[i] ?? [0, 0];
      const [x, y] = screen(at.copy(b.top).setY(b.h + 0.02));
      let spot: [number, number, number, number] | null = null;
      for (let up = 0; up < 3 && !spot; up++) {
        const box: [number, number, number, number] = [x - bw / 2, y - bh - up * (bh + 2), x + bw / 2, y - up * (bh + 2)];
        if (!boxes.some((o) => box[0] < o[2] + 2 && o[0] < box[2] + 2 && box[1] < o[3] + 1 && o[1] < box[3] + 1)) spot = box;
      }
      el.classList.toggle("off", !spot);
      if (!spot) return;
      boxes.push(spot);
      el.style.left = `${x}px`;
      el.style.top = `${spot[3]}px`;
    });
    const [ix, iy] = screen(insetCorner);
    insetLabel.style.left = `${Math.max(4, Math.min(ix, w - insetW - 6))}px`;
    insetLabel.style.top = `${iy}px`;
  };

  let visible = false;
  let running = false;
  function frame(now: number) {
    let busy = dragging;
    for (const b of blocks) {
      const step = reduced ? b.to - b.h : (b.to - b.h) * 0.1;
      b.h = Math.abs(step) < 1e-4 ? b.to : b.h + step;
      if (b.h !== b.to) busy = true;
      b.mesh.scale.y = b.h;
    }
    // A slow sway when nobody is dragging, so the blocks read as 3D.
    const sway = reduced || dragging || now - idleSince < 2500 ? 0 : Math.sin(now / 4200) * 0.12;
    if (sway) busy = true;
    map.rotation.y = yaw + sway;
    camera.position.set(target.x, target.y + fit * Math.cos(pitch), target.z + fit * Math.sin(pitch));
    camera.lookAt(target);
    map.updateMatrixWorld();
    placeLabels();
    renderer.render(scene, camera);
    if (!busy || !visible) stop();
  }
  function wake() {
    if (running || !visible) return;
    running = true;
    renderer.setAnimationLoop(frame);
  }
  function stop() {
    running = false;
    renderer.setAnimationLoop(null);
  }
  new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting;
    if (visible) wake();
  }).observe(stage);
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  theme();

  return { update };
}
