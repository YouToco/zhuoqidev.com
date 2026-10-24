---
title: "Signature-and-Seal Opening"
summary: "A first-visit opening: 卓琪 written in its real stroke order, a stone seal stamps it, and the print flies onto the logo, where the page opens."
category: motion
origin: original
stack: [html, css, js, svg]
tags: [intro animation, stroke order, seal, mask reveal, Web Animations]
order: 220
files: [index.html]
demoHeight: 560
added: 2026-10-24
---

The opening this site's homepage plays on a first visit (wide screens only, about 4.4 seconds). Everything in it belongs to the site: the name, the seal logo and its red. It ends on the real logo and opens the page from there, rather than lifting a curtain that has nothing to do with the page.

## What makes it work

- **Written in real stroke order**: every stroke of each character has an outline and a centre line (data from Make Me a Hanzi). The outline becomes a `clipPath`, a line 200 units thick runs along the centre line inside it, and `stroke-dashoffset` draws that line out, so the stroke appears the way a brush would make it. The 20 strokes of the two characters share 1.55 seconds by length, with 22 ms between strokes and an extra 120 ms between the characters.
- **Ink with a rough edge**: an `feTurbulence` + `feDisplacementMap` filter over the strokes pushes their edges about 3px, so they stop looking like clean vectors.
- **A stone seal, not a red square**: what comes down first is the top of the seal (pale stone, a small knob, a red lip of ink at the bottom), with a shadow that goes from soft to sharp. It lifts a little to gather itself, then presses.
- **The landing**: the paper dips 3px and springs back, a pressure ring spreads, seven ink spots spatter, and the red print appears.
- **Wet ink dries**: once the stone lifts, a diagonal `soft-light` shine sits on the print and fades within a second; the print itself has noise-made gaps and rough edges.
- **The print flies home before the reveal**: it travels along an arc onto the logo in the top bar (measured from the logo's real position; it lands within 2px), and only then does the page open from the logo, through a `mask: radial-gradient()` hole with a 70px soft edge and a thin red ripple riding that edge.
- **A slow push-in**: the whole scene scales up 3.5% while it plays, and stops before the print takes off, or the landing spot would drift.

## How to use it

1. The fonts (Long Cang, Caveat, Noto Serif SC 900) and the stroke data load from jsDelivr at pinned versions, so the demo holds only our own code. The stroke data is [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) (Arphic Public License); if you inline it in your own site, ship `ARPHICPL.TXT` with it. To write other characters, change `["卓", "琪"]`.
2. The timeline is all Web Animations (`el.animate()`); the comment at the top of the script lists when each step starts. Tick "slow ¼×" to follow it step by step, or add `?t=2800` to the URL to freeze it at that moment (up to 3100 ms).
3. On a real site, decide in an inline `<head>` script whether to play it (first visit, wide screen, no reduced-motion preference) and add a class to `<html>`. Keep the overlay `display: none` otherwise, so readers without JavaScript and crawlers get the page as is. Load the animation and the stroke data with `import()` only when it plays.
4. Any click, key, wheel or touch skips it at once.

## Pitfalls

- **Later animations need `fill: forwards`**: when an element already has one animation and you add another that starts later, `fill: both` makes the second one's waiting state override the first, and the first never shows.
- **Fly with the separate `translate` / `scale` properties**: the print has `rotate: -4deg`, and a translation written into `transform` follows the rotated axes, landing about 50px off over a 700px flight.
- **Start the soft-edged hole at a negative radius**: with `transparent var(--hole), #000 calc(var(--hole) + 70px)`, a radius of 0 already leaves 70px around the logo half see-through, so the page shows through from the first frame. Start `--hole` at `-70px`.
- **Hide a line before splitting it into letters**: otherwise it flashes whole for a moment before the letters fade in. Give the parent `visibility: hidden` and the split letters `visibility: visible`.
- Split strings with `Array.from(str)`, not `[...str]` (the site's ESLint rules flag it), and `trim()` first, or the template's line breaks and indentation become "letters" too.
