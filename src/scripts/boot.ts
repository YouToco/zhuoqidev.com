// Homepage opening, first visit on a wide screen only (the inline script in the page head decides
// and adds html.booting): 卓琪 is written stroke by stroke, a stone seal stamps it, and the print
// flies onto the logo in the top bar, where the page opens up. Any click, key, wheel or touch skips
// straight to the page. The animation and its stroke data load only when it plays.
const root = document.documentElement;
const boot = document.querySelector<HTMLElement>("[data-boot]");

if (boot && root.classList.contains("booting")) {
  import("./boot-play").then(
    ({ play }) => {
      play(boot);
    },
    () => {
      root.classList.remove("booting");
      boot.remove();
    },
  );
} else {
  boot?.remove();
}
