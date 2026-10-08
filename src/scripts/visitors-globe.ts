// The globe on the visitor map, loaded by ./visitors.ts after the reader's first input. Land is a
// field of dots (src/data/geo/land.json: land only, no borders); each country with readers gets a
// beam as tall as its share, rising from Natural Earth's label point (src/data/geo/countries.json),
// and an arc to Shenzhen with a pulse running along it. Drag to spin; it turns slowly on its own
// unless the reader prefers less motion. It only renders while it is on screen.
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Quaternion,
  QuadraticBezierCurve3,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import countries from "../data/geo/countries.json";
import land from "../data/geo/land.json";
import type { Tip } from "./visitors";

export type Country = { code: string; name: string; visitors: number; views: number };
export interface GlobeScene {
  update(rows: Country[]): void;
}

const D = Math.PI / 180;
const HOME = { lat: 22.54, lon: 113.95 }; // Shenzhen
const DOTS = 52000; // dots over the whole sphere; about 30% land on land
const MAX_BARS = 240;
const MAX_ARCS = 48;
const ARC_STEPS = 40;
const UP = new Vector3(0, 1, 0);
const POINTS = countries as unknown as Record<string, [number, number]>;

/** lat/lon in degrees to a point on a sphere of radius r; longitude 0 faces +z. */
function vec(lat: number, lon: number, r = 1) {
  const la = lat * D;
  const lo = lon * D;
  return new Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
}

function landDots(): Float32Array {
  const bits = Uint8Array.from(atob(land.bits), (c) => c.charCodeAt(0));
  const isLand = (lat: number, lon: number) => {
    const x = Math.min(land.w - 1, Math.floor((lon + 180) * 2));
    const y = Math.min(land.h - 1, Math.floor((90 - lat) * 2));
    const n = y * land.w + x;
    return (bits[n >> 3]! >> (n & 7)) & 1;
  };
  const out: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < DOTS; i++) {
    const y = 1 - (2 * (i + 0.5)) / DOTS;
    const r = Math.sqrt(1 - y * y);
    const x = Math.cos(golden * i) * r;
    const z = Math.sin(golden * i) * r;
    const lat = Math.asin(y) / D;
    const lon = Math.atan2(x, z) / D;
    if (isLand(lat, lon)) out.push(x * 1.002, y * 1.002, z * 1.002);
  }
  return new Float32Array(out);
}

const css = (name: string) => new Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888");

