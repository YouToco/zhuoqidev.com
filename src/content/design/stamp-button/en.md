---
title: "Stamp Button"
summary: "Pressing feels like stamping: it presses down with a slight twist, then a grainy red imprint is left on the paper and slowly fades."
category: button
origin: original
stack: [html, css, js]
tags: [button, handmade, micro-interaction, spring]
order: 1
files: [index.html]
demoHeight: 420
added: 2026-10-19
---

## What makes it work

- **It presses down, it doesn't shrink**: on press, `translate: 0 3px` sinks it while the hard `0 3px 0` shadow underneath collapses to 0, so the whole stamp looks pressed onto the paper; adding `rotate: 1deg` makes it feel like a wrist turned it slightly.
- **Springs back**: on release it transitions with a spring curve written in `linear()` (`--spring`), overshooting a little before it stops, with no JS animation library. At the moment of press, `transition-duration` is cut to 0.06 s, which gives a snappy "thwack".
- **The stamp's edge**: `box-shadow: inset 0 0 0 2px` draws a thin light frame inside the button, like the border carved on a stamp face; the text uses a serif (Songti) with wide letter spacing.
- **The imprint left behind**: after a click, an `.imprint` with the same text is inserted below the button, with a bit of randomness in position and angle (±7°), and an SVG made from `feTurbulence` noise is used as a `mask`, so the ink is uneven; after fading out for 1.8 s it removes itself.
- **Three shapes**: solid (primary action), outlined (secondary action) and a round "Read" stamp, all the same class plus a modifier class.

## How to use it

1. Copy the `.stamp` CSS blocks and the `--spring` variable; replace the colors with your own accent color (`--seal`) and the text color on top of it (`--on-seal`).
2. For the imprint effect, also copy `.imprint`, `@keyframes ink` and the script at the bottom; the outer container needs `position: relative; overflow: hidden`, and the imprint lands on this "paper".
3. If you only want the button feel without the imprint: copy only the CSS, with not a line of JS.

## Pitfalls

- The noise image used for `mask` is a data URL generated at runtime and put into a CSS variable; writing it directly in the stylesheet also works, but `#` must be encoded as `%23`.
- `color-mix()` in `box-shadow` needs a browser from after 2023; in older browsers the whole shadow is ignored, and the button still works.
- The stamp button suits ceremonial actions like "confirm / submit"; don't make every button on the page like this.
