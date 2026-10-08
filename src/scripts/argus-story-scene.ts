// The 3D version of the Argus scene, loaded by ./argus-story.ts after the reader's first input.
// The model is built here from code (./argus-story-model.ts); there is no model file to download.
// Each step is a group (step0_video … step5_browser) whose pieces pop in when the reader reaches
// that step; focus_step0 … focus_step4 mark where the camera looks (the last step looks where the
// poster's camera does); pin_* are the points the HTML labels hang from. The scene opens exactly as the poster was rendered (every
// step shown, same camera), so the swap from picture to canvas is invisible, then settles on the
// current step. It only renders while something is moving.
//
// Three things move on their own: Argus's eyes follow what the current step is about and blink now
// and then; the frames and the tool call on the wire (s1_pkt*) ride it to the model and back when
// the step changes; and when the tray arrives, its oldest batch (s3_tray_old*) gives way to a slip
// of text (s3_tray_slip) as the newest batch (s3_tray_b2_*) lands, as in the run the scene follows.
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
import { buildArgusStory } from "./argus-story-model";

/** The camera the poster was rendered with (y up); `dir` points from target to camera. */
export type StoryCamera = { dir: number[]; target: number[]; distance: number; fovY: number; aspect: number };
/** Pin positions as fractions of the canvas (0..1 from the top left), or null when off screen. */
export type PinCoords = Record<string, [number, number] | null>;
export interface StoryScene {
  setStep(step: number): void;
}

/** Camera distance for each step as a share of the poster's; the last step is the poster framing. */
const ZOOM = [0.55, 0.8, 0.38, 0.6, 0.62, 1];
const UP = new Vector3(0, 1, 0);
/** What the main Argus looks at in each step (pin names; the last step looks at the reader). */
const GAZE = ["s0_question", "s1_scan", "s2_in", "s3_sub", "s4_answer", null];
const LAP = 1.7; // seconds for a packet to ride the whole wire
const BLINK = 0.16;

type Piece = { g: Group; step: number; delay: number; s: number; v: number; to: number; wait: number };
type Eye = { e: Group; p: Group; n: Vector3; len: number };
type Argus = { eyes: Eye[]; gaze: Vector3; target: () => Vector3 };
type Packet = { w: Group; at: number; dir: 1 | -1 };

