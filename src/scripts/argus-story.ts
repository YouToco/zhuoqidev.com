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
  // runs. A label stays inside the picture (its box slides sideways, its stem stays on the point) and
  // sits beside the point when there is no room above it. Label sizes are read once, before any
  // write, so moving the labels along with the 3D camera never forces a layout.
  let coords = JSON.parse(root.dataset.pins!) as PinCoords;
  let w = 0;
  let h = 0;
  const sizes = new Map<HTMLElement, [number, number]>();
  const place = (next: PinCoords) => {
    coords = next;
    for (const el of w ? labels : []) {
      if (!el.classList.contains("on") || sizes.has(el)) continue;
      const box = el.firstElementChild as HTMLElement;
      sizes.set(el, [box.offsetWidth, box.offsetHeight]);
    }
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
      const side = p[1] * h < bh + 30;
      const left = side && x + bw + 24 > w;
      const half = bw / 2 + 8;
      el.style.setProperty("--dx", side ? "0px" : `${Math.min(Math.max(x, half), w - half) - x}px`);
      el.classList.toggle("side", side && !left);
      el.classList.toggle("side-l", left);
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
    import("./argus-story-scene")
      .then((m) => m.mount({ fig, url: root.dataset.model!, camera, reduced, onFrame: place }))
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
