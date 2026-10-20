---
title: "Dark Cinema"
summary: "Warm brown-black, one orange light that drifts after the pointer, live timecode on letterbox bars, film grain; light mode is the matinee."
category: style
origin: recreated
inspiredBy:
  name: "Oryzo AI (Lusion, Awwwards Site of the Month Apr 2026)"
  url: https://www.awwwards.com/sites/oryzo-ai
stack: [html, css, js]
tags: [dark, cinematic, film grain, glow, pointer follow, award-winning style]
order: 203
files: [index.html]
demoHeight: 720
added: 2026-10-20
---

Rebuilt after the feel of dark-stage work such as Oryzo AI, Phantom.Land and Immersive Garden (Webby 2025 winner for Best Visual Design, Aesthetic). The WebGL parts of the originals are replaced with plain CSS and a few lines of script.

## What makes it work

- **The background isn't pure black**: `#100904` leans warm brown, which reads as a cinema rather than a switched-off screen. The whole page has one accent, `#FF8539`.
- **One light instead of a gradient background**: a large blurred `radial-gradient` breathes slowly on its own. Once the pointer enters, it moves 8% of the way toward the pointer each frame, so the light drifts over instead of snapping.
- **Letterbox bars**: black bars above and below the hero. The top one carries a timecode running live at 24 fps and the lens data, the bottom one the scene. Monospace text appears only on the bars.
- **Film grain**: one SVG `feTurbulence` noise tile covers the screen with `mix-blend-mode: overlay`, stronger in dark mode and lighter in light mode.
- **Film strip**: three shots sit on a black strip whose sprocket holes are two rows of repeating `radial-gradient` dots.

## How to use it

1. Copy `:root` and the dark block. This style is dark first; light is the matinee: warm paper background, dark brown text and a slightly deeper orange.
2. Copy the `.grain` layer and the `.light` as they are. The pointer follow is the second half of the script and doesn't run under `prefers-reduced-motion`.
3. The headline is a light italic serif. The demo uses the built-in Iowan / Palatino / Georgia; for more of a film-poster look, self-host an open-source light italic serif.

## Pitfalls

- The grain layer needs `position: fixed; pointer-events: none` and the top z-index. Without `pointer-events: none` it blocks every click.
- The light is large (620px), so its parent needs `overflow: hidden`, or the page scrolls sideways.
- The timecode rewrites its text every frame; use `font-variant-numeric: tabular-nums`, or digits of different widths make the line jitter.
- With `overlay`, grain almost vanishes on a light background and gets muddy on a dark one. Tune the opacity per mode (0.12 and 0.22 in the demo).
