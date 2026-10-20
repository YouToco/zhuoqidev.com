---
title: "Brand Mosaic"
summary: "A brand guide as one wall of flat color tiles: first a single blue square, then the camera pulls back until it is the mark in the middle."
category: style
origin: recreated
inspiredBy:
  name: "Dropbox Brand (Daybreak Studio, Awwwards Site of the Month Feb 2025)"
  url: https://brand.dropbox.com/
stack: [html, css, svg, js]
tags: [brand guidelines, color blocks, camera pull-back, scroll-driven, blueprint hover]
order: 202
files: [index.html]
demoHeight: 760
added: 2026-10-20
---

Rebuilt frame by frame from the Dropbox brand site's home page. None of its logo, fonts or copy is used; the content is this blog's own guide instead, with Chinese corner quotes 「」 for voice and the character 永 for type (it holds all eight basic brush strokes).

## What makes it work

- **The opening is almost empty**: a white page with a faint blue grid, one small blue sentence, and an arrow pointing down.
- **One square, then the camera pulls back**: scrolling shows a single blue square that says what the guide covers, with only the corners of other tiles showing round it. Scroll on and the whole wall shrinks and closes in until that square is the small mark tile in the middle. The zoom centre is the screen centre: the five columns and three rows are symmetric, so the small tile sits exactly in the middle.
- **Tiles start apart and close in**: scaling alone would fill the screen with color from the start. So each tile is also pushed out by its distance from the centre and pulled back while the camera retreats; the opening stays mostly white, and the gaps narrow from wide to 10px.
- **Tone on tone**: each tile's title and glyph use a deep shade of its own hue (dark wine on orange, dark brown on yellow, ink green on sky blue) instead of black or white, so eight colors sit together quietly.
- **Hover is a blueprint**: the tile turns black, its title white, and its glyph becomes white line work that moves once. The links redraw as curved arrows, the lock springs open, the two swatches swap, the sun turns into a moon, and a dot runs along the motion curve.
- **Only the outer corners are round**: just the wall's four outer corners get an 8px radius; inner tiles are square, so it reads as one block cut apart.

## How to use it

1. Copy the tracks and `grid-template-areas` of `.mosaic`. Keep the tracks symmetric with a small tile in the middle, so the camera lands on it.
2. Give each tile `--bg` and `--fg`, with `--fg` a deep shade of the same hue. Color every glyph with `var(--g)`; hover only changes `--g`, and the whole tile turns to line work.
3. The camera timing lives in `update()`: 0–6% only the sentence, 6–12% the blue square, 12–46% a slow drift, 46–56% the words fade, 56–92% the pull-back. Change those numbers to change the pace.

## Pitfalls

- The blue square's paragraph is not scaled with the square. It sits on its own over the centre of the screen, sized from the square's current size. Inside the scaled square, Chinese-locale Chrome's minimum font size enlarges it and breaks the layout.
- Measure the push-apart offsets with no transform applied (`offsetLeft` / `offsetTop`), and measure again on resize.
- Keep the wall at `pointer-events: none` until the pull-back is done, or hover effects fire while scrolling past.
- On phones there is no camera move: the sentence, the blue square and a two-column wall show in order. Under reduced motion there is no camera either, just the finished wall.
