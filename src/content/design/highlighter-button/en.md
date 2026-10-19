---
title: "Highlighter Swipe"
summary: "Links and buttons get swiped by a highlighter, slanted tip, set low, each wrapped line marked separately, wiped off rightward. Pure CSS."
category: button
origin: original
stack: [html, css]
tags: [button, link, handmade, zero-dependency, micro-interaction]
order: 2
files: [index.html]
demoHeight: 560
added: 2026-10-19
---

## What makes it work

- **The stroke is a background, not a pseudo-element**: the link's background is `linear-gradient(transparent 52%, yellow 52%, yellow 90%, transparent 90%)`, covering only the lower half of the line height, like a highlighter dragged low; `background-size` transitions from `0% 100%` to `100% 100%`, which paints left to right.
- **Wrapped lines work too**: `box-decoration-break: clone` gives each line of a wrapped link its own stroke, instead of one block that starts on the first line and ends on the last.
- **Slanted tip**: the stroke on buttons is a `::before`, with `skewX(-18deg)` cutting both ends at an angle and `rotate(-2deg)` making it less straight; `scaleX` goes from 0 to 1.
- **Direction of the wipe**: on leave, `transform-origin` is switched to the right, so retracting looks like wiping off to the right rather than shrinking back the way it came.
- **Marking emphasis**: the third kind is toggleable, keeping the yellow stroke when `aria-pressed="true"`, suitable for states like "read" or "saved".

## How to use it

1. Body links: copy `.hl` and add the class name to the `<a>`; change the color with `--c`.
2. Buttons: copy `.mk` with its `::before` and `:hover` rules; the button background must be transparent so the yellow bar shows up under the text (`isolation: isolate` + `z-index: -1` already handle the layering).
3. In dark mode, swap the highlighter yellow for a darker saturated color (`#7d6416` in the example), so light text on top stays readable.

## Pitfalls

- The `background-size` transition may drop frames in very old versions of Safari, which is acceptable.
- Links have no underline by default; remember to leave a marker that makes them recognizable as links at rest (the example uses a dashed line), otherwise people only learn they are clickable when hovering.
- Touch screens have no hover: a tapped link navigates away so the animation isn't seen, which is fine; for buttons the same effect can be attached to `:active`.
