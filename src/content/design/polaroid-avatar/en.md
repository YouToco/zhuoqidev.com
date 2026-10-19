---
title: "Polaroid Avatar"
summary: "An avatar as a Polaroid: white border, tape, handwriting; on a desk it drags, tilts when fast, and springs back on release."
category: card
origin: original
stack: [html, css, svg, js]
tags: [avatar, polaroid, handmade, drag, spring]
order: 20
files: [index.html]
demoHeight: 520
added: 2026-10-14
---

## What makes it work

- **Three things are enough**: a white photo-paper border (wider at the bottom than on the other three sides), a translucent strip of tape on top, and a line of handwriting below. Whatever photo you put inside looks like a Polaroid.
- **The photo paper is always white**: in dark mode the desk gets dark, but the colors of the photo paper and the handwriting are hard-coded, like a real photo lying on a desk at night.
- **The tape is just one gradient**: `repeating-linear-gradient` alternates one yellow between darker and lighter, and tilting it 3 degrees gives it the feel of washi tape.
- **Tilts when dragged**: while held it scales up a bit (`scale: 1.035`), a `--tilt` is computed from horizontal speed, and CSS tilts with `rotate: calc(var(--tilt) * 1deg)`; after release it is removed, and the `linear()` spring curve makes it wobble once and settle flat.
- **Resting tilt and drag tilt are separate**: the usual 4 degrees is on `transform`, and the drag tilt is on the separate `rotate` property, so the two stack without overriding each other, and on spring-back it returns only to 4 degrees.
- **The placeholder avatar is an SVG pencil drawing**: `feTurbulence` + `feDisplacementMap` add a slight wobble to the lines, and the hair is hatched with a diagonal-line `pattern`, so no image is needed.

## How to use it

1. Copy the three CSS blocks `.polaroid`, `.tape`, `.polaroid figcaption` and the `--spring` variable.
2. Replace the `<svg>` with your `<img>` (add `draggable="false"`, otherwise the browser drags out a ghost image).
3. If you only want a static one (for example on an "About" page): remove the script, `touch-action: none` and `cursor: grab`, and adjust the angle in `transform` to your layout (for example `rotate(-3deg)`).
4. For dragging: give the parent container `position: relative` and the photo `position: absolute`, and copy the `pointerdown` script; to remember the position, save `left/top` to `localStorage` in `up()`.

## Pitfalls

- Add `touch-action: none` only on the photo: if it is on the whole container, a finger on blank space can't scroll the page on phones. A safer approach is to enable dragging only on wide screens and fall back to a normal single column on narrow ones.
- Without a check like "only movement over 4px counts as a drag", even a simple click triggers the `dragging` class and the photo jiggles.
- Use `setPointerCapture` for dragging, otherwise if the mouse moves fast and leaves the photo, `pointermove` is no longer received.
- The handwriting font uses only system fonts (Kai typefaces on Apple / Windows, AR PL UKai on Linux). For a more handwritten look, add your own font files, and remember to subset Chinese fonts to the characters the page uses, otherwise they are several MB.
