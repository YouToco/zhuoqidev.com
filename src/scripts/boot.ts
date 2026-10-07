// Homepage boot screen, first visit on a wide screen only (the inline script in the page head
// decides and adds html.booting). The session types out, the bar fills, then the view zooms
// through the screen onto the desk. Any click, key, wheel or touch skips straight to the desk.
import { store } from "./store";
import { cue } from "./typing";

const root = document.documentElement;
const boot = document.querySelector<HTMLElement>("[data-boot]");

if (boot && root.classList.contains("booting")) {
  clearTimeout(Number(root.dataset.bootFailsafe));
  store.set("zq-booted", 1);
  const tty = boot.querySelector<HTMLElement>(".tty")!;
  const end = cue(tty, 0.3);
  tty.classList.add("play");

  const skipOn = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
  let timer = 0;
  const finish = (skipped: boolean) => {
    clearTimeout(timer);
    for (const type of skipOn) removeEventListener(type, skip);
    boot.classList.add(skipped ? "skip" : "zoom");
    setTimeout(
      () => {
        root.classList.remove("booting");
        boot.remove();
      },
      skipped ? 250 : 700,
    );
  };
  const skip = () => finish(true);
  // The bar starts filling with the last line and takes 0.8s.
  timer = window.setTimeout(() => finish(false), (end + 0.9) * 1000);
  for (const type of skipOn) addEventListener(type, skip, { passive: true });
} else {
  boot?.remove();
}
