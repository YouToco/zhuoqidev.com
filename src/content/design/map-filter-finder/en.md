---
title: "Map + Filter Sidebar"
summary: "Filters on the left, a Leaflet map on the right: list and markers sync, clusters count only matches, list clicks fly to the map."
category: layout
origin: original
stack: [html, css, javascript, leaflet]
tags: [map, filter panel, marker clustering, list-map linking, tool page]
order: 160
files: [index.html, data.js]
demoHeight: 640
added: 2026-10-14
---

The demo data is 44 fictional cafés; names, locations and ratings are all made up. The base map is from OpenStreetMap.

## What makes it work

- **One state, one render**: type, rating, opening hours, amenities and search only change `state`, then `render()` computes both the list and the map markers with the same `pass()`, so the two always match.
- **Non-matching points are greyed out or hidden**: choose "grey out on the map" (keeps the sense of space, so you can see where other cafés are) or "hide from the map".
- **Clusters count only matches**: in the `iconCreateFunction` of `leaflet.markercluster`, only child markers that pass the filter are counted, so the number on a bubble equals the list count; clusters with no matches turn grey.
- **List ↔ map linking**: hovering a list row enlarges and outlines the matching marker (or the cluster containing it); clicking a list row uses `zoomToShowLayer` to expand the cluster and then opens the details; clicking a map marker scrolls the list to that row and highlights it.
- **Click the map to set a start point**: clicking anywhere places a "start" marker, sorting automatically switches to "nearest to start", and both the list and the popup show the distance (`map.distance`).
- **Dark map without a second tile set**: the tile layer gets `filter: invert(1) hue-rotate(180deg)` and reduced saturation; light mode is also slightly desaturated so the colored markers stand out.
- **Drawer on narrow screens**: below 760px the filter panel becomes a left drawer, and a "Filters · 29" button floats over the map, with the number following the results.

## How to use it

1. Include the CSS / JS of Leaflet and markercluster (`leaflet@1.9.4`, `leaflet.markercluster@1.5.3`), and copy the page structure and styles.
2. Replace `data.js` with your data; each item needs at least `id`, `name`, `lat`, `lng`. Change the categories and amenity names in `KINDS` and `FEATS`, and the filter rules in `pass()`.
3. Change the center and zoom in `setView`; `popupHtml()` decides what the details show.
4. If the data comes from an API, assign it to `cafes` once it arrives and call `render()` again.

## Pitfalls

- The example connects directly to `tile.openstreetmap.org`, which is only suitable for low-traffic demos. The OSM tile usage policy requires the "© OpenStreetMap contributors" attribution and forbids bulk downloading and offline caching; with more traffic, switch to a commercial tile service or host your own.
- Some map services in China use GCJ-02 coordinates while OSM uses WGS-84; mixing the two directly is off by hundreds of meters. Data and base map must use the same coordinate system.
- For `markerClusterGroup`, `clearLayers()` followed by `addLayers()` is much faster than adding and removing one by one; it doesn't matter for a few dozen points, but with thousands you must add in batches.
- When a marker is inside a cluster, `marker.getElement()` is `null`; for highlighting, first use `getVisibleParent()` to find the cluster that is actually displayed.
- A map inside a drawer or sidebar needs `map.invalidateSize()` after its container resizes; in this example the map area has a fixed size, so it isn't used.
