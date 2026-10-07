// The desk: cards can be dragged on wide screens and remember where they were put.
// Without JS (or on narrow screens) the same cards render as a plain column.
import { store } from "./store";

type Spot = { x: number; y: number };
const KEY = "zq-board-v1";
const board = document.getElementById("board");

if (board) {
  const wide = () => window.matchMedia("(min-width: 1001px)").matches;
  const pins = [...board.querySelectorAll<HTMLElement>(".pin[data-drag]")];
  let z = 10;

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
      const ox = p.offsetLeft;
      const oy = p.offsetTop;
      let moved = false;
      p.setPointerCapture(e.pointerId);
      p.style.zIndex = String(++z);
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        moved = true;
        p.classList.add("dragging");
        const maxX = board.clientWidth - p.offsetWidth;
        p.style.left = `${Math.max(0, Math.min(maxX, ox + dx))}px`;
        p.style.top = `${Math.max(0, oy + dy)}px`;
      };
      const up = () => {
        p.removeEventListener("pointermove", move);
        p.classList.remove("dragging");
        if (moved) {
          const all = store.get<Record<string, Spot>>(KEY) ?? {};
          all[p.id] = { x: p.offsetLeft, y: p.offsetTop };
          store.set(KEY, all);
        }
      };
      p.addEventListener("pointermove", move);
      p.addEventListener("pointerup", up, { once: true });
      p.addEventListener("pointercancel", up, { once: true });
    });
  }

  document.getElementById("reset-board")?.addEventListener("click", () => {
    store.del(KEY);
    location.reload();
  });
}
