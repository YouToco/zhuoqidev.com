---
title: "One-Click Copy Button"
summary: "On success, two sheets fold away, a checkmark draws, and the text slides to \"已复制\"; on failure it turns red and shakes. Screen-reader aware."
category: button
origin: original
stack: [html, css, svg, js]
tags: [button, copy, code block, micro-interaction, spring]
order: 3
files: [index.html]
demoHeight: 420
added: 2026-10-19
---

## What makes it work

- **One SVG, two states**: the icon contains both the "two sheets" and the checkmark. The checkmark is one path, hidden at first with `stroke-dasharray: 16; stroke-dashoffset: 16`; on success the offset goes to 0, so it looks drawn in one stroke, while the two sheets fade out with `scale(.4)` at the same time.
- **Swap lines, not characters**: the label is two lines of text in a window one line tall (`height: 1em; overflow: hidden`), and on success the whole thing slides up with `translate: 0 -100%` using a spring curve, with a little bounce.
- **Failure has a look too**: when the clipboard is refused (not https, permission not granted) it turns red and shakes left and right twice, instead of nothing happening.
- **It copies textContent**: the full text can be copied even if the code block is collapsed or hidden; `innerText` returns an empty string for elements without layout.
- **Screen readers**: the result is written into an `aria-live="polite"` region, so people who can't see the screen also know whether the copy succeeded.

## How to use it

1. Copy the CSS for `.copy` and the button's HTML (bring the SVG part along as is).
2. The button can go anywhere: in a code block's title bar it looks for the `<pre>` in the same block; you can also write the content to copy directly with `data-copy-text` (for example an API key or a command).
3. Put an empty `aria-live` element on the page, and the script writes the result into it.

## Pitfalls

- `navigator.clipboard` is only available on https or localhost; a locally double-clicked `file://` page fails in some browsers, and the example then shows the failure look.
- When content must be fetched with `fetch` before copying, Safari requires writing to the clipboard synchronously at the moment of the click: use `new ClipboardItem({ "text/plain": promise })`, or fetch the content in advance.
- Rapid repeated clicks must replay the animation: first remove the class name, read `offsetWidth` once to trigger a reflow, then add it back.
