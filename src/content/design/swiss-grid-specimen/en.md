---
title: "Swiss Grid Type Specimen"
summary: "Two colors only: the 12-column grid is drawn on the page, the type scale is the content, a slider changes weight live, index rows invert."
category: style
origin: recreated
inspiredBy:
  name: "Exat Typeface (Studio Size, Webby 2026 Aesthetic nominee)"
  url: https://www.awwwards.com/sites/exat-typeface
stack: [html, css, js]
tags: [swiss style, grid, type specimen, variable weight, two colors, award-winning style]
order: 201
files: [index.html]
demoHeight: 760
added: 2026-10-20
---

Rebuilt after the feel of Exat Typeface, Siena Film Foundation and the Anime.js site (all Awwwards Site of the Day or Month winners). None of their code or fonts is used.

## What makes it work

- **The grid is visible**: inside the page gutters there are 12 columns with a 16px gap. A `position: fixed` layer draws the column lines, and the top-bar button hides them. Every block lines up on a column with `grid-column`. On phones it drops to 6 columns.
- **Two colors only**: paper `#EEEFEB` and ink `#1C1D1E`; dark mode swaps the two. Hierarchy comes from size, weight and 1px rules alone.
- **The type scale is the content**: 96 / 64 / 40 / 24 / 16 / 12 are listed row by row, each with a small monospace size label and a hairline, like a foundry specimen book.
- **One interaction carries the page**: the slider sets a single CSS variable `--w`, and the big letters, the scale and the sample word all change `font-weight` together. Four common weights are shortcut buttons.
- **Index rows invert on hover**: each project row has four cells (number / name / tags / year). On hover the whole row turns ink-on-paper and shifts right a little, which gives feedback without cards.

## How to use it

1. Copy `--paper` / `--ink` / `--cols` / `--gap` / `--pad` from `:root` and the `.g` grid class, then give each block `grid-column: start / span n`.
2. For the column lines, copy `.overlay` and `drawCols()` from the script. It reads the count from `--cols` and redraws at each breakpoint.
3. The weight slider needs a variable font. Apple's system font and Windows 11's Segoe UI Variable are variable. To look the same on every machine, self-host an open-source variable grotesque such as Inter or Schibsted Grotesk.

## Pitfalls

- On Linux the system font usually has only regular and bold, so the slider jumps between two weights instead of changing smoothly. Ship your own variable font for real use.
- Don't load Google Fonts: they are blocked in mainland China, and a `<link>` stylesheet also holds up the first render.
- The grid layer needs `pointer-events: none`, or it covers the links and the slider underneath.
- The big letters use `line-height: 0.78` to sit on the bottom rule, and their size follows the width with `clamp()`. Give small screens their own lower bound, or the page scrolls sideways at 375px.
