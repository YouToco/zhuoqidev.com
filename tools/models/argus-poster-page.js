// Runs in Chrome for ./argus-poster.mjs: builds the Argus scene from the page's own model
// (src/scripts/argus-story-model.ts), frames it, finds where each label pin lands on the poster and
// path-traces one pass of the poster with three-gpu-pathtracer.
import {
  MathUtils,
  PerspectiveCamera,
  RectAreaLight,
  Color,
  NoToneMapping,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GradientEquirectTexture, WebGLPathTracer } from "three-gpu-pathtracer";
import { buildArgusStory, VIEW_DIR } from "../../src/scripts/argus-story-model.ts";

const WIDTH = 1800;
const HEIGHT = 1150;
const ASPECT = WIDTH / HEIGHT;
/** A 50 mm lens on a 36 mm wide sensor, as the scene was first framed in Blender. */
const FOV_X = 2 * Math.atan(18 / 50);
const FOV_Y = 2 * Math.atan(Math.tan(FOV_X / 2) / ASPECT);
/** Share of the frame left empty around the scene on its tightest side. */
const MARGIN = 0.035;
/** Blender axes (z up), which the light positions below are in, to three's (y up). */
const toGl = ([x, y, z]) => new Vector3(x, z, -y);
/** Where the lights point, and where framing starts looking from. */
const AIM = toGl([0.15, 0.55, 0.95]);
/** Overall brightness, matched against the Cycles render this poster replaced. */
const EXPOSURE = 1.09;

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

/**
 * Moves the camera along VIEW_DIR, re-aiming it at the middle of the scene each round, until the
 * bounding box of every mesh just fits the frame with MARGIN to spare.
 */
function frame(model) {
  const camera = new PerspectiveCamera(MathUtils.radToDeg(FOV_Y), ASPECT, 0.5, 200);
  const corners = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const { min, max } = o.geometry.boundingBox;
    for (let k = 0; k < 8; k++) {
      corners.push(new Vector3(k & 1 ? max.x : min.x, k & 2 ? max.y : min.y, k & 4 ? max.z : min.z).applyMatrix4(o.matrixWorld));
    }
  });
  const v = new Vector3();
  // the scene's extent in the frame, 0..1 from the bottom left
  const place = (target, distance) => {
    camera.position.copy(target).addScaledVector(VIEW_DIR, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const box = [Infinity, -Infinity, Infinity, -Infinity];
    for (const p of corners) {
      v.copy(p).project(camera);
      const x = (v.x + 1) / 2;
      const y = (v.y + 1) / 2;
      box[0] = Math.min(box[0], x);
      box[1] = Math.max(box[1], x);
      box[2] = Math.min(box[2], y);
      box[3] = Math.max(box[3], y);
    }
    return box;
  };
  const target = AIM.clone();
  let distance = 18;
  for (let i = 0; i < 6; i++) {
    let [x0, x1, y0, y1] = place(target, distance);
    const w = 2 * distance * Math.tan(FOV_X / 2);
    const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    target.addScaledVector(right, ((x0 + x1) / 2 - 0.5) * w).addScaledVector(up, (((y0 + y1) / 2 - 0.5) * w) / ASPECT);
    [x0, x1, y0, y1] = place(target, distance);
    distance *= Math.max(x1 - x0, y1 - y0) / (1 - 2 * MARGIN);
  }
  place(target, distance);
  return { camera, target, distance };
}

window.renderPoster = async ({ samples, seed }) => {
  const model = buildArgusStory();
  model.updateMatrixWorld(true);
  const { camera, target, distance } = frame(model);

  const pins = {};
  const v = new Vector3();
  model.traverse((o) => {
    if (!o.name.startsWith("pin_")) return;
    o.getWorldPosition(v).project(camera);
    pins[o.name.slice(4)] = [round((v.x + 1) / 2, 4), round((1 - v.y) / 2, 4)];
  });

  // The poster shows the tray already swapped: the skim batch is gone.
  model.traverse((o) => {
    if (/^s3_tray_old\d+$/.test(o.name)) o.visible = false;
  });

  const renderer = new WebGLRenderer({ alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT);
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);
  let lost = false;
  renderer.domElement.addEventListener("webglcontextlost", () => (lost = true));
  const gl = renderer.getContext();
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";

  // A soft studio: three square area lights and a dim warm world, no tone mapping. An area light of
  // P watts over a square of side s shines with radiance P / (pi s^2).
  const scene = new Scene();
  scene.background = null;
  const world = new GradientEquirectTexture(32);
  world.topColor.set("#fbf8f1");
  world.bottomColor.set("#fbf8f1");
  world.update();
  scene.environment = world;
  scene.environmentIntensity = 0.35 * EXPOSURE;
  const area = (at, watts, size, rgb) => {
    const light = new RectAreaLight(new Color().setRGB(...rgb), (watts / (Math.PI * size * size)) * EXPOSURE, size, size);
    light.position.copy(toGl(at));
    light.lookAt(AIM);
    scene.add(light);
  };
  area([-3, -4, 16], 900, 10, [1, 0.96, 0.9]); // key, warm, from above
  area([12, -6, 6], 220, 8, [0.9, 0.94, 1]); // fill, cool, from the right
  area([2, 11, 9], 320, 7, [1, 1, 1]); // rim, from behind
  scene.add(model);
  scene.updateMatrixWorld(true);

  const tracer = new WebGLPathTracer(renderer);
  tracer.renderDelay = 0;
  tracer.fadeDuration = 0;
  tracer.minSamples = 0;
  tracer.dynamicLowRes = false;
  tracer.bounces = 6;
  tracer.tiles.set(4, 4);
  const t0 = performance.now();
  tracer.setScene(scene, camera);
  // each pass starts its random sequence somewhere else, so averaging passes lowers the noise
  tracer._pathTracer.material.seed = seed;
  // One tile at a time, waiting for each: queued GPU work that runs for seconds trips the GPU
  // process's watchdog, which resets the context and leaves a blank canvas.
  for (let k = 0; tracer.samples < samples; k++) {
    if (lost || gl.isContextLost()) throw new Error(`WebGL context lost after ${tracer.samples} samples`);
    tracer.renderSample();
    gl.finish();
    if (k % 16 === 15) await new Promise((r) => setTimeout(r));
  }
  return {
    png: renderer.domElement.toDataURL("image/png"),
    gpu,
    ms: Math.round(performance.now() - t0),
    camera: {
      dir: VIEW_DIR.toArray().map((x) => round(x, 4)),
      target: target.toArray().map((x) => round(x, 4)),
      distance: round(distance, 3),
      fovY: round(MathUtils.radToDeg(FOV_Y), 3),
      aspect: round(ASPECT, 4),
    },
    pins: Object.fromEntries(Object.entries(pins).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
};
