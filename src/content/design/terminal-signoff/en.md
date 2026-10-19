---
title: "Opening / Sign-off Terminal"
summary: "The footer is a terminal session: see you, contact info, fortune and exit are typed out line by line; plus a first-visit boot animation."
category: motion
origin: original
stack: [html, css, js]
tags: [terminal, footer, typewriter, intro animation]
order: 30
files: [index.html]
demoHeight: 640
added: 2026-10-14
---

## What makes it work

- **The footer as a farewell**: every page ends with the same shell session: `echo "see you"` → `cat contact.md` (contact info) → `fortune` (a single line) → `exit`, and the last line `[Process completed]` is marked in highlighter yellow.
- **A laptop**: the terminal is the screen (a 10px dark border serves as the screen bezel), below it a light-colored body drawn with `::after`, with a radial-gradient "lid notch" in the middle. The body is 7% wider than the screen, and `overflow-x: clip` keeps it from causing horizontal scrolling on phones.
- **The typewriter is CSS**: command lines use `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)` with `steps(character count)`, revealing one character at a time; output lines fade in while moving up. JS does just one thing: compute each line's start time `--d` and character count `--n`.
- **Plays when first scrolled to**: an `IntersectionObserver` adds `.play` only once 30% of the footer enters the viewport, and the laptop "opens its lid" at the same time (`rotateX` around the bottom edge).
- **Intro animation**: the same line animations first type out `whoami` / `ls` / `open`, and when the progress bar fills, the whole block scales up 7x and fades out, like the camera passing through the screen into the page; any click, key press or wheel skips it.
- **Scanlines**: a translucent horizontal stripe layer at 1px spacing covers the terminal like an old monitor; barely noticeable but adds flavor.

## How to use it

1. Copy the CSS blocks `.laptop`, `.terminal`, `.tty`, `.ln` and the three `@keyframes` (`ln-in`, `ln-type`, `lid-open`).
2. Write each line as `<p class="ln cmd">` (command) or `<p class="ln o">` (output); use `.gap` for an extra blank space.
3. Copy the `cue()` and `IntersectionObserver` script. For a more restrained version: if the page is short enough that the footer is visible as soon as it opens, simply don't play and show the finished state directly.
4. Play the intro animation only on the homepage, on the first visit, on wide screens: decide with an inline script in `<head>` (reading a `localStorage` flag) and add a class to `<html>`, so the body text doesn't flash first; also add a fallback timer of a few seconds so the overlay is removed automatically even if the main script never runs.

## Pitfalls

- Command lines must have `width: fit-content`, otherwise `clip-path` cuts by the full line width and the typing speed doesn't match the character count.
- Count characters from the text after collapsing whitespace (`textContent.replace(/\s+/g, " ")`); once a formatter puts tags on separate lines, the raw `textContent` contains a lot of extra spaces.
- Hide unplayed lines with "hidden only when JS adds `.armed`", not with a default `opacity: 0`: this way people without JS, or with "reduce motion" on, can see the full content directly.
- Attach the intro's skip listeners only after the button click (defer one tick with `setTimeout`), otherwise the very click that triggered it skips it immediately.
- The `::after` scanline layer covers the whole terminal and must have `pointer-events: none`, otherwise links in the terminal can't be clicked.
