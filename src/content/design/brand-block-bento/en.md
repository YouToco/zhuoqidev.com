---
title: "Brand Block Bento"
summary: "A bento wall of color tiles, one brand rule per tile: type, easing, icons, radius, color, voice, timing, each one clickable."
category: style
origin: recreated
inspiredBy:
  name: "Dropbox Brand (Daybreak Studio, Awwwards Site of the Month Feb 2025)"
  url: https://www.awwwards.com/sites/dropbox-brand
stack: [html, css, js]
tags: [brand guidelines, bento, color blocks, design system, micro-interaction, award-winning style]
order: 202
files: [index.html]
demoHeight: 680
added: 2026-10-20
---

Rebuilt after the idea behind the Dropbox brand site: a brand guide split into a wall of color tiles. None of its code, fonts or icons is used.

## What makes it work

- **One tile, one rule**: type, easing, icons, radius, color, voice and timing each get a tile with one sentence, so a reader takes in the whole guide at a glance.
- **Every tile does something**: in the easing tile three dots run the same distance on different curves, and the brand curve starts fast and lands slowly. The icon tile turns one step like a slot machine when clicked. In the color tile the chip you click widens and shows its hex. Hovering the type tile thins the giant Aa from bold to light.
- **A big solid block and one giant letter**: the primary-color tile spans 2×2, and a single Aa is the cover, no illustration needed.
- **Radii that add up**: the radius tile shows inner radius = outer radius − padding, which is what keeps three nested edges parallel.
- **Voice is a rule too**: the struck-out corporate sentence sits next to the plain rewrite, so copywriters know what to aim for.

## How to use it

1. Copy the `.bento` grid (4 columns → 2 → 1) and the base `.tile` styles. Large tiles use `grid-column: span 2; grid-row: span 2`.
2. To recolor, change only `--blue` / `--coral` / `--lime` / `--pink` / `--yellow` in `:root`, plus the same tokens in the dark block.
3. The spring is a sampled `linear()` curve (`--spring`) used for the hover lift and the chip widening. Older browsers without `linear()` fall back to the default easing.

## Pitfalls

- Light text goes only on the primary and dark tiles. On the coral, lime, pink and yellow tiles hard-code dark text, or it turns light in dark mode and becomes unreadable.
- When the slot machine reaches the last glyph it must jump back to the first instantly: remove the `transition`, reset to `translateY(0)`, read `offsetHeight` once to force a reflow, then restore the `transition`.
- The chips widen with `flex`, so give them `min-width: 0`; otherwise the hex text props a chip open and pushes the others out of the tile.
