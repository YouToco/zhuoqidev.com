---
title: "Dot-Matrix Visitor Globe"
summary: "A three.js dot globe: visitor counts as red beams, blue arcs with moving sparks to one destination; drag it, click a beam for the number."
category: visual
origin: original
stack: [html, css, three.js]
tags: [3D, globe, data visualization, map]
order: 130
files: [index.html, geo.js, build-land.mjs]
demoHeight: 640
added: 2026-10-14
---

## What makes it work

- **Dotted land**: 52,000 points are scattered evenly over the sphere along a Fibonacci spiral, and only those that land on land are kept (about 15,000), all drawn at once by one `Points`. The land data is a 0.5° bitmap that only says "where is land"; no borders are drawn.
- **Dots fade toward the edge**: the point shader computes whether each point faces the camera, and the closer to the sphere's edge, the more transparent it gets, so the globe looks volumetric; back-side points are hidden by a slightly smaller opaque sphere.
- **Beams**: all countries share one `InstancedMesh`; each beam is the same unit cylinder, placed by the country's position, orientation and height. Height is the square root of the visitor count so small countries are still visible; beams grow out of the ground.
- **Arcs + flowing sparks**: each arc is a quadratic Bézier tube whose control point sits above the great-circle midpoint, so farther routes arch higher. All arcs are merged into one geometry, and the sparks are computed in the fragment shader from `t` and time, with no per-frame vertex updates.
- **Follows the theme**: colors are all read from CSS variables and re-read when switching between light and dark; on a light background the arcs use normal blending (additive light is invisible on paper color).
- **Power saving**: the render loop stops when the globe is out of the viewport and nothing is moving; with reduced motion preferred, there is no auto-rotation, no flow, and beams go straight to full height.

## How to use it

1. Copy the `.stage` structure, styles and `<script type="module">` from `index.html`, and put `geo.js` in the same directory (loaded with a plain `<script>`, so it also opens from `file://`).
2. Replace the example `VISITORS` (two-letter ISO country code → visitor count) with real numbers from your analytics, and set `HOME` to the latitude and longitude of the city the arcs fly to.
3. For finer or coarser land: download the land GeoJSON from Natural Earth, run `node build-land.mjs ne_50m_land.geojson`, and paste the output into `land` in `geo.js`.
4. If the first screen matters a lot, wait for the user's first scroll or mouse move before you `import` three.js and build the globe, and show a static image first.

## Pitfalls

- The geographic data comes from Natural Earth (public domain): the land bitmap is generated from the 1:50m land polygons, and the country points are the label points (`LABEL_X / LABEL_Y`) of the 1:50m countries layer. Borders are deliberately not drawn, so the map takes no position on border disputes.
- `AdditiveBlending` is almost invisible on a light background, so the blending mode must switch with the theme, and `needsUpdate` must be set to `true`.
- Countries closer than 4° to the destination get no arc, otherwise the arc shrinks to a point and also pokes into the ground.
- On phones the canvas needs `touch-action: pan-y`, otherwise vertical swipes are eaten by the globe and the page can't scroll.
- Don't pop up a tooltip while dragging; distinguish "a tap" from "a drag" (here a movement under 6px counts as a click).
