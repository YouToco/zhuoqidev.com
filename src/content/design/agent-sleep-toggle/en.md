---
title: "An Agent Card That Falls Asleep"
summary: "Off: the blue hexagon mascot shrinks into a grey ball, eyes shut, z's rising. On: it pops back. Awake, its eyes follow you."
category: card
origin: recreated
inspiredBy:
  name: "recent.design · Agent Sleep Toggle（Michael Filipiuk）"
  url: https://recent.design/i/zslnemt-agent-sleep-state-toggle
stack: [html, css, svg, js]
tags: [mascot, switch, morph, eye tracking, micro-interaction, spring]
order: 6
files: [index.html]
demoHeight: 560
added: 2026-10-19
---

A recreation of a 7.7-second recording by Michael Filipiuk on recent.design (video only). With an agent I pulled the key frames (0.6 s around each switch, one every 40 ms) and tuned it against the original frame by frame.

## What makes it work

- **One path morphs between a hexagon and a circle**: both are written as a radius per angle, sampled at 120 points, so any mix of the two is a valid shape. The hexagon pinches smoothly into a circle, and the middle frame is a dusty-blue rounded blob, as in the original.
- **A rounded hexagon from a p-norm**: a hexagon is six face normals with `x·nᵢ ≤ a`; replacing the max with a p-norm (`P = 16`) rounds the corners while the edges stay straight. Lower `P` is rounder; too low and the edges bulge.
- **Falling asleep is three things at once** (about 160 ms): the shape rounds and shrinks (radius about 0.76 of the hexagon), the colour goes from bright blue through grey-blue to grey, and the eyes go from upright pills to dots to two short dashes (interpolated in two stages, so the middle frame shows dots). The dashes sit one a little higher and both slightly tilted, which reads as drowsy.
- **Waking has a spring**: in 420 ms the hexagon is back within the first 45%, the rest is a damped spring that overshoots to 1.07× and settles, a "pop" awake.
- **Z's overhead**: three bold z's take turns drifting up and right from the top of the head, growing and fading (a CSS animation, a third of a cycle apart).
- **Awake, it watches you**: the eyes follow the mouse; looking aside, the pills lean that way and move a little closer together, and the whole body shifts 3–4 px; it blinks every 2.6–5.2 s.

## How to use it

1. Copy the CSS for `.agent`, `.mascot`, `.zs`, `.state` / `.switch` and the whole script.
2. Shape parameters are at the top of the script: `A` (half the hexagon's height), `R` (the sleeping circle's radius), `P` (corner roundness); colours are in `SKIN()`, one set for light and one for dark.
3. The switch is a real `role="switch"` button wrapped in a `<label>`, so clicking the word "Active" toggles it too; each change is written to an `aria-live` region, so screen readers announce it.

## Pitfalls

- With a button inside a `<label>`, don't also add a listener on the label that calls `button.click()`: the label already forwards the click, and it toggles twice.
- For a gradient on a shape that changes, keep the default `objectBoundingBox` units (`y1=0 y2=1`) so it follows the shape's box; writing -1…1 shows only the middle of the colour range.
- Recomputing a 120-point path each frame is cheap, but don't put dozens on a page; you can stop the `requestAnimationFrame` loop while it is off screen.
- Eye tracking only updates a target on `pointermove`; the actual position moves 16% of the way there each frame, so a jittery mouse never makes the eyes jump. Under `prefers-reduced-motion` the eyes don't follow or blink, the shape switches instantly and the z's hold still.
