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
  2. the dot **backs out of the text to the left and arcs over through the empty gutter**: it moves sideways faster than it moves down (60% of the way back while only 30% of the way down), overshoots 2px further left than its resting place and creeps back against the text's edge; vertically it is slow off the mark, fast in the middle, with a long settle, and longer trips take longer (one row ≈ 0.2 s, five rows ≈ 0.25 s). Each axis runs its own frame-by-frame curve (Web Animations keyframes), which together trace a curve bowing to the left;
  3. on landing it squashes for a frame (1.25 × 0.8), rests 2–3 frames, then nudges 10px right (4 frames);
  4. a frame later the text gives way and slides 22px right: 80% in the first tenth of a second, then it coasts;
  5. one frame later the colour sweeps across left to right: a rush, a stall around three quarters, a slow finish (0.2 s).
- **The sweep is pure CSS**: the text's background is a gradient, left half group colour and right half the current colour, 200% wide, clipped to the glyphs with `background-clip: text`; activating slides `background-position` from 100% to 0%. The right half is `currentColor`, so it is dark on hover and grey at rest without a second rule.
- **A colour per group**: typography blue, colour pink, layout orange, motion purple; the group icon, the dot, the active text and the heading on the right all read one variable, `--c`.
- **Scroll fades**: both ends of the list fade out with `mask: linear-gradient(transparent, #000 36px, … )`, which says "there is more" without a divider.

## How to use it

1. Copy the two curves in `:root` (`--shove`, `--sweep`), the three keyframe sets in the script (`Y_LONG`, `Y_SHORT`, `X_BACK`), the CSS for `.item`, `.item .t` and `.dot`, and `activate()` from the script; give each group a `--c`.
2. Put the dot inside the list container (`position: relative`) and place it from the item's `offsetTop`: that is layout-relative, so scrolling the list never moves it off, and it is only read on click, so nothing touches layout while the page loads.
3. Items are real links: Tab reaches them and the up / down arrow keys move between them; the current one carries `aria-current`, which the styles hang on too.

## Pitfalls

- `background-clip: text` needs `-webkit-text-fill-color: transparent`; `color: transparent` alone fails in Safari.
- The text's shift and sweep must **wait for the bump**: `aria-current` (meaning) is set on click, but `.lit` (shoved and coloured) only about 0.1 s after the dot has landed and nudged; otherwise everything happens at once and the dot no longer reads as pushing the text aside.
- Don't approximate the speed with `ease`: measure positions frame by frame on the recording and write them as `linear(0, 0.065 9%, 0.13 18%, …)`, closer than any cubic Bézier. To check it, note that Playwright's fake clock can't drive CSS transitions: pause them via `document.getAnimations()` and set `currentTime` by hand before reading values.
- Rapid clicks: clear the previous round's pending timers, then `commitStyles()` the dot's animations into its inline style and `cancel()` them, so the next move starts where it is. **Commit the finished ones held by `fill: forwards` too**: committing only running animations makes the dot jump back to an old position. But **drop the landing squash, never commit it**: a click during those few dozen milliseconds would freeze the dot flat for good (it happened on the live page).
- Don't place the dot with `getBoundingClientRect()`: it changes as the list scrolls and the dot drifts off; `offsetTop` doesn't.
- Under `prefers-reduced-motion` every transition is off and the dot and colour jump straight into place.