export async function mount(opts: {
  fig: HTMLElement;
  camera: StoryCamera;
  reduced: boolean;
  onFrame: (pins: PinCoords) => void;
}): Promise<StoryScene> {
  const { fig, camera: cam, reduced, onFrame } = opts;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  // Throws without WebGL; the caller keeps the poster.
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });

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

  const model = buildArgusStory();
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
      // The rows over the edges of the red span come in pass by pass (every 1 s, 0.5 s, 0.1 s), then
      // the dots down to the strip; everything else comes nearest to the step's focus first.
      const name = members[0]!.name;
      const row = /^s2_row(\d)/.exec(name);
      const rank = row ? +row[1]! + 1 : name.startsWith("s2_thread") ? 4 : 0;
      return { g, rank, d: rank * 100 + pivot.distanceTo(focus[step]!) };
    });
    made.sort((a, b) => a.d - b.d);
    made.forEach(({ g, rank }, i) =>
      pieces.push({ g, step, delay: Math.min(i * 0.05, 0.6) + rank * 0.28, s: 1, v: 0, to: 1, wait: 0 }),
    );
  });

  const camera = new PerspectiveCamera(cam.fovY, cam.aspect, 0.5, 200);
  const dir = new Vector3(...cam.dir).normalize();
  const look = new Vector3(...cam.target);
  let dist = cam.distance;
  let step = last;
  let ready = false;
  let wanted = last;

  const goalDist = (k: number) => cam.distance * ZOOM[k]! * Math.max(1, cam.aspect / camera.aspect) ** (k === last ? 1 : 0.75);

  // Moving parts get a wrapper group at their own centre, so they can turn, squash and slide
  // about that centre whatever transform the piece itself carries.
  const byName = (re: RegExp) => {
    const out: Object3D[] = [];
    model.traverse((o) => {
      if (re.test(o.name)) out.push(o);
    });
    return out;
  };
  const centre = (objs: Object3D[]) => {
    const box = new Box3();
    for (const o of objs) box.expandByObject(o);
    return box.getCenter(new Vector3());
  };
  const wrap = (objs: Object3D[]) => {
    const parent = objs[0]!.parent!;
    const w = new Group();
    w.position.copy(parent.worldToLocal(centre(objs)));
    parent.add(w);
    w.updateMatrixWorld(true);
    for (const o of objs) w.attach(o);
    return w;
  };
  const pinAt = (name: string) => pins.get(name)!.getWorldPosition(new Vector3());

  const rig = (prefix: string, target: () => Vector3): Argus => {
    const eyes: Eye[] = byName(new RegExp(`^${prefix}_eye\\d+$`)).map((eye) => {
      const pupil = byName(new RegExp(`^${prefix}_pupil${eye.name.slice(prefix.length + 4)}$`))[0]!;
      const e = wrap([eye, pupil]);
      const p = wrap([pupil]);
      return { e, p, n: p.position.clone().normalize(), len: p.position.length() };
    });
    return { eyes, gaze: target().clone(), target };
  };
  const eyeCam = new Vector3();
  const subLook = centre(byName(/^s3_card1$/)); // the sub-agent watches the frames it pulled
  const argi = [
    rig("s1_argus", () => (GAZE[step] ? pinAt(GAZE[step]!) : eyeCam.copy(camera.position))),
    rig("s3_sub", () => subLook),
  ];
  // The poster has every eye looking straight out; the gaze blends in once the scene is live.
  let gazeMix = 0;
  let squint = 1;

  const wire = model.userData.wire as Vector3[];
  const seg = wire.slice(1).map((p, i) => p.distanceTo(wire[i]!));
  const wireLen = seg.reduce((a, b) => a + b, 0);
  const onWire = (u: number, out: Vector3) => {
    let left = u * wireLen;
    for (let i = 0; i < seg.length; i++) {
      if (left <= seg[i]! || i === seg.length - 1) return out.lerpVectors(wire[i]!, wire[i + 1]!, Math.min(1, left / seg[i]!));
      left -= seg[i]!;
    }
    return out;
  };
  const v0 = new Vector3();
  const nearest = (p: Vector3) => {
    let best = 0;
    let bestD = Infinity;
    for (let k = 0; k <= 200; k++) {
      const d = onWire(k / 200, v0).distanceToSquared(p);
      if (d < bestD) [best, bestD] = [k / 200, d];
    }
    return best;
  };
  const packets: Packet[] = ["A", "B", "C"].map((k) => {
    const w = wrap(byName(new RegExp(`^s1_pkt${k}$`)));
    return { w, at: nearest(w.getWorldPosition(new Vector3())), dir: k === "C" ? -1 : 1 };
  });
  // laps the packets have ridden; they rest wherever a whole number of laps leaves them
  let lap = 0;
  let lapTo = 0;
  let lapV = 0;

  const old = wrap(byName(/^s3_tray_old\d+$/));
  const slip = wrap(byName(/^s3_tray_slip$/));
  const newest = wrap(byName(/^s3_tray_b2_\d+$/));
  let swap = 1; // 0: the skim batch still in the tray, 1: swapped for the slip (the poster's state)
  let swapAt = -1;
  let clock = 0;
  let blinkAt = -1;

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
    if (ready) {
      const k = reduced ? 1 : 1 - Math.exp(-dt * 6);
      gazeMix += (0.55 - gazeMix) * k;
      if (0.55 - gazeMix > 1e-3) busy = true;
      for (const a of argi) {
        const to = a.target();
        a.gaze.lerp(to, k);
        if (a.gaze.distanceToSquared(to) > 1e-4) busy = true;
      }
    }
    if (blinkAt >= 0 && clock >= blinkAt) {
      const t = (clock - blinkAt) / BLINK;
      squint = t >= 1 ? 1 : 1 - 0.92 * Math.sin(Math.PI * t);
      if (t >= 1) blinkAt = -1;
      else busy = true;
    }
    if (lap < lapTo) {
      // Ride at full speed, easing into the last lap so every packet stops where it rests.
      const goal = Math.min(1 / LAP, Math.max(0.06, (lapTo - lap) * 1.6));
      lapV += (goal - lapV) * Math.min(1, dt * 5);
      lap = Math.min(lapTo, lap + lapV * dt);
      if (lap === lapTo) lapV = 0;
      else busy = true;
    }
    if (swapAt >= 0) {
      busy = true;
      if (clock >= swapAt) swap = Math.min(1, swap + dt / 0.5);
      if (swap === 1) swapAt = -1;
    }
    return busy;
  };

  const v = new Vector3();
  const smooth = (x: number) => x * x * (3 - 2 * x);
  const pose = () => {
    for (const a of argi) {
      for (const { e, p, n, len } of a.eyes) {
        // the pupil slides over the eye towards the target, as far as gazeMix lets it
        e.parent!.worldToLocal(v.copy(a.gaze)).sub(e.position).normalize();
        p.position.copy(n).lerp(v, gazeMix).normalize().multiplyScalar(len);
        e.scale.y = squint;
      }
    }
    for (const k of packets) {
      const u = (((k.at + k.dir * lap) % 1) + 1) % 1;
      const s = Math.min(1, u / 0.08, (1 - u) / 0.08); // out of Argus's head, into the cloud
      k.w.position.copy(k.w.parent!.worldToLocal(onWire(u, v)));
      k.w.scale.setScalar(Math.max(s, 0.001));
    }
    const sw = smooth(swap);
    old.scale.setScalar(Math.max(1 - sw, 0.001));
    old.visible = sw < 1;
    for (const w of [slip, newest]) {
      w.scale.setScalar(Math.max(sw, 0.001));
      w.visible = sw > 0;
    }
  };
  const draw = () => {
    camera.position.copy(look).addScaledVector(v.copy(dir).applyAxisAngle(UP, yaw), dist);
    camera.lookAt(look);
    pose();
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
    clock += dt;
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
    if (!reduced && k >= 1 && k !== from) {
      // the next round trip: frames up the wire, the next tool call down
      lapTo = Math.ceil(lap) + (from < 1 ? 2 : 1);
    }
    if (!reduced && k >= 3 && from < 3) {
      // the tray lands with the skim batch still in it; then the fourth batch comes in and the skim
      // batch becomes a slip of text
      swap = 0;
      swapAt = clock + 1.2 + Math.max(0, 3 - from - 1) * 0.3;
    }
    kick();
  };

  let seen = false;
  new IntersectionObserver(([e]) => (seen = e!.isIntersecting)).observe(fig);
  const blinkLater = () =>
    setTimeout(
      () => {
        if (seen && !document.hidden) {
          blinkAt = clock;
          kick();
        }
        blinkLater();
      },
      2600 + Math.random() * 3400,
    );

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
      if (!reduced) blinkLater();
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
