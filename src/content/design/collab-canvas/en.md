---
title: "Collaborative Canvas"
summary: "The hero is a design canvas: one huge word in a selection box, and as you scroll, tools, interface scraps and named cursors gather round it."
category: style
origin: recreated
inspiredBy:
  name: "Onlines (web design studio, Argentina)"
  url: https://onlines.com.ar/
stack: [html, css, js]
tags: [canvas, multiplayer cursors, scroll-driven, big type, white]
order: 201
files: [index.html]
demoHeight: 760
added: 2026-10-20
---

Rebuilt after the Onlines home page. The idea is that a web studio puts the canvas it works on straight onto its home page, so a visitor's first view shows how the team makes things together. None of the original code or assets is used.

## What makes it work

- **One word is the hero**: a white canvas with a faint grid and one huge bold word, wrapped in a design tool's selection box (corner handles, layer name top-left). Black, white and a little blue.
- **Scrolling builds the canvas**: an `@property --p` runs from 0 to 1, and each piece (wireframes, a laptop, a phone, tool icons, an AI toggle, chat bubbles, a photo) slides in from its own direction and fades up. The hero is `position: sticky`, so it holds still while they arrive.
- **Cursors with names**: design, dev, client and Agent cursors each loop their own path, with a colored name tag under the pointer. Those tags are the only real color on the canvas. The visitor's own pointer gets a "you" tag too.
- **A sentence that inks in**: the statement is split into one `span` per character, and `animation-timeline: view()` turns them from pale grey to black as you scroll.
- **A phrase selected like text in an editor**: four characters sit under a translucent blue highlight with a bar and a dot at each end, as if dragged with the text cursor.
- **Cobalt cards**: the three service cards are a cobalt radial gradient under an SVG noise layer, which gives them a slightly printed feel.

## How to use it

1. Copy the `.canvas` grid background, `.word` and the `.sel` selection box, and swap in your own word.
2. Write each canvas object as a `.piece`: `--x` / `--y` set where it lands, `--ox` / `--oy` where it slides in from, and `--d` delays it.
3. A cursor is a `.cur` with its own `@keyframes` path; give the tag color in `--c`.

## Pitfalls

- The scroll effect needs `@property --p` registered as `<number>`, or `--p` can't interpolate and everything jumps into place. In browsers without `animation-timeline`, `--p` defaults to 1 and the finished canvas shows.
- Animate cursor paths with `left` in `cqi` (canvas width) and `top` in percent. Percentages in `translate` are relative to the cursor itself.
- With so many objects, keep only five or six on phones (`.hide-s`), or they cover the big word.
- Don't put real product logos (Figma, VS Code and so on) on the canvas; draw your own generic icons.
