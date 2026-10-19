---
title: "3D Scroll Storytelling"
summary: "A pinned 3D scene with text scrolling on the right: camera moves per step, parts pop in, labels follow 3D points. Pure three.js."
category: visual
origin: original
stack: [html, css, three.js]
tags: [3D, scroll storytelling, product intro, clay style]
order: 140
files: [index.html]
demoHeight: 640
added: 2026-10-14
---

## What makes it work

- **Pinned stage**: the scene is pinned on the left with `position: sticky`, and on the right each step is a card at least 62vh tall; on phones the stage is pinned at the top and cards scroll past beneath it.
- **Current step = the last card to cross the reading line**: on wide screens the reading line is at 55% of the viewport, on narrow screens a little below the stage; scroll events are coalesced into `requestAnimationFrame`, so it is computed at most once per frame.
- **The camera changes only two numbers**: the camera always looks from the same direction, and each step changes only "where to look" and "how far away", chasing the target with exponential interpolation so switching steps doesn't feel dizzying. Step 0 is the overview, where the scene is first "folded away" and then built up stop by stop.
- **Parts enter with springs**: each stop is a group of parts that pop up from the ground only when that step is reached (a spring with a little overshoot) and retract when you scroll back; skipping several steps at once still builds them in order. The dots along the road appear in order of their distance from the previous stop, and the little letter flies along the road to the current stop.
- **HTML labels attached to 3D points**: each frame the anchors are projected to canvas coordinates and ordinary HTML labels are placed there; a label is hidden when its point leaves the view, placed below if there is no room above, and slid inward when it touches the left or right edge. The text is selectable, readable by screen readers, and no text layout is needed in 3D.
- **Modeled in code**: the desk, envelope, mailbox, mail truck and houses are assembled from rounded boxes, cylinders and triangular prisms, so there are no model files to download; `MeshStandardMaterial` with roughness 0.72 plus soft shadows gives the clay look.
- **Power saving**: it renders only while something is moving and stops the loop when things stop; it also stops when out of the viewport. With reduced motion preferred, the camera and parts go straight to their positions.

## How to use it

1. Copy the `.story-body` structure and styles: on the left `.story-stage > .story-fig` (holding the canvas and the `.pins` label layer), on the right `<ol class="story-steps">`, with one `data-step` per step.
2. Replace the scene in `build()` with your own: make a `Group` for each step and put it into `pieces` (noting which step it belongs to), then give each stop an anchor `Object3D` for the labels.
3. Change the two arrays `FOCUS` / `DIST`: where the camera looks and how far away it is at each step. Step 0 pulls back for the overview.
4. Write labels in HTML: `<span class="label" data-pin="anchor name" data-step="step number">`; the script handles positioning and showing / hiding.
5. If the first screen must be fast, show a static image from the same camera position first, load three.js only after the user's first scroll or click, and fade the canvas in once loaded (the picture doesn't jump).

## Pitfalls

- Read layout (`getBoundingClientRect`) only in the frame right after scrolling; not at load time and not interleaved with style writes, otherwise it forces reflow and scrolling stutters.
- The canvas needs `touch-action: pan-y`, otherwise on phones a vertical swipe on the scene is eaten by the drag and the page can't scroll; dragging is used only to rotate a little left and right, and it rotates back to the front on release.
- Use a small fixed step for the spring integration (1/120 s here), so it doesn't fly off when frames drop.
- At different aspect ratios the overview gets cropped: pull the camera back by "reference aspect ratio ÷ actual aspect ratio".
- Without WebGL the stage shows a notice, and the text steps still tell the whole story; for real use it's best to have a static image as a fallback.
