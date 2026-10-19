---
title: "A Sidebar Whose Active Dot Slides"
summary: "One dot for the whole list slides to the picked item, bumps its text aside, then the colour sweeps in; speeds measured on the reference."
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

- **There is only one dot**: not a dot per item shown and hidden, but one absolutely positioned dot for the whole list. Pick another item and it slides there from the previous one (across groups too), switching to the new group's colour halfway. The eye can follow it: it was there, now it is here.
- **Five steps, in order, none at a constant speed** (measured frame by frame on the 60 fps reference and written as CSS `linear()` curves):
  1. on click the previous item goes grey and slides home at once;
  2. the dot travels: slow off the mark, fast in the middle, a long settle, taking longer for longer trips (one row ≈ 0.16 s, five rows ≈ 0.2 s), drifting sideways back to rest against the text's edge on the way;
  3. on landing it nudges 7px right (0.08 s);
  4. about 0.1 s later the text gives way and slides 22px right: 80% in the first tenth of a second, then it coasts;
  5. one frame later the colour sweeps across left to right: a rush, a stall around three quarters, a slow finish (0.2 s).
- **The sweep is pure CSS**: the text's background is a gradient, left half group colour and right half the current colour, 200% wide, clipped to the glyphs with `background-clip: text`; activating slides `background-position` from 100% to 0%. The right half is `currentColor`, so it is dark on hover and grey at rest without a second rule.
- **A colour per group**: typography blue, colour pink, layout orange, motion purple; the group icon, the dot, the active text and the heading on the right all read one variable, `--c`.
- **Scroll fades**: both ends of the list fade out with `mask: linear-gradient(transparent, #000 36px, … )`, which says "there is more" without a divider.

## How to use it

1. Copy the three curves in `:root` (`--travel`, `--shove`, `--sweep`), the CSS for `.item`, `.item .t` and `.dot`, and `activate()` from the script; give each group a `--c`.
2. Put the dot inside the list container (`position: relative`) and place it from the item's `offsetTop`: that is layout-relative, so scrolling the list never moves it off, and it is only read on click, so nothing touches layout while the page loads.
3. Items are real links: Tab reaches them and the up / down arrow keys move between them; the current one carries `aria-current`, which the styles hang on too.

## Pitfalls

- `background-clip: text` needs `-webkit-text-fill-color: transparent`; `color: transparent` alone fails in Safari.
- The text's shift and sweep must **wait for the bump**: `aria-current` (meaning) is set on click, but `.lit` (shoved and coloured) only about 0.1 s after the dot has landed and nudged; otherwise everything happens at once and the dot no longer reads as pushing the text aside.
- Don't approximate the speed with `ease`: measure positions frame by frame on the recording and write them as `linear(0, 0.065 9%, 0.13 18%, …)`, closer than any cubic Bézier. To check it, note that Playwright's fake clock can't drive CSS transitions: pause them via `document.getAnimations()` and set `currentTime` by hand before reading values.
- Rapid clicks: clear the previous round's pending timers first; CSS transitions retarget from where they are, so nothing jumps.
- Don't place the dot with `getBoundingClientRect()`: it changes as the list scrolls and the dot drifts off; `offsetTop` doesn't.
- Under `prefers-reduced-motion` every transition is off and the dot and colour jump straight into place.
