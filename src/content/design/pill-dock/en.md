---
title: "Floating Pill Nav at the Bottom"
summary: "A pill-shaped nav centered at the page bottom: frosted glass, highlighted current section, bounce on press, twinkling stars."
category: navigation
origin: original
stack: [html, css]
tags: [navigation, pill, handmade, frosted glass]
order: 10
files: [index.html]
demoHeight: 360
added: 2026-10-14
---

## What makes it work

- **Position**: `position: fixed` + `left: 50%` + `translateX(-50%)`, always stuck at the bottom center, within thumb reach on phones.
- **Frosted glass**: the background is `color-mix(in srgb, var(--card) 82%, transparent)` plus `backdrop-filter: blur(16px)`, so it stays readable over content.
- **Bounce**: `scale: .93` on press, and on release it springs back with a spring curve written in `linear()`, with no JS animation library.
- **Numbering**: a small monospace number (01–04) before each item gives the row of text some rhythm.

## How to use it

1. Copy the `.dock` and `.stars` CSS blocks into your stylesheet and swap the color variables for your own.
2. Add `aria-current="page"` to the link for the current page (set on the server or in the router); both the highlight and screen readers rely on it.
3. Leave `padding-bottom` at the bottom of the page so the last section isn't covered by the nav.

## Pitfalls

- `backdrop-filter` needs the `-webkit-` prefix in Safari.
- In older browsers that don't support `linear()` spring curves, the transition falls back to linear, which doesn't affect usability.
