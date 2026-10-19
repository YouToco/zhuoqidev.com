---
title: "Editorial-Style Conclusion Report"
summary: "A conclusion-first magazine-style report: serif headline, one big card plus four small ones, Chart.js with clickable legends."
category: layout
origin: original
stack: [html, css, chart.js]
tags: [report, editorial, conclusion first, charts, comparison cards]
order: 150
files: [index.html]
demoHeight: 720
added: 2026-10-14
---

The brands, models and numbers in the demo are all made up, only to show the layout.

## What makes it work

- **Conclusion first**: the first block under the headline is the answer: one blue-bordered large card gives the most recommended option and a big number, and the four small cards beside it use the labels "most stable / for image quality / wait / drops fastest" to divide readers into groups; on wide screens the scatter chart sits beside it on the right, so the conclusion and its evidence are visible as soon as the page opens.
- **Editorial typography**: headings use system serif fonts (Songti / Noto Serif CJK), body text is sans-serif, and numbers are monospaced and aligned; sections are separated only by a thin line, with no big cards, so it reads like a ledger page. Keywords in headings get a half-height highlighter background drawn with `linear-gradient`.
- **Charts follow the theme**: all Chart.js colors are read from CSS variables, and charts are destroyed and rebuilt whenever `prefers-color-scheme` changes, so dark mode needs no second palette.
- **The 100% line on the scatter chart**: the grid line color is a function, and the line at `tick.value === 100` is darkened, so you can see at a glance which points "sold for more than the launch price"; a dashed overlay shows the average depreciation of previous years for comparison.
- **Floating bar chart**: horizontal bar data is written as `[low, high]`, and Chart.js draws it directly as a range bar, suitable for numbers like "estimated between 3 and 6".
- **HTML legend**: the legend is a row of `<button aria-pressed>`, and clicking toggles dataset visibility, working with keyboard and screen readers; the `<canvas>` contains a text description, so there is content even if the script fails to load.
- **Wide tables don't break the page**: each table is wrapped in an `overflow-x: auto` box, and `section` uses a `minmax(0, 1fr)` column, so even at 375px wide there is no page-wide horizontal scrolling.

## How to use it

1. Copy the variables and layout part of the `<style>`, replace `--s1`–`--s4` with your series colors, and replace `--f-display` with the serif font stack you want.
2. Fill in content in the order "conclusion first → background → detail table → estimates → patterns → sources"; add `class="est"` to estimated numbers to grey them.
3. Include Chart.js (`chart.js@4.5.1/dist/chart.umd.min.js`) and replace the three data sets `retention` / `timeline` / `loss` in the script with your own; the legend `<ul class="legend" data-chart="canvas id">` is generated automatically.
4. Chart height is determined by the outer `.chart` container (`maintainAspectRatio: false`); to change the height, change the CSS, not the canvas.

## Pitfalls

- Chart.js doesn't understand `var(--x)`; you must first read the concrete color with `getComputedStyle` and pass it in, so switching between light and dark requires rebuilding the charts, and just changing CSS has no effect.
- The `.chart` container must have `position: relative` and an explicit height, otherwise in `responsive` mode the canvas keeps growing taller.
- Grid children have `min-width: auto` by default, so a canvas or wide table inside stretches the whole column; write the column as `minmax(0, 1fr)`.
- When the system has no Chinese serif font (some Android devices, Windows), headings fall back to a sans-serif; for a consistent look, self-host a commercially usable serif font.
