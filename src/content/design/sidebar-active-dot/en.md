---
title: "A Sidebar Whose Active Dot Slides"
summary: "One dot for the whole list: it slides to the picked item in its group's colour, the text steps aside and the colour sweeps in."
category: navigation
origin: recreated
inspiredBy:
  name: "recent.design · Sidebar Active State（Gustavo）"
  url: https://recent.design/i/9e89xf0-design-guidelines-app-ui
stack: [html, css, js]
tags: [navigation, sidebar, active state, micro-interaction, scroll fades]
order: 11
files: [index.html]
demoHeight: 620
added: 2026-10-20
---

A recreation of a recording of Gustavo's design-guidelines app on recent.design (video only, no public code). With an agent I pulled a frame every 70 ms and broke the active state into four steps. The list items are my own take on the same kind of design topics.

## What makes it work

- **There is only one dot**: not a dot per item shown and hidden, but one absolutely positioned dot for the whole list. Pick another item and it slides there from the previous one (across groups too), stretched a little on the way (`scale: 0.7 1.35`), round again when it lands, in the new group's colour. The eye can follow it: it was there, now it is here.
- **Four steps, in order**: ① on hover the text goes from grey to dark; ② on click the dot moves first (0.2 s); ③ as it arrives the text steps 15px to the right (0.1 s delay); ④ the text colour sweeps left to right into the group's colour (0.14 s delay, done in 0.26 s). The previous item goes grey and back into place at the same time.
- **The sweep is pure CSS**: the text's background is a gradient, left half group colour and right half the current colour, 200% wide, clipped to the glyphs with `background-clip: text`; activating slides `background-position` from 100% to 0%. The right half is `currentColor`, so it is dark on hover and grey at rest without a second rule.
- **A colour per group**: typography blue, colour pink, layout orange, motion purple; the group icon, the dot, the active text and the heading on the right all read one variable, `--c`.
- **Scroll fades**: both ends of the list fade out with `mask: linear-gradient(transparent, #000 36px, … )`, which says "there is more" without a divider.

## How to use it

1. Copy the CSS for `.item`, `.item .t` and `.dot`, and `activate()` from the script; give each group a `--c`.
2. Put the dot inside the list container (`position: relative`) and place it from the item's `offsetTop`: that is layout-relative, so scrolling the list never moves it off, and it is only read on click, so nothing touches layout while the page loads.
3. Items are real links: Tab reaches them and the up / down arrow keys move between them; the current one carries `aria-current`, which the styles hang on too.

## Pitfalls

- `background-clip: text` needs `-webkit-text-fill-color: transparent`; `color: transparent` alone fails in Safari.
- The text's shift and sweep must **wait for the dot**: both start 0.1–0.14 s after it, otherwise all three happen at once and the dot no longer reads as having brought the selection.
- Don't place the dot with `getBoundingClientRect()`: it changes as the list scrolls and the dot drifts off; `offsetTop` doesn't.
- Under `prefers-reduced-motion` every transition is off and the dot and colour jump straight into place.
