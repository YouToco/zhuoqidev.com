// Scroll steps for the Argus scene (src/components/ArgusStory.astro). The poster and the numbered list
// already tell the whole story; this script lights up the current step, hangs that step's labels on
// the picture and, after the reader's first scroll, tap or key press, swaps the poster for the 3D
// scene (./argus-story-scene.ts). Waiting for that first input keeps three.js and the model out of
// the initial page load.
import type { PinCoords, StoryCamera, StoryScene } from "./argus-story-scene";

// Starts once the page has loaded, so none of this shares the page's first layout and paint; until
// then the page shows the picture-and-list version. Sizes arrive through a ResizeObserver rather
// than being read, so the script never forces a layout either.
const root = document.querySelector<HTMLElement>("[data-story]");
if (root) {
  const go = () => setTimeout(() => init(root));
  if (document.readyState === "complete") go();
  else addEventListener("load", go, { once: true });
}

function init(root: HTMLElement) {
  const fig = root.querySelector<HTMLElement>("[data-story-fig]")!;
  const steps = [...root.querySelectorAll<HTMLElement>(".story-step")];
  const pinned = [...fig.querySelectorAll<HTMLElement>("[data-pin]")];
  const labels = pinned.filter((el) => el.classList.contains("story-label"));
  const wide = window.matchMedia("(min-width: 1001px)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.classList.add("live");

  let active = -1;
  let scene: StoryScene | null = null;

  // Labels and time marks sit on pins: fixed spots on the poster, projected points once the 3D scene
  // runs. A label hangs above its point; with no room above it sits beside the point (right, else
  // left), and with no room there either, below it. Its box slides sideways to stay inside the
  // picture and to clear the step's other labels; the stem stays on the point. Label sizes are read
  // once, before any write, so moving the labels along with the 3D camera never forces a layout.
  let coords = JSON.parse(root.dataset.pins!) as PinCoords;
  let w = 0;
  let h = 0;
  const sizes = new Map<HTMLElement, [number, number]>();
  type Spot = { el: HTMLElement; x: number; y: number; bw: number; bh: number; dx: number; mode: string };
  const MODES = ["side", "side-l", "below"];
  const slides = (b: Spot) => b.mode === "" || b.mode === "below";
  const rect = (b: Spot) => {
    const l = b.mode === "side" ? b.x + 12 : b.mode === "side-l" ? b.x - 12 - b.bw : b.x + b.dx - b.bw / 2;
    const t = b.mode === "" ? b.y - 20 - b.bh : b.mode === "below" ? b.y + 20 : b.y - b.bh / 2;
    return { l, r: l + b.bw, t, b: t + b.bh };
  };
  const slide = (b: Spot, by: number) => {
    b.dx = Math.min(Math.max(b.dx + by, b.bw / 2 + 8 - b.x), w - b.bw / 2 - 8 - b.x);
  };
  const place = (next: PinCoords) => {
    coords = next;
    for (const el of w ? labels : []) {
      if (!el.classList.contains("on") || sizes.has(el)) continue;
      const box = el.firstElementChild as HTMLElement;
      sizes.set(el, [box.offsetWidth, box.offsetHeight]);
    }
    const spots: Spot[] = [];
    for (const el of pinned) {
      const p = coords[el.dataset.pin!];
      el.classList.toggle("out", !p);
      if (!p) continue;
      el.style.left = `${p[0] * 100}%`;
      el.style.top = `${p[1] * 100}%`;
      const size = el.classList.contains("on") && sizes.get(el);
      if (!size) continue;
      const [bw, bh] = size;
      const x = p[0] * w;
      const y = p[1] * h;
      const mode = y >= bh + 30 ? "" : x + 12 + bw + 8 <= w ? "side" : x - 12 - bw >= 8 ? "side-l" : "below";
      const spot = { el, x, y, bw, bh, dx: 0, mode };
      if (slides(spot)) slide(spot, 0);
      spots.push(spot);
    }
    // Two of the step's labels whose boxes overlap (a narrow screen, a long English label): the ones
    // that can slide move apart sideways.
    spots.forEach((p, i) => {
      for (const q of spots.slice(i + 1)) {
        const first = rect(p).l <= rect(q).l;
        const a = first ? p : q;
        const b = first ? q : p;
        const ra = rect(a);
        const rb = rect(b);
        const lap = ra.r + 6 - rb.l;
        if (lap <= 0 || ra.t >= rb.b || rb.t >= ra.b || (!slides(a) && !slides(b))) continue;
        const was = a.dx;
        if (slides(a)) slide(a, slides(b) ? -lap / 2 : -lap);
        if (slides(b)) slide(b, lap - (was - a.dx));
      }
    });
    for (const b of spots) {
      b.el.style.setProperty("--dx", `${b.dx}px`);
      for (const m of MODES) b.el.classList.toggle(m, b.mode === m);
    }
  };

  // The current step is the last one whose card has crossed the reading line: mid-screen on wide
  // screens, a little below the pinned picture on narrow ones.
  const update = () => {
    const figBottom = fig.getBoundingClientRect().bottom;
    const line = wide.matches ? window.innerHeight * 0.55 : figBottom + (window.innerHeight - figBottom) * 0.4;
    let next = 0;
    steps.forEach((s, i) => {
      if (s.firstElementChild!.getBoundingClientRect().top < line) next = i;
    });
    show(next);
  };
  const show = (next: number) => {
    if (next === active) return;
    active = next;
    steps.forEach((s, i) => s.classList.toggle("on", i === active));
    labels.forEach((l) => l.classList.toggle("on", Number(l.dataset.step) === active));
    place(coords);
    scene?.setStep(active);
  };

  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  new ResizeObserver(([entry]) => {
    w = entry!.contentRect.width;
    h = entry!.contentRect.height;
    sizes.clear();
    place(coords);
    onScroll();
  }).observe(fig);
  show(0);

  // Load the scene on the first input while the story is on (or near) the screen.
  type Connection = { saveData?: boolean };
  if ((navigator as Navigator & { connection?: Connection }).connection?.saveData) return;
  let near = false;
  let wanted = false;
  let started = false;
  const start = () => {
    if (started || !near || !wanted) return;
    started = true;
    const camera = JSON.parse(root.dataset.camera!) as StoryCamera;
    // Prototype switch: ?three builds the scene in code (./argus-story-build.ts) instead of the GLB.
    const code = new URLSearchParams(location.search).has("three");
    Promise.all([import("./argus-story-scene"), code ? import("./argus-story-build") : null])
      .then(([m, b]) => m.mount({ fig, url: root.dataset.model!, build: b?.buildArgusStory, camera, reduced, onFrame: place }))
      .then((s) => {
        scene = s;
        scene.setStep(active);
      })
      .catch(() => {
        // No WebGL, a failed download, an old browser: the poster stays, and it tells the same story.
      });
  };
  new IntersectionObserver(
    (entries) => {
      near = entries.some((e) => e.isIntersecting);
      start();
    },
    { rootMargin: "400px 0px" },
  ).observe(root);
  const inputs = ["scroll", "wheel", "pointerdown", "pointermove", "touchstart", "keydown"] as const;
  const onInput = () => {
    wanted = true;
    for (const t of inputs) window.removeEventListener(t, onInput);
    start();
  };
  for (const t of inputs) window.addEventListener(t, onInput, { passive: true });
}
