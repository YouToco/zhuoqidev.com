---
title: "Flat People Crowd"
summary: "A huge light-weight headline on grass green over flat-drawn people jumping arm in arm; scroll and they tumble apart as a cream sheet rises."
category: style
origin: recreated
inspiredBy:
  name: "MindMarket (Louis Paquet, Awwwards Site of the Month Dec 2025)"
  url: https://mindmarket.com/
stack: [html, css, svg, js]
tags: [flat illustration, people, scroll-driven, rounded cards, grass green]
order: 203
files: [index.html]
demoHeight: 760
added: 2026-10-20
---

Rebuilt after the MindMarket home page. The idea is that a research firm selling "real human insights" puts real humans in its hero: a crowd of flat-illustrated people jumping together, each with different skin, hair and clothes, so you know at a glance this company works with people. The people in the demo are drawn from scratch in SVG; none of the original illustrations is used.

## What makes it work

- **A big headline that isn't bold**: the two-line headline is set huge and tight in a medium weight, which reads friendly on grass green rather than shouty.
- **A crowd is the key visual**: four flat people link arms, built from simple shapes: round heads, thick round-capped limbs, flat clothes, and faces made of closed smiling eyes and a mouth. Each bounces to their own beat (different `animation-duration`s), one waves, confetti floats.
- **Scrolling scatters the crowd**: a `view-timeline` drives `--s`, and the four people tumble off in different directions while a cream sheet with 56px corners rises from below to cover them.
- **A paper plane flies a dotted line**: the plane follows a dotted path with `offset-path`, its progress tied to scrolling, and `offset-rotate: auto` keeps it facing the way it flies.
- **White rounded cards and one scribble**: content sits on big rounded white cards, one corner has a thick yellow squiggle, and buttons are coral blocks with a white circle in front.

## How to use it

1. Copy the colors in `:root` and the `.hero` / `.sheet` layers; the sheet overlaps the hero with a negative `margin-top` and big corners.
2. Each person is a `<g class="who">` around a `<g class="bob">`: the outer group handles the scroll scatter (`--tx` / `--ty` / `--tr`), the inner one the bounce (`--b` sets the beat).
3. To draw other people, change the shapes: a circle for the head, one path for the hair, limbs as thick lines with `stroke-linecap: round`.

## Pitfalls

- Rotating or moving a `<g>` in SVG needs `transform-box: fill-box`, or it pivots on the top-left corner of the whole drawing.
- The two layers use different properties (`translate` / `rotate` outside, `transform` inside), so the scroll scatter and the bounce stack instead of overwriting each other.
- `offset-path` coordinates are pixels, so on narrow screens the path runs off the edge; give the parent `overflow: clip`, or the page scrolls sideways.
- Make the crowd visibly diverse without drawing stereotypes; keep faces to a few arcs, since the simpler they are, the less can go wrong.
