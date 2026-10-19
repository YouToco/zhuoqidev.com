---
title: "Pure CSS Motion"
summary: "No animation library: linear() spring easing, View Transitions, scroll-driven animation, @starting-style entrances, height to auto."
category: motion
origin: original
stack: [html, css]
tags: [motion, spring, page transitions, scroll-driven, zero-dependency]
order: 210
files: [index.html]
demoHeight: 720
added: 2026-10-14
---

## What makes it work

- **Springs written as easing curves**: a damped spring is sampled into 31 points and put into `linear()`, giving an easing that overshoots and settles back. Two are enough: `--spring` (damping 0.5, about 16% overshoot) for press / drag / drop, and `--spring-soft` (about 8%) for windows and pages. The curve chart in the demo is drawn by reading these two CSS variables directly.
- **Page transitions**: `@view-transition { navigation: auto; }` is one line that gives same-site navigation a transition. The old page moves up and fades out, the new page settles in with the soft spring, and the clicked title flies into the next page's large heading through the same `view-transition-name`.
- **Scroll-driven**: the reading progress bar is `animation-timeline: scroll()`, and card entrances are `animation-timeline: view()` with `animation-range: entry 0% entry 75%`. There is no scroll listener at all.
- **First-frame entrance**: `@starting-style` describes how an element looks when first rendered. A toast newly inserted into the DOM transitions from that state, with no keyframes and no "wait a frame, then add a class".
- **Height to auto**: with `interpolate-size: allow-keywords` on the root, `height: 0 ↔ auto` can be transitioned, and it works with springs too.
- **Every piece degrades**: browsers that don't support a feature simply show the final state. The small badge at the top right of the demo tells you which features the current browser supports.

## How to use it

1. Copy the two variables `--spring` and `--spring-soft` from `:root`. For a button, write `transition: scale .45s var(--spring)` and `:active { scale: .93 }`.
2. For page transitions on a multi-page site, add `@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }` to your global CSS, and give the top bar and bottom nav each a fixed `view-transition-name` so they stay in place during navigation.
3. To make a title "fly" across: give the clicked title on the list page and the large heading on the detail page the same `view-transition-name` (only one element on a page may have that name at any moment), then copy the `::view-transition-group(vt-title)` blocks.
4. The scroll-driven rules are wrapped in `@supports (animation-timeline: view())` and `prefers-reduced-motion: no-preference`; copy the longhand property style used in the demo.

## Pitfalls

- The demo is a single page, so a cross-document `@view-transition` can't run in it. It uses the same-document `document.startViewTransition()` instead, with exactly the same effect as the pseudo-element approach. A real multi-page site uses `@view-transition` and does not need that JS.
- The `animation` shorthand resets `animation-timeline` to `auto`, so `animation-timeline` must come after the shorthand. A subtler issue: some CSS minifiers recombine several longhands into a shorthand the browser doesn't recognize, and the effect silently disappears, so check the build output.
- `view-transition-name` must be unique at any moment: if every list item hard-codes the same name, the transition is skipped outright. Set the name only on the clicked item, at click time.
- A `linear()` spring is only a "time → progress" curve and knows nothing about velocity: however fast you flick on release while dragging, the bounce-back follows the same curve. Real physics needs JS.
- "Reduce motion" has to be handled separately for the transition pseudo-elements: the universal selector `*` doesn't reach `::view-transition-*`.
