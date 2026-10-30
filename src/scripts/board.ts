// The desk: cards can be dragged on wide screens and remember where they were put, as an offset
// (left / top on a relatively positioned card) from their spot in the column, so a card that grows
// still pushes the ones under it down. Without JS (or on narrow screens) the cards stay in place.
import { store } from "./store";

type Spot = { x: number; y: number };
// v3: spots became offsets when the desk turned into columns (2026-10-30); v2 held absolute spots.
const KEY = "zq-board-v3";
const board = document.getElementById("board");

if (board) {
  const wide = () => window.matchMedia("(min-width: 1001px)").matches;
  const pins = [...board.querySelectorAll<HTMLElement>(".pin[data-drag]")];
  let z = 10;

  store.del("zq-board-v2");
  const saved = store.get<Record<string, Spot>>(KEY) ?? {};
  if (wide()) {
    for (const p of pins) {
      const s = saved[p.id];
      if (s) {
        p.style.left = `${s.x}px`;
        p.style.top = `${s.y}px`;
      }
    }
  }

  for (const p of pins) {
    p.addEventListener("pointerdown", (e) => {
      if (!wide() || e.button !== 0 || (e.target as Element).closest("a, button")) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const ox = parseFloat(p.style.left) || 0;
      const oy = parseFloat(p.style.top) || 0;
      // Where the card sits in its column; the offset keeps it inside the desk.
      const homeX = p.offsetLeft - ox;
      const homeY = p.offsetTop - oy;
      let moved = false;
      // Lean into the drag: the faster the card moves sideways, the more it tilts (CSS --tilt).
      let lastX = e.clientX;
      let lastT = e.timeStamp;
      let tilt = 0;
      p.setPointerCapture(e.pointerId);
      p.style.zIndex = String(++z);
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        moved = true;
        p.classList.add("dragging");
        const dt = Math.max(8, ev.timeStamp - lastT);
        tilt = tilt * 0.7 + Math.max(-9, Math.min(9, ((ev.clientX - lastX) / dt) * 6)) * 0.3;
        lastX = ev.clientX;
        lastT = ev.timeStamp;
        p.style.setProperty("--tilt", tilt.toFixed(2));
        const x = Math.max(0, Math.min(board.clientWidth - p.offsetWidth, homeX + ox + dx));
        const y = Math.max(0, Math.min(board.clientHeight - p.offsetHeight, homeY + oy + dy));
        p.style.left = `${x - homeX}px`;
        p.style.top = `${y - homeY}px`;
      };
      const up = () => {
        p.removeEventListener("pointermove", move);
        p.classList.remove("dragging");
        p.style.removeProperty("--tilt");
        if (moved) {
          const all = store.get<Record<string, Spot>>(KEY) ?? {};
          all[p.id] = { x: parseFloat(p.style.left) || 0, y: parseFloat(p.style.top) || 0 };
          store.set(KEY, all);
        }
      };
      p.addEventListener("pointermove", move);
      p.addEventListener("pointerup", up, { once: true });
      p.addEventListener("pointercancel", up, { once: true });
    });
  }

  // A click on the bare desk leaves a little star behind.
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  board.parentElement?.addEventListener("click", (e) => {
    if (still.matches || (e.target as Element).closest(".pin, a, button")) return;
    const star = document.createElement("span");
    star.className = "click-star";
    star.textContent = "✦";
    star.setAttribute("aria-hidden", "true");
    star.style.left = `${e.clientX}px`;
    star.style.top = `${e.clientY}px`;
    star.style.fontSize = `${14 + Math.random() * 12}px`;
    document.body.append(star);
    star.addEventListener("animationend", () => star.remove(), { once: true });
  });

  // Faint stars twinkle on the bare desk and drift out of the pointer's way.
  if (wide() && !still.matches && matchMedia("(hover: hover)").matches) {
    const sky = document.createElement("div");
    sky.className = "desk-stars";
    sky.setAttribute("aria-hidden", "true");
    // Fixed spots (percent of the desk) so the sky looks the same on every visit.
    const spots = [
      [31, 3],
      [56, 2],
      [92, 9],
      [35, 15],
      [66, 13],
      [97, 30],
      [33, 41],
      [64, 44],
      [96, 47],
      [34, 63],
      [68, 66],
      [6, 85],
      [27, 83],
      [55, 86],
      [70, 97],
      [93, 99],
    ];
    const stars = spots.map(([x, y], i) => {
      const s = document.createElement("span");
      s.textContent = "✦";
      s.style.left = `${x}%`;
      s.style.top = `${y}%`;
      s.style.fontSize = `${9 + ((i * 7) % 9)}px`;
      s.style.animationDelay = `${-Number(((i * 1.37) % 4).toFixed(2))}s`;
      s.style.animationDuration = `${3 + (i % 4) * 0.7}s`;
      sky.append(s);
      return s;
    });
    board.append(sky);

    let frame = 0;
    let px = -1e4;
    let py = -1e4;
    const push = () => {
      frame = 0;
      // Measure from where each star rests (offsets ignore its current drift).
      const box = sky.getBoundingClientRect();
      for (const s of stars) {
        const dx = box.left + s.offsetLeft + s.offsetWidth / 2 - px;
        const dy = box.top + s.offsetTop + s.offsetHeight / 2 - py;
        const d = Math.hypot(dx, dy);
        const f = d < 110 ? (110 - d) * 0.45 : 0;
        s.style.translate = f ? `${((dx / d) * f).toFixed(1)}px ${((dy / d) * f).toFixed(1)}px` : "";
      }
    };
    const wrap = board.parentElement!;
    wrap.addEventListener("pointermove", (e) => {
      px = e.clientX;
      py = e.clientY;
      frame ||= requestAnimationFrame(push);
    });
    wrap.addEventListener("pointerleave", () => {
      px = py = -1e4;
      frame ||= requestAnimationFrame(push);
    });
  }

  document.getElementById("reset-board")?.addEventListener("click", () => {
    store.del(KEY);
    location.reload();
  });
}
