---
title: "Magnetic Button"
summary: "The button is pulled toward the approaching mouse, its text following more for depth, then springs back. JS writes only two variables."
category: button
origin: original
stack: [html, css, js]
tags: [button, motion, spring, micro-interaction]
order: 4
files: [index.html]
demoHeight: 420
added: 2026-10-19
---

## What makes it work

- **JS computes only two numbers**: the pointer's offset from the button's center, normalized to -1…1 and written into `--x` and `--y`. All displacement is in CSS: the button uses `translate: calc(var(--x) * var(--pull)) …`.
- **Parallax gives depth**: the text inside moves 0.6 times the button's movement, in the same direction but on top of it, so the text looks like it floats a bit higher than the button.
- **Following and bouncing back are two curves**: while the pointer is nearby, `.near` is added and the transition shrinks to 0.18 s ease-out, following tightly; after it leaves, `.near` is removed and it returns on a 0.9 s spring curve, overshooting a little before it stops.
- **Range of pull**: the button is affected within 60px outside it, and the effect gets stronger toward the center; `--pull` controls the maximum displacement, and round buttons get a larger value.
- **At most one computation per frame**: `pointermove` only records the position, and the actual computation happens in `requestAnimationFrame`.

## How to use it

1. Copy the three CSS blocks `.mag`, `.mag .t`, `.mag.near` and the script; wrap the text in the button in a `<span class="t">`.
2. For a more exaggerated effect, adjust `--pull`; for a larger range, adjust `REACH` in the script.
3. Enable it only under `(hover: hover) and (pointer: fine)`: on touch screens there's no such thing as "approaching", and a button running away when a finger presses down just makes it impossible to hit.

## Pitfalls

- When computing distance, use the button's **original** position: `getBoundingClientRect()` returns the displaced box, so the example stores the previous displacement in `data-dx/dy` and subtracts it back, otherwise the button gets pulled further and further away and jitters.
- Don't put too many on one page: every button is measured once per frame; a dozen or so is fine.
- Under `prefers-reduced-motion: reduce`, simply turn off the displacement.
