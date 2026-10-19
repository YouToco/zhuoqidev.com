---
title: "Three Status Icons Morph into One"
summary: "Bars sink to dots, the battery becomes a line that wraps the Wi-Fi in a ring, and the dots slip into its gap. Timed frame by frame."
category: motion
origin: recreated
inspiredBy:
  name: "recent.design · 3-in-1 Icon Morph（Apple）"
  url: https://recent.design/i/t36wysw-3-in-1-icon-morph
stack: [html, svg, js]
tags: [icon, morph, path animation, status bar, frame-accurate]
order: 31
files: [index.html]
demoHeight: 560
added: 2026-10-20
---

A 3.3-second recording on recent.design (an Apple design, video only): the signal, Wi-Fi and battery icons from a status bar merge into one Wi-Fi icon inside a ring. With an agent I pulled all 188 frames out with ffmpeg, measured every part on every frame with connected-component analysis, then rendered the recreation in the video's own framing and diffed it against the recording pixel by pixel, until the average difference matched the anti-aliasing noise of a still frame (about 5%; the worst frame 9%).

## What makes it work

Times count from the moment the first thing moves (the recording holds still for about a second first); the whole move takes 2.3 s.

- **The battery takes in its cap, then its body** (0–0.53 s): the little bump on the right slides left into the battery first (out of sight by 0.07 s), then the left edge stays put while the right edge pulls in, as if being rolled up. The corner radius is always `min(66, width/2)`, so halfway it turns into a pill on its own, and it ends as a vertical line 34 px thick and 180 px long.
- **The signal bars sink as if under a descending ceiling** (0.07–0.70 s): the rightmost bar goes first, its top following a slow-fast-slow curve. Each bar to its left follows the same curve about 66 ms later and **only starts once the ceiling reaches its own top**, so shorter bars start later (0.07 / 0.20 / 0.33 / 0.47 s). All of them stop as 46 px dots; the bottoms never move.
- **The line is a snake crawling along a path** (from 0.63 s): it drops straight down, takes a U-turn at the bottom right (0.77 s), spirals anticlockwise up and in, and at 0.97 s joins the final circle (radius 216.5) at the top. Along the way its length stays at 146 px; it starts slow, is fastest around 0.8 s, and eases a little as it joins the circle.
- **Once on the circle, head and tail part ways** (1.13–2.03 s): the tail keeps slowing smoothly while the head suddenly speeds up (fastest around 1.27 s, about four times the tail), so the arc stretches from 37° to 240° in one go, 90% of it in 0.5 s, then settles. Counting from the start, the head goes round about one and a half times; the arc ends at 120° and 240° (clockwise from 12 o'clock), the gap facing down.
- **The Wi-Fi makes room** (0.67–1.23 s): it only moves and scales, 33 px to the right and down to 82%, landing exactly on the centre of the final circle.
- **The four dots chase into the gap** (1.07–2.23 s): starting with the rightmost, one every ~65 ms, they swing round a wide curve outside the circle (up to ~340 px from its centre) to land below it at 150°, 170°, 190° and 210° (20° apart). They overshoot about 25 px upward first (1.9 s), then sink back into place.
- **The circle is a little bigger while it forms**: in the 0.3 s the line wraps round, its radius is 1–5 px larger than at the end and its centre slightly low; it settles by 1.4 s. Without this, overlaying the original leaves a thin rim.

## How to use it

1. The whole picture is one SVG in the recording's own pixels, origin at the final circle's centre, so the numbers in the tables are usable as they are; the `viewBox` scales it.
2. The motion is not CSS keyframes but seven time tables (`BODY`, `NUB`, `BARS`, `WIFI`, `LINE`, `DOTS`, `RING`) plus one path (`LOOP`), one row per moment. `draw(t)` interpolates linearly between rows and draws the whole frame. To change the speed, scale the time; to play it backwards, run `t` down.
3. The line is stored as arc length along the path: `LINE` only holds where its tail and head are, and `strokeAlong()` takes a point every 6 px and joins them, with `stroke-linecap: round`. The first part of the path is the measured polyline; past 20° it is the circle.
4. The page has slow motion (¼×) and a timeline to step through it; `?t=1234` holds one moment, handy for screenshots next to the original.

## Pitfalls

- **The capture is 30 fps but the file is 57 fps**: each new picture shows for two frames or one. Timing by frame number puts the recreation half a frame ahead, so in an overlay the line and dots always lead. Find the frames where the picture actually changes and re-time them 33.3 ms apart.
- **Don't fit it with `ease`**: every part has its own speed curve (the battery fast then slow, the line speeding up then slowing, the ring's head speeding up while its tail slows). No cubic Bézier gets there; tables measured frame by frame do.
- **Don't trust small wobbles in a measured centre line**: on the straight drop, the centre line measured from pixels wobbles by ±5 px, and drawing it as is puts a step in the line. A hand-drawn smooth curve here (easing 6 px right, then bending into the U-turn) matches the original better.
- **Don't fit a circle to a short arc**: an arc of a few tens of degrees fits to a small circle (the stroke's thickness reads as curvature). Below half a turn measure the radius as the mean distance from a fixed centre; past half a turn, fit the centre too.
- **Hide the battery cap**: after it slides in, the body keeps shrinking, and once the body is narrower the cap pokes out on the right again. Stop drawing it once it is in.
- With `prefers-reduced-motion` it does not play: a click jumps straight to the merged (or the apart) state.
