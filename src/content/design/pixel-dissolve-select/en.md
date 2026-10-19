---
title: "Pixel Dissolve Dropdown"
summary: "A pill dropdown: the menu pours out as pixels; on change it breaks into new-color pixels sucked behind the button, and the name reassembles."
category: button
origin: recreated
inspiredBy:
  name: "recent.design · Vibe selector"
  url: https://recent.design/i/maajesu-vibe-selector-microinteraction
stack: [html, css, canvas, js]
tags: [dropdown, pixel, dissolve animation, motion, micro-interaction]
order: 5
files: [index.html]
demoHeight: 460
added: 2026-10-19
---

A recreation written from scratch by me and an Agent after watching frame by frame an 8-second screen recording seen on recent.design (the author posted only the video, with no code).

## What makes it work

- **Opening and closing are two different animations** (seen frame by frame): when opening, pixels "pour" down from the button's lower edge, with a deep V-shaped leading edge in the darkest color that gradually fades to the card color behind it, and finally the real menu appears from top to bottom; when closing, the menu turns into new-color pixels from the bottom up, and the whole cluster passes upward behind the button and disappears.
- **Real DOM + pixel mask**: the menu is a real `<ul role="listbox">`, so keyboard and screen readers work as usual; during the animation, each frame draws on a small canvas which 5px cells should be revealed, converts it to `mask-image: url(dataURL)` and applies it over the menu.
- **Pixels sit in the middle layer**: the stacking order is menu (5) < pixel canvas (6) < button (7), so the pixels sucked back pass **behind** the button.
- **Dither order**: when each cell flips = 4×4 Bayer matrix × 0.35 + random number × 0.65, so partially revealed areas look like a regular dot pattern rather than a patch of noise.
- **Color follows the option**: each option has one color (with a separate set for dark mode), and the pixels use the color of the current or new option; the name in the button first breaks into ink dots and colored dots, then assembles the new name cell by cell.

## How to use it

1. Copy the rules starting with `.pick` in the `<style>` and the first `<script>` (it exposes `window.pixelPick`).
2. Create one with `pixelPick.mount(element, { value, label, onChange })`, then fill the options with `setItems([{ id }])`; colors are in the `VIBES` table at the top of the script.
3. To use the same "name shatters then reassembles" effect elsewhere, call `pixelPick.swapText(element, new text, color)` directly.

## Pitfalls

- `requestAnimationFrame` doesn't run in background tabs or hidden preview panes, so the animation hangs halfway: skip the animation directly when the page is `hidden` or under `prefers-reduced-motion`.
- Calling `toDataURL()` on a mask every frame isn't cheap, and frames drop when the menu is very tall (several hundred cells or more); 5px cells with around ten options is a comfortable scale.
- If it's clicked again while an animation is running: first call `restart()` to stop the old animation and clear the canvas and mask, then start the new one, otherwise afterimages are left behind.
