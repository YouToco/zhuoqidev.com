---
title: "Brand Mosaic"
summary: "A brand guide's contents as a wall of flat color tiles that slide in along the grid as you scroll, then keep swapping colors and states."
category: style
origin: recreated
inspiredBy:
  name: "Dropbox Brand (Daybreak Studio, Awwwards Site of the Month Feb 2025)"
  url: https://brand.dropbox.com/
stack: [html, css, svg, js]
tags: [brand guidelines, color blocks, grid, scroll-driven, state change]
order: 202
files: [index.html]
demoHeight: 760
added: 2026-10-20
---

Rebuilt after the contents page of the Dropbox brand site. The idea is that the contents page is the guide itself: each tile shows its own chapter's rule (the type tile is a big Aa, the motion tile is an ease curve), and the whole wall keeps quietly changing. None of the original code, logo or fonts is used.

## What makes it work

- **One blue sentence first**: the page opens on a bare 12-column grid with a single big sentence in the brand blue that says what this is.
- **Tiles slide in along the grid**: as you scroll, the eight chapter tiles slide in from the left, right, top and bottom until they lock into one wall with only 6px between them. Progress lives on a `view-timeline`, and the wall stays `sticky` until it is complete.
- **Each tile shows itself**: framework is three nodes, voice a pair of big quote marks, logo a folded square, type an Aa, icons a lock, color two swatches, imagery hills and a sun, motion a dot running along an ease curve. All flat SVG, with no shadows or textures.
- **The wall keeps changing**: once it's built, every 1.8 seconds one random tile swaps to a new color pair (background and text change together) and its glyph changes state. The quotes go from filled to outlined, the lock opens, the Aa turns light italic, a node moves.
- **Hover is a door**: the tile grows slightly and an arrow appears after its title.

## How to use it

1. Copy the `grid-template-areas` of `.mosaic` and reshape the areas for your chapters; give each tile a `--bg` and a `--fg`.
2. Each tile's slide-in direction is `--ox` / `--oy`, in units of the tile's own width and height (`1.2` = slides 1.2 of its own widths).
3. The color pool is `pairs` in the script, written as background and text pairs, so the contrast always holds when a tile changes.

## Pitfalls

- Color every glyph with `currentColor` and `var(--bg)`, so the whole tile changes with its pair; anything hard-coded stays behind.
- SVG attribute transitions such as `d: path()` only work in Chromium; Safari jumps straight to the new state. For smoothness everywhere, animate only `transform`.
- On phones the wall becomes two columns with no sticky or slide-in, showing the finished wall; the color swaps still run.
- Under `prefers-reduced-motion` the script never starts, and the wall rests finished and still.
