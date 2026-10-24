// The homepage opening itself (started by boot.ts). Timeline in ms from the start:
//   250  卓琪 written stroke by stroke in its real stroke order (1.55s)
//  1750  "的开发笔记 · zhuoqidev.com" rises out of a blur, letter by letter
//  2050  a stone seal hovers above the paper, lifts a little, comes down
//  2500  it lands: the paper dips, ink spatters, the red print appears
//  2560  the stone lifts away, leaving a wet print that dries
//  3150  the print flies along an arc onto the seal logo in the top bar
//  3720  the print has landed; the page opens from the logo outwards, with a thin red ripple at the edge
//  4380  done
import { hanzi } from "../data/hanzi-strokes";
import { store } from "./store";

const SVG = "http://www.w3.org/2000/svg";
const SKIP_ON = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
// Ink spots around the seal: x, y and size as fractions of the seal, plus a height factor.
const SPOTS = [
  [-0.34, -0.22, 0.07, 1],
  [1.18, -0.12, 0.045, 0.7],
  [1.1, 0.96, 0.06, 1.3],
  [-0.2, 1.12, 0.035, 1],
  [1.3, 0.42, 0.03, 0.8],
  [0.5, -0.3, 0.03, 1.4],
  [-0.42, 0.6, 0.04, 0.9],
] as const;

interface Stroke {
  pen: SVGPathElement;
  len: number;
  glyph: number;
}

// Each stroke's outline becomes a clip path, and a thick line runs along its centre line inside it:
// drawing that line out reveals the stroke the way a brush would.
function strokes(svg: SVGSVGElement): Stroke[] {
  const defs = svg.appendChild(document.createElementNS(SVG, "defs"));
  const out: Stroke[] = [];
  (["卓", "琪"] as const).forEach((ch, glyph) => {
    const g = svg.appendChild(document.createElementNS(SVG, "g"));
    g.setAttribute("transform", `translate(${String(glyph * 942)} 900) scale(1 -1)`);
    hanzi[ch].strokes.forEach((outline, i) => {
      const clip = defs.appendChild(document.createElementNS(SVG, "clipPath"));
      clip.id = `boot-${String(glyph)}-${String(i)}`;
      clip.appendChild(document.createElementNS(SVG, "path")).setAttribute("d", outline);
      const pen = g.appendChild(document.createElementNS(SVG, "path"));
      pen.setAttribute("d", "M" + hanzi[ch].medians[i]!.map((p) => p.join(" ")).join(" L"));
      pen.setAttribute("clip-path", `url(#${clip.id})`);
      const len = pen.getTotalLength() + 200;
      pen.style.strokeDasharray = `${String(len)} ${String(len)}`;
      pen.style.strokeDashoffset = String(len);
      out.push({ pen, len, glyph });
    });
  });
  return out;
}

