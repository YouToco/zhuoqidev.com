// The 3D version of the Argus scene, loaded by ./argus-story.ts after the reader's first input.
// The model is tools/models/argus-story.py exported to glTF, meshopt-compressed and gzipped
// (tools/models/README.md). Each step is a group (step0_video … step5_browser) whose pieces pop in
// when the reader reaches that step; focus_step0 … focus_step5 mark where the camera looks; pin_*
// are the points the HTML labels hang from. The scene opens exactly as the poster was rendered (every
// step shown, same camera), so the swap from picture to canvas is invisible, then settles on the
// current step. It only renders while something is moving.
import {
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  type Mesh,
  NeutralToneMapping,
  type Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** The camera the poster was rendered with, in glTF axes (y up); `dir` points from target to camera. */
export type StoryCamera = { dir: number[]; target: number[]; distance: number; fovY: number; aspect: number };
/** Pin positions as fractions of the canvas (0..1 from the top left), or null when off screen. */
export type PinCoords = Record<string, [number, number] | null>;
export interface StoryScene {
  setStep(step: number): void;
}

/** Camera distance for each step as a share of the poster's; the last step is the poster framing. */
const ZOOM = [0.55, 0.62, 0.42, 0.62, 0.62, 1];
const UP = new Vector3(0, 1, 0);

type Piece = { g: Group; step: number; delay: number; s: number; v: number; to: number; wait: number };

export async function mount(opts: {
  fig: HTMLElement;
  url: string;
  camera: StoryCamera;
  reduced: boolean;
  onFrame: (pins: PinCoords) => void;
}): Promise<StoryScene> {
  const { fig, camera: cam, reduced, onFrame } = opts;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  // Throws without WebGL; the caller keeps the poster.
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  const data = await fetchModel(opts.url);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.25;
  pmrem.dispose();
  scene.add(new HemisphereLight(0xffffff, 0x8a8478, 0.3));
  const key = new DirectionalLight(0xffffff, 1.5);
  key.position.set(-6, 14, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 });
  key.shadow.radius = 10;
  key.shadow.intensity = 0.55;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);

  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(data, "");
  const model = gltf.scene;
  model.traverse((o) => {
    if ((o as Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });
  scene.add(model);
  model.updateMatrixWorld(true);

  const groups: Object3D[] = [];
  const focus: Vector3[] = [];
  const pins = new Map<string, Object3D>();
  model.traverse((o) => {
    const step = /^step(\d)_/.exec(o.name);
    const look = /^focus_step(\d)$/.exec(o.name);
    if (step) groups[+step[1]!] = o;
    if (look) focus[+look[1]!] = o.getWorldPosition(new Vector3());
    if (o.name.startsWith("pin_")) pins.set(o.name.slice(4), o);
  });
  const last = groups.length - 1;
  focus[last] = new Vector3(...cam.target);

  // Pieces that belong together (an Argus and its eyes, a card and its thread) share a name prefix
  // and pop in as one, growing from the ground; a lone thread or cable grows from where it starts.
  // Within a step the piece nearest the step's focus comes first.
  const pieces: Piece[] = [];
  groups.forEach((group, step) => {
    const sets = new Map<string, Object3D[]>();
    for (const child of [...group.children]) {
      if (child.name.startsWith("pin_")) continue;
      const k = child.name.split("_").slice(0, 2).join("_");
      sets.set(k, [...(sets.get(k) ?? []), child]);
    }
    const made = [...sets.values()].map((members) => {
      const box = new Box3();
      for (const m of members) box.expandByObject(m);
      const only = members.length === 1 ? members[0]! : null;
      const pivot =
        only && /thread|cable/.test(only.name)
          ? only.getWorldPosition(new Vector3())
          : new Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
      const g = new Group();
      g.position.copy(group.worldToLocal(pivot.clone()));
      group.add(g);
      g.updateMatrixWorld(true);
      for (const m of members) g.attach(m);
      return { g, d: pivot.distanceTo(focus[step]!) };
    });
    made.sort((a, b) => a.d - b.d);
    made.forEach(({ g }, i) => pieces.push({ g, step, delay: Math.min(i * 0.05, 0.6), s: 1, v: 0, to: 1, wait: 0 }));
  });

  const camera = new PerspectiveCamera(cam.fovY, cam.aspect, 0.5, 200);
  const dir = new Vector3(...cam.dir).normalize();
  const look = new Vector3(...cam.target);
  let dist = cam.distance;
  let step = last;
  let ready = false;
  let wanted = last;

  const goalDist = (k: number) => cam.distance * ZOOM[k]! * Math.max(1, cam.aspect / camera.aspect) ** (k === last ? 1 : 0.75);

  let yaw = 0;
  let drag: { x: number; yaw: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, yaw };
    canvas.setPointerCapture(e.pointerId);
    kick();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    yaw = Math.max(-1.1, Math.min(1.1, drag.yaw - (e.clientX - drag.x) * 0.008));
    kick();
  });
  const release = () => {
    drag = null;
    kick();
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  const advance = (dt: number) => {
    let busy = drag !== null;
    const t = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    look.lerp(focus[step]!, t);
    dist += (goalDist(step) - dist) * t;
    if (look.distanceToSquared(focus[step]!) > 1e-5 || Math.abs(goalDist(step) - dist) > 1e-3) busy = true;
    if (!drag) {
      yaw *= reduced ? 0 : Math.exp(-dt * 4);
      if (Math.abs(yaw) > 1e-4) busy = true;
      else yaw = 0;
    }
    for (const p of pieces) {
      if (p.s === p.to && p.v === 0) continue;
      busy = true;
      if (reduced) {
        p.s = p.to;
        p.v = 0;
      } else if (p.wait > 0) {
        p.wait -= dt;
        continue;
      } else {
        // A spring: a small overshoot on the way in, none on the way out.
        const damping = p.to ? 15 : 28;
        p.v += (170 * (p.to - p.s) - damping * p.v) * dt;
        p.s += p.v * dt;
        if (Math.abs(p.to - p.s) < 0.002 && Math.abs(p.v) < 0.02) {
          p.s = p.to;
          p.v = 0;
        }
      }
      p.g.visible = p.s > 0.002;
      p.g.scale.setScalar(Math.max(p.s, 0.002));
    }
    return busy;
  };

  const v = new Vector3();
  const draw = () => {
    camera.position.copy(look).addScaledVector(v.copy(dir).applyAxisAngle(UP, yaw), dist);
    camera.lookAt(look);
    renderer.render(scene, camera);
    const out: PinCoords = {};
    for (const [name, o] of pins) {
      o.getWorldPosition(v).project(camera);
      out[name] = v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 ? [(v.x + 1) / 2, (1 - v.y) / 2] : null;
    }
    onFrame(out);
  };

  let raf = 0;
  let then = 0;
  const tick = (now: number) => {
    raf = 0;
    // Small fixed steps, so the springs keep real time on a slow GPU too.
    let dt = Math.min((now - then) / 1000, 0.25);
    then = now;
    let busy = false;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 120);
      busy = advance(h);
      dt -= h;
    }
    draw();
    if (busy) raf = requestAnimationFrame(tick);
  };
  function kick() {
    if (raf || !ready) return;
    then = performance.now();
    raf = requestAnimationFrame(tick);
  }

  const apply = (k: number) => {
    const from = step;
    step = k;
    for (const p of pieces) {
      const to = p.step <= k ? 1 : 0;
      if (to === p.to) continue;
      p.to = to;
      // Jumping several steps at once still builds them in order.
      p.wait = to ? p.delay + Math.max(0, p.step - from - 1) * 0.3 : 0;
    }
    kick();
  };

  const resize = () => {
    const w = fig.clientWidth;
    const h = fig.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (ready) kick();
    else draw();
  };
  new ResizeObserver(resize).observe(fig);
  canvas.addEventListener("webglcontextlost", () => fig.classList.remove("gl"));

  // Under the labels, over the poster.
  fig.querySelector("picture")!.after(canvas);
  resize();
  await renderer.compileAsync(scene, camera);
  draw();
  fig.classList.add("gl");
  // Let the crossfade finish on the poster's framing before moving to the reader's step.
  setTimeout(
    () => {
      ready = true;
      apply(wanted);
    },
    reduced ? 0 : 650,
  );

  return {
    setStep(k) {
      wanted = k;
      if (ready && k !== step) apply(k);
    },
  };
}

async function fetchModel(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`model: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  // Shipped gzipped because neither host compresses .glb. If something on the way already
  // decoded it, these are the plain glTF bytes and need nothing more.
  const head = new Uint8Array(buf, 0, 2);
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buf;
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
}
