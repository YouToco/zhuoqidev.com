---
title: "Hand-Drawn Diagrams + Image Viewer"
summary: "Article flowcharts as hand-drawn SVG; click to open a viewer with wheel / pinch zoom, drag to pan, and Esc to close."
category: visual
origin: original
stack: [html, css, javascript, svg]
tags: [diagrams, hand-drawn, flowchart, image viewer]
order: 40
files: [index.html]
demoHeight: 640
added: 2026-10-14
---

## What makes it work

- **Hand-drawn look**: each stroke is drawn twice with a slight wobble, color fills are "scribbled" with diagonal hatching, and a handwriting font such as a Kai-style typeface is used, which feels much friendlier than a regular flowchart.
- **Just an image on the page**: the diagram is drawn at build time, and the article body contains only an `<img>`. No drawing library is loaded, and there is no "flash of code before it turns into a diagram".
- **The sheet doesn't follow the theme**: in dark mode the diagram is still drawn on light paper (`--sheet`), so line colors don't need a second set for dark.
- **Fits the window when opened**: when the viewer opens, it computes the width that "just fits the window" from the image's aspect ratio (CSS variable `--r`), then scales between 1x and 4x with `--s`.
- **Zoom stays put**: wheel, pinch and double-click all zoom around the cursor (or the midpoint of the two fingers); that point doesn't move on screen before and after zooming, so you don't have to search for your place when inspecting details.
- **Full controls**: − / + buttons, wheel (trackpad pinch also works), two-finger pinch, double-click toggle, keyboard `+ − 0` and arrow keys; drag to pan; Esc or a click outside the image closes it, and the release at the end of a drag won't close it by mistake.

## How to use it

1. Prepare the diagrams: write the diagram's text source in Mermaid, and at build time load `@excalidraw/mermaid-to-excalidraw` in a headless browser to convert it to Excalidraw elements, then export SVG with `exportToSvg` from `@excalidraw/excalidraw` (the exported SVG carries the handwriting font, containing only the glyphs used). Also save the scene as a `.excalidraw` file; to hand-edit, drag it into excalidraw.com, edit, and export again. The two diagrams in the example are static SVGs pre-drawn in the same style.
2. In the article, write each diagram as `<figure class="diagram"><img src="xxx.svg" width height alt></figure>`, with `width` / `height` set to the diagram's original size to avoid layout shift while loading.
3. Copy the `dialog.zoom` HTML, the related CSS and the script. The script automatically wraps `.diagram img` in a button, and clicking it opens the viewer.
4. To make ordinary photos clickable too, change the selector to the one matching images in your articles; for photos you can point the viewer at a larger image URL.

## Pitfalls

- The aspect ratio must be known before opening, otherwise "fit to window" can't be computed before a large image finishes loading; an SVG with `width` / `height` attributes has a `naturalWidth`.
- The stage needs `touch-action: none`, otherwise on phones a two-finger pinch zooms the whole page instead of this image.
- The browser still fires an extra `click` at the end of a drag, so record the release time and don't close the viewer on background clicks within 300ms.
- When converting Mermaid to Excalidraw, the handwriting font must be loaded before measuring text width, otherwise boxes are sized with the fallback font and text overflows the boxes.
- Chinese subgraph names make the converter unable to find the subgraph, so replace non-ASCII subgraph ids with English ones before converting.