export function play(boot: HTMLElement) {
  const root = document.documentElement;
  clearTimeout(Number(root.dataset.bootFailsafe));
  store.set("zq-booted", 1);

  const $ = (sel: string) => boot.querySelector<HTMLElement>(sel)!;
  const stage = $(".boot-stage"),
    sig = $(".boot-sig"),
    seal = $(".boot-seal"),
    stone = $(".boot-stone"),
    shadow = $(".boot-shadow"),
    print = $(".boot-print"),
    wet = $(".boot-wet"),
    dent = $(".boot-dent"),
    line = $(".boot-line"),
    hint = $(".boot-skip"),
    ripple = $(".boot-ripple");
  const svg = boot.querySelector<SVGSVGElement>(".boot-hanzi")!;
  const logo = document.querySelector<HTMLElement>(".topbar .brand .seal");

  const timers: number[] = [];
  const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    for (const t of timers) clearTimeout(t);
    for (const type of SKIP_ON) removeEventListener(type, skip);
    root.classList.remove("booting");
    boot.remove();
  };
  function skip() {
    for (const type of SKIP_ON) removeEventListener(type, skip);
    void boot.animate({ opacity: [1, 0] }, { duration: 220, fill: "forwards" }).finished.then(finish, finish);
  }
  for (const type of SKIP_ON) addEventListener(type, skip, { passive: true });
  // Later animations on an element that already has one use fill "forwards": with "both", their
  // waiting state would override the earlier animation while it runs.
  const A = (el: Element, kf: Keyframe[] | PropertyIndexedKeyframes, o: KeyframeAnimationOptions) =>
    el.animate(kf, { fill: "both", ...o });

  // Where the page opens from: the centre of the logo seal (the inline style wins over the CSS default).
  const target = logo?.getBoundingClientRect();
  const tx = target ? target.left + target.width / 2 : 38;
  const ty = target ? target.top + target.height / 2 : 29;
  boot.style.setProperty("--ox", `${String(tx)}px`);
  boot.style.setProperty("--oy", `${String(ty)}px`);

  const pens = strokes(svg);
  const chars = [...line.querySelectorAll<HTMLElement>("[data-split]")].flatMap((el) => {
    el.replaceChildren(
      ...Array.from(el.textContent.trim(), (c) => Object.assign(document.createElement("span"), { textContent: c })),
    );
    return [...el.children];
  });
  const S = seal.offsetWidth;
  const inks = SPOTS.map(([x, y, d, r]) => {
    const i = seal.appendChild(document.createElement("i"));
    i.className = "boot-ink";
    Object.assign(i.style, {
      left: `${String(x * S)}px`,
      top: `${String(y * S)}px`,
      width: `${String(d * S)}px`,
      height: `${String(d * S * r)}px`,
    });
    return i;
  });

  // Camera: the whole scene drifts 3.5% closer while it plays.
  const push = A(stage, { scale: [1, 1.035] }, { duration: 3400, easing: "cubic-bezier(.3,.1,.3,1)" });
  A(hint, { opacity: [0, 1] }, { delay: 900, duration: 400 });

  // 1) 卓琪 in stroke order: 1.55s shared by length, 22ms between strokes, 120ms between the two.
  const total = 1550,
    gap = 22,
    charGap = 120;
  const budget = total - gap * (pens.length - 1) - charGap;
  const sum = pens.reduce((n, s) => n + s.len + 260, 0);
  let t = 250;
  pens.forEach((s, i) => {
    if (i && s.glyph !== pens[i - 1]!.glyph) t += charGap;
    const duration = ((s.len + 260) / sum) * budget;
    A(s.pen, { strokeDashoffset: [s.len, 0] }, { delay: t, duration, easing: "cubic-bezier(.4,.05,.5,.95)" });
    t += duration + gap;
  });

  // 2) the line under it
  chars.forEach((c, i) =>
    A(
      c,
      [
        { opacity: 0, transform: "translateY(10px)", filter: "blur(6px)" },
        { opacity: 1, transform: "none", filter: "blur(0)" },
      ],
      { delay: 1750 + i * 38, duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" },
    ),
  );

  // 3) the stone comes down from above, hovers, lifts a touch, then presses
  const hit = 2500,
    down = { delay: 2050, duration: hit - 2050, easing: "cubic-bezier(.55,0,.75,.2)" };
  A(
    stone,
    [
      { opacity: 0, transform: "translate(-6%, -42%) scale(1.55) rotate(-16deg)" },
      { opacity: 1, transform: "translate(-3%, -22%) scale(1.3) rotate(-8deg)", offset: 0.55 },
      { opacity: 1, transform: "translate(-3%, -26%) scale(1.34) rotate(-7deg)", offset: 0.78 },
      { opacity: 1, transform: "translate(0, 0) scale(.97) rotate(-4deg)" },
    ],
    down,
  );
  A(
    shadow,
    [
      { opacity: 0, transform: "translate(34%, 46%) scale(1.25)", filter: "blur(26px)" },
      { opacity: 0.28, transform: "translate(22%, 30%) scale(1.15)", filter: "blur(20px)", offset: 0.7 },
      { opacity: 0.55, transform: "translate(2%, 4%) scale(1)", filter: "blur(5px)" },
    ],
    down,
  );

  // 4) the landing: the paper dips, a pressure ring, spatter, and the print
  A(sig, [{ transform: "none" }, { transform: "translateY(3px)" }, { transform: "none" }], {
    delay: hit,
    duration: 220,
    easing: "ease-out",
    fill: "none",
  });
  A(
    dent,
    [
      { opacity: 0, scale: 0.7 },
      { opacity: 1, scale: 1, offset: 0.25 },
      { opacity: 0, scale: 1.25 },
    ],
    { delay: hit, duration: 700, easing: "ease-out" },
  );
  A(print, { opacity: [0, 1] }, { delay: hit, duration: 60 });
  A(wet, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0 }], {
    delay: hit + 150,
    duration: 1000,
    easing: "ease-in",
  });
  inks.forEach((el, i) =>
    A(
      el,
      [
        { opacity: 0, scale: 0 },
        { opacity: 0.85, scale: 1.15, offset: 0.6 },
        { opacity: 0.85, scale: 1 },
      ],
      { delay: hit + 10 + i * 12, duration: 200, easing: "cubic-bezier(.2,.9,.3,1)" },
    ),
  );

  // 5) the stone lifts away; its shadow spreads and fades
  A(
    stone,
    [
      { transform: "translate(0, 0) scale(.97) rotate(-4deg)", opacity: 1, filter: "blur(0)" },
      { transform: "translate(0, 0) scale(.985) rotate(-4deg)", opacity: 1, filter: "blur(0)", offset: 0.3 },
      { transform: "translate(3%, -24%) scale(1.3) rotate(-2deg)", opacity: 0, filter: "blur(6px)", offset: 0.85 },
      { transform: "translate(4%, -30%) scale(1.4) rotate(-1deg)", opacity: 0, filter: "blur(8px)" },
    ],
    { delay: hit + 60, duration: 460, easing: "cubic-bezier(.3,0,.2,1)", fill: "forwards" },
  );
  A(
    shadow,
    [
      { opacity: 0.55, transform: "translate(2%, 4%) scale(1)", filter: "blur(5px)" },
      { opacity: 0, transform: "translate(30%, 44%) scale(1.3)", filter: "blur(26px)" },
    ],
    { delay: hit + 230, duration: 400, easing: "ease-out", fill: "forwards" },
  );

  // 6) everything else fades; the print flies onto the logo
  const fly = 3150;
  for (const el of [svg, line, hint, ...inks])
    A(
      el,
      [
        { opacity: 1, filter: "blur(0)" },
        { opacity: 0, filter: "blur(4px)" },
      ],
      { delay: fly - 30, duration: 320, easing: "ease-in", fill: "forwards" },
    );
  at(fly, () => {
    push.pause(); // the drifting camera stops so the landing spot holds still
    const k = stage.getBoundingClientRect().width / stage.offsetWidth;
    const r = print.getBoundingClientRect();
    const dx = (tx - (r.left + r.width / 2)) / k,
      dy = (ty - (r.top + r.height / 2)) / k;
    const s = (logo?.offsetWidth ?? 36) / (S * k);
    A(
      print,
      [
        { translate: "0px 0px", scale: 1 },
        { translate: `${String(dx * 0.45)}px ${String(dy * 0.45 - 70 / k)}px`, scale: (1 + s) / 2, offset: 0.5 },
        { translate: `${String(dx)}px ${String(dy)}px`, scale: s },
      ],
      { duration: 520, easing: "cubic-bezier(.6,0,.2,1)", fill: "forwards" },
    );
  });

  // 7) the page opens from the logo, a red ripple riding the soft edge
  const open = 3720,
    spread = 640;
  const R = Math.hypot(Math.max(tx, innerWidth - tx), Math.max(ty, innerHeight - ty)) + 120;
  const opening = { delay: open, duration: spread, easing: "cubic-bezier(.55,0,.3,1)" };
  A(boot, { "--hole": ["-70px", `${String(R)}px`] }, opening);
  A(
    ripple,
    [
      { opacity: 0.85, width: "0px", height: "0px", margin: "0px" },
      {
        opacity: 0,
        width: `${String(2 * R + 70)}px`,
        height: `${String(2 * R + 70)}px`,
        margin: `${String(-R - 35)}px`,
      },
    ],
    opening,
  );
  at(open + spread + 20, finish);
}