export async function mountGlobe(opts: {
  stage: HTMLElement;
  reduced: boolean;
  onTip: (t: Tip | null, x?: number, y?: number) => void;
}): Promise<GlobeScene> {
  const { stage, reduced, onTip } = opts;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  // Throws without WebGL; the caller keeps the lists.
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 5);
  const tilt = new Group(); // leans the north towards the reader
  const spin = new Group(); // turns about the poles
  tilt.rotation.x = 0.42;
  spin.rotation.y = -105 * D;
  tilt.add(spin);
  scene.add(tilt);

  const body = new MeshBasicMaterial();
  spin.add(new Mesh(new SphereGeometry(0.995, 72, 48), body));

  const halo = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uStrength: { value: 0.5 } },
    vertexShader: `varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying vec3 vN;
      void main() { float a = pow(clamp(0.62 + vN.z, 0.0, 1.0), 4.0); gl_FragColor = vec4(uColor, a * uStrength); }`,
    side: BackSide,
    transparent: true,
    depthWrite: false,
  });
  tilt.add(new Mesh(new SphereGeometry(1.09, 64, 32), halo));

  const dotGeo = new BufferGeometry();
  dotGeo.setAttribute("position", new BufferAttribute(landDots(), 3));
  const dots = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uSize: { value: 1.9 * dpr }, uAlpha: { value: 0.8 } },
    vertexShader: `uniform float uSize; varying float vFace;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFace = dot(normalize(normalMatrix * position), normalize(-mv.xyz));
        gl_PointSize = uSize;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying float vFace;
      void main() {
        if (length(gl_PointCoord - 0.5) > 0.5) discard;
        gl_FragColor = vec4(uColor, uAlpha * smoothstep(-0.05, 0.45, vFace));
      }`,
    transparent: true,
  });
  spin.add(new Points(dotGeo, dots));

  // Beams: a unit cylinder standing on its base, placed and stretched per country.
  const beamGeo = new CylinderGeometry(1, 1, 1, 10, 1, false).translate(0, 0.5, 0);
  const beamMat = new MeshBasicMaterial({ transparent: true, opacity: 0.92 });
  const beams = new InstancedMesh(beamGeo, beamMat, MAX_BARS);
  beams.count = 0;
  spin.add(beams);

  // Arcs: thin tubes from each country to Shenzhen, all in one geometry; t runs 0 → 1 along each.
  const arcMat = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uTime: { value: 0 }, uBase: { value: 0.22 } },
    vertexShader: `attribute float t; attribute float seed; varying float vT; varying float vSeed;
      void main() { vT = t; vSeed = seed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime; uniform float uBase; varying float vT; varying float vSeed;
      void main() {
        float head = fract(uTime * 0.22 + vSeed);
        float d = head - vT;
        float pulse = d >= 0.0 && d < 0.22 ? 1.0 - d / 0.22 : 0.0;
        gl_FragColor = vec4(uColor, uBase + pulse * 0.85);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const arcs = new Mesh(new BufferGeometry(), arcMat);
  spin.add(arcs);

  // Shenzhen: a dot and a ring that keeps spreading out from it.
  const homeN = vec(HOME.lat, HOME.lon);
  const homeQ = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), homeN);
  const homeMat = new MeshBasicMaterial({ transparent: true });
  const ringMat = new MeshBasicMaterial({ transparent: true, depthWrite: false });
  const homeDot = new Mesh(new RingGeometry(0, 0.016, 24), homeMat);
  const ring = new Mesh(new RingGeometry(0.02, 0.026, 40), ringMat);
  for (const m of [homeDot, ring]) {
    m.position.copy(homeN).multiplyScalar(1.004);
    m.quaternion.copy(homeQ);
    spin.add(m);
  }

  const theme = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    body.color = css("--paper-2");
    dots.uniforms.uColor!.value = css("--ink-3");
    dots.uniforms.uAlpha!.value = dark ? 0.75 : 0.65;
    halo.uniforms.uColor!.value = css("--blue");
    halo.uniforms.uStrength!.value = dark ? 0.45 : 0.22;
    beamMat.color = css("--seal");
    arcMat.uniforms.uColor!.value = css("--blue");
    arcMat.blending = dark ? AdditiveBlending : NormalBlending; // adding light shows nothing on paper
    arcMat.uniforms.uBase!.value = dark ? 0.2 : 0.28;
    arcMat.needsUpdate = true;
    homeMat.color = css("--seal");
    ringMat.color = css("--seal");
    wake();
  };

  // Beams grow towards their targets; `shown` holds what the hover test needs.
  type Beam = { row: Country; n: Vector3; q: Quaternion; h: number; to: number };
  let shown: Beam[] = [];
  const m4 = new Matrix4();
  const sc = new Vector3();
  const W = 0.011;
  const placeBeams = () => {
    let moving = false;
    shown.forEach((b, i) => {
      const step = reduced ? b.to - b.h : (b.to - b.h) * 0.12;
      b.h = Math.abs(step) < 1e-4 ? b.to : b.h + step;
      if (b.h !== b.to) moving = true;
      m4.compose(b.n, b.q, sc.set(W, Math.max(b.h, 1e-4), W));
      beams.setMatrixAt(i, m4);
    });
    beams.count = shown.length;
    beams.instanceMatrix.needsUpdate = true;
    return moving;
  };

  function update(rows: Country[]) {
    const placed = rows.filter((r) => r.visitors > 0 && POINTS[r.code]).slice(0, MAX_BARS);
    const max = Math.max(1, ...placed.map((r) => r.visitors));
    const old = new Map(shown.map((b) => [b.row.code, b.h]));
    shown = placed.map((row) => {
      const [lon, lat] = POINTS[row.code]!;
      const n = vec(lat, lon);
      return { row, n, q: new Quaternion().setFromUnitVectors(UP, n), h: old.get(row.code) ?? 0, to: 0.04 + 0.42 * Math.sqrt(row.visitors / max) };
    });
    // Arcs from the countries with the most readers, skipping ones too close to Shenzhen to show.
    // Each rises from the country, peaks over the middle of the great circle and comes down at home.
    const tubes: BufferGeometry[] = [];
    for (const b of shown) {
      if (tubes.length >= MAX_ARCS) break;
      const angle = b.n.angleTo(homeN);
      if (angle < 4 * D) continue;
      const mid = slerp(b.n, homeN, angle, 0.5).multiplyScalar(1 + 0.12 + 0.7 * (angle / Math.PI));
      const tube = new TubeGeometry(new QuadraticBezierCurve3(b.n, mid, homeN), ARC_STEPS, 0.0032, 5, false);
      const uv = tube.getAttribute("uv");
      const t = new Float32Array(uv.count);
      for (let i = 0; i < uv.count; i++) t[i] = uv.getX(i);
      tube.setAttribute("t", new BufferAttribute(t, 1));
      tube.setAttribute("seed", new BufferAttribute(new Float32Array(uv.count).fill((tubes.length * 0.618) % 1), 1));
      tube.deleteAttribute("normal");
      tube.deleteAttribute("uv");
      tubes.push(tube);
    }
    arcs.geometry.dispose();
    arcs.geometry = tubes.length ? mergeGeometries(tubes) : new BufferGeometry();
    for (const g of tubes) g.dispose();
    wake();
  }

  // Dragging spins the globe (and, with a mouse, tilts it a little); a flick keeps it turning.
  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;
  let vel = 0;
  let idleSince = performance.now();
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    vel = 0;
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
    vel = dx * 0.006;
    spin.rotation.y += vel;
    if (e.pointerType === "mouse") tilt.rotation.x = Math.min(1.1, Math.max(-0.5, tilt.rotation.x + dy * 0.004));
    onTip(null);
    wake();
  });
  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    idleSince = performance.now();
    if (moved < 6) hover(e.clientX, e.clientY);
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", () => {
    dragging = false;
  });
  canvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse" && !dragging) onTip(null);
  });

  // The beam whose top is nearest the pointer (within 16px), on the side facing the reader.
  let box = { left: 0, top: 0, w: 1, h: 1 };
  const top = new Vector3();
  const face = new Vector3();
  function hover(x: number, y: number) {
    const r = canvas.getBoundingClientRect();
    box = { left: r.left, top: r.top, w: r.width, h: r.height };
    let best: Beam | null = null;
    let bestD = 16 * 16;
    let at: [number, number] = [0, 0];
    for (const b of shown) {
      face.copy(b.n).applyQuaternion(spin.getWorldQuaternion(new Quaternion()));
      if (face.z < 0.1) continue;
      top.copy(b.n).multiplyScalar(1 + b.h);
      spin.localToWorld(top).project(camera);
      const sx = box.left + ((top.x + 1) / 2) * box.w;
      const sy = box.top + ((1 - top.y) / 2) * box.h;
      const d = (sx - x) ** 2 + (sy - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = b;
        at = [sx - box.left, sy - box.top];
      }
    }
    onTip(best && { title: best.row.name, visitors: best.row.visitors, views: best.row.views }, at[0], at[1]);
  }

  stage.prepend(canvas);
  new ResizeObserver(([entry]) => {
    const { width, height } = entry!.contentRect;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    // Keep the whole globe in view on tall, narrow screens.
    camera.position.z = camera.aspect < 1 ? 5 / camera.aspect ** 0.8 : 5;
    camera.updateProjectionMatrix();
    wake();
  }).observe(stage);

  // Render only while on screen and while something moves.
  let visible = false;
  let running = false;
  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let busy = placeBeams() || dragging;
    if (!dragging && Math.abs(vel) > 1e-4) {
      spin.rotation.y += vel;
      vel *= 0.94;
      busy = true;
    }
    if (!reduced) {
      if (!dragging && now - idleSince > 2500) spin.rotation.y += dt * 0.08;
      arcMat.uniforms.uTime!.value += dt;
      const p = (now / 1600) % 1;
      ring.scale.setScalar(1 + p * 2.4);
      ringMat.opacity = 1 - p;
      busy = true;
    }
    renderer.render(scene, camera);
    if (!busy || !visible) stop();
  }
  function wake() {
    if (running || !visible) return;
    running = true;
    last = performance.now();
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

function slerp(a: Vector3, b: Vector3, angle: number, t: number) {
  const s = Math.sin(angle);
  return a
    .clone()
    .multiplyScalar(Math.sin((1 - t) * angle) / s)
    .add(b.clone().multiplyScalar(Math.sin(t * angle) / s));
}
