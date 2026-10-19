---
title: "A Shape-Shifting Select: Genie / Tide / Pixel"
summary: "Three ways to open and close a select: genie (a macOS-style minimize into the name), tide (a foamy wave washes it up and away) or pixels."
category: button
origin: recreated
inspiredBy:
  name: "recent.design · Vibe selector"
  url: https://recent.design/i/maajesu-vibe-selector-microinteraction
stack: [html, css, svg, canvas, js]
tags: [select, genie effect, wave, pixel, motion, micro-interaction]
order: 5
files: [index.html]
demoHeight: 540
added: 2026-10-19
---

I saw an 8-second recording on recent.design (the author posted only the video, no code), went through it frame by frame with an agent and wrote the pixel version from scratch. A whole block crumbling into squares still felt plain, so two more followed: "genie", like minimizing a window on a Mac, and "tide", a wave that recedes upwards. Switch between them at the top of the demo; genie is the default.

## What makes it work

### Genie (default)

- **Thin strips**: the menu is cloned into strips about 3px tall (each a full clone showing only its band through `clip-path: inset()`), and each frame changes only their `transform`. The thinner the strips, the smoother the funnel's sides, with no visible steps.
- **Two overlapping motions**: during the first 45% the sides bend into a funnel whose neck sits under the middle of the name in the trigger; from 12% the strips slide up into it. Each strip is as wide as the funnel is at its **current height**, so it narrows on the way up and the text gets squeezed, which is what makes it feel like the Mac.
- **Funnel shape**: the width follows a `smoothstep` of the distance to the neck and is back to full width at 55% of the menu's height, so the menu holds its shape a little longer and the neck stays short and curved.
- **Into the name**: the menu is sucked into the name, which then changes: the old name slides up and blurs, the new one rises from below in the option's colour and fades to ink; the trigger swells a little (`scale: 1.045`) like a Dock icon taking in a window.
- **Opening = rewind**: the same function runs with time reversed, so the menu pours out of the name.

### Tide

- **The waterline is a `clip-path: polygon()`**: only the part of the menu above the wave shows. The wave is two sines of different frequency drifting in opposite directions, so it never looks mechanical. Its amplitude follows `sin(πp)`, flat at the start and the end.
- **Foam**: along the waterline runs a bright line in the option's colour, a band of colour fading downwards, and a few bubbles that ride under the crest, grow and pop (SVG circles whose stroke thins and fades). The SVG is clipped to the menu's rounded rectangle, so the water stays on the card.
- **Direction**: closing, the wave washes the menu away from the bottom up (slow, then faster, like water being pulled back); opening, it recedes downwards and uncovers the menu.

### Pixel (the original recreation)

- **Opening and closing are different**: opening, pixels pour down from the trigger behind a deep V-shaped front; closing, the menu turns into pixels of the new colour from the bottom up, the cloud passes behind the trigger, and the name crumbles and re-forms.
- **Real DOM + pixel mask**: the menu is a real `<ul role="listbox">`; while it animates, each frame paints which 5px cells show on a small canvas and applies it as `mask-image: url(dataURL)`. Cells flip in 4×4 Bayer order plus noise, so partial areas read as dither.

All three play over a real DOM menu: keyboard, screen readers and clicks work as usual; the animation is just a layer on top.

## How to use it

1. Copy the `.pick` rules from the `<style>` block and the first `<script>` (it exposes `window.pixelPick`).
2. Create one with `pixelPick.mount(element, { value, label, effect: "genie" | "tide" | "pixel", onChange })` and fill it with `setItems([{ id }])`; switch any time with `picker.effect = "tide"`. Colours live in the `VIBES` table at the top of the script.
3. The two name-change animations work on their own too: `pixelPick.rollText(element, text, colour)` (slide in) and `pixelPick.swapText(…)` (crumble and re-form).

## Pitfalls

- Genie clones the menu a few dozen times: with images, video or a long list inside it gets heavy, so use thicker strips (`H / 3` → `H / 6`) or pick tide. Strip the clones' `id`s and mark them `aria-hidden`, or the page gets duplicate ids and screen readers read the menu twice.
- Genie strips must overlap by half a pixel (`inset` minus 0.6px on each side), or hairline gaps open between them once they are scaled.
- `requestAnimationFrame` does not run in background tabs or hidden preview panes, so an animation can hang halfway: skip it when the page is `hidden` or under `prefers-reduced-motion`.
- A click during an animation: `restart()` first stops the old one and removes the clones / SVG / canvas and the `clip-path`, then starts the new one; otherwise ghosts are left behind.
