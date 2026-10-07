// Terminal lines that play back like a shell session: commands type out one character at a time,
// their output fades in after. CSS does the animating; this only times each line.
export function cue(tty: HTMLElement, start = 0.15): number {
  let t = start;
  for (const ln of tty.querySelectorAll<HTMLElement>(".ln")) {
    ln.style.setProperty("--d", `${t.toFixed(2)}s`);
    if (ln.classList.contains("cmd")) {
      const n = ln.textContent!.length;
      ln.style.setProperty("--n", String(n));
      t += n * 0.03 + 0.12;
    } else {
      t += 0.16;
    }
  }
  return t;
}
