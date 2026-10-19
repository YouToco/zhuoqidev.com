---
title: "Desktop-Style Homepage"
summary: "The homepage as a desk: draggable cards that tilt with speed and remember their position, plus icons that open resizable windows."
category: layout
origin: original
stack: [html, css, javascript]
tags: [desktop metaphor, draggable, windows, handmade]
order: 110
files: [index.html]
demoHeight: 700
added: 2026-10-14
---

## What makes it work

- **Tilts while dragged**: while a card is held and dragged, the script computes a `--tilt` from horizontal speed, and CSS has `.pin.dragging { rotate: calc(var(--tilt) * 1deg); scale: 1.035 }`. On release `--tilt` is removed, and the `rotate` transition uses a spring curve written with `linear()`, so the card wobbles once and straightens.
- **Position remembered locally**: on release the position is saved to `localStorage`, horizontally as a "fraction of the desk width" and vertically in pixels, so cards stay on the desk when the window gets wider or narrower. "Tidy desk" clears it in one click.
- **Desktop icons**: a mouse click selects (the name gets a blue background) and only a double-click opens; keyboard Enter and a finger tap open directly, as on a real desktop.
- **Small windows**: drag the title bar to move, drag the bottom-right corner to resize; the red / yellow / green lights close / collapse / maximize, double-clicking the title bar also maximizes, and Esc closes. Collapse and maximize transition with the spring curve, while dragging follows the pointer with no transition.
- **Stars**: a faint ring of stars twinkles on empty desk space and is "pushed away" when the mouse approaches; clicking empty space spawns a small star.
- **Narrow screens**: below 720px all cards line up in one column, can't be dragged, and decorative elements are hidden.

## How to use it

1. Give the desk container `position: relative`, add `class="pin"` to each card, and for draggable ones also add `data-drag` and a unique `id` (used for saving the position).
2. Write each card's initial position in CSS, using something like `min(70%, calc(100% - card width))` for `left` so cards don't go off-screen on narrower displays.
3. Copy the "draggable cards" and "stars" sections of the script and change `KEY` (the storage key name).
4. For icons that open windows, write plain links: `<a class="desk-icon" href="/about/" data-win="...">`. In the example the window content comes from a `<template>`; on a real site you can use `<iframe src="link">` so the window shows an on-site page.
5. The narrow-screen breakpoint (720px in the example) should match your layout: below it there is no dragging and cards stack in one column in source order.

## Pitfalls

- If a card already has `transform: rotate(...)`, use the separate `rotate` property for the drag tilt, so the two stack; if both are in `transform` they override each other.
- Cards need `touch-action: none`, or the page scrolls along when a finger drags a card. But the single-column narrow layout must set it back to `auto`, otherwise a finger on a card can't scroll the page.
- Leave a 4px dead zone before a drag starts, otherwise just clicking a link inside a card counts as a drag and writes to storage once.
- `localStorage` throws in private mode or when site data is disabled, so wrap both reads and writes in `try/catch`.
- If a window contains an `iframe`, the `iframe` swallows pointer events while the window is dragged or resized; set `pointer-events: none` on it during the drag.
