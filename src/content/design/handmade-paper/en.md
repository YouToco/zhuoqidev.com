---
title: "Handmade Paper Feel"
summary: "Cream paper with a dot grid; stamp red, pen blue, highlighter yellow; serif headings, notes, sticky notes, stamps, full dark mode."
category: style
origin: original
stack: [html, css]
tags: [handmade, paper feel, color palette, dark mode, design guidelines]
order: 200
files: [index.html]
demoHeight: 720
added: 2026-10-14
---

## What makes it work

- **A sheet of paper as the base**: cream `--paper` plus a dot grid at 22px spacing (one `radial-gradient` is enough); cards are a bit whiter than the paper, as if a card were stuck onto it.
- **Three pens**: pen blue (links, primary buttons, dashed borders), stamp red (numbering, annotations, stamps), and highlighter yellow (emphasis, heading underlines, sticky notes). Each color has one job, so the page doesn't get messy.
- **Four voices**: headings in a bold serif (Songti), body in the system sans-serif (line height 1.9), labels / dates in monospace, and the handwriting font only on large headings and annotations, so body text always stays readable.
- **The highlighter is a real highlighter**: short phrases use `.mark` with a gradient on the lower half; long headings use `text-decoration` with a thick underline pulled upward (`text-underline-offset: -.2em`), which also follows line wraps.
- **Small objects on the paper**: a sticky note tilted 3 degrees, translucent striped tape, a square seal with vertical text, a round stamp with an inner margin, and a tilted round stamp used as a callout icon.
- **Dark is a desk at night**: the background, ink and the three pens each have a night value (the demo shows both palettes side by side); "physical objects" such as sticky notes and the terminal mostly keep their original colors. The button in the top bar switches manually, and the choice is stored in `localStorage`.

## How to use it

1. Copy the `:root` variables and the two night-value blocks: `:root[data-theme="dark"]` and `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) … }`.
2. Copy the dot-grid line for the `body` background as it is; copy the components you need by class name: `.card` / `.tape` / `.sticky` / `.seal` / `.stamp-round` / `.chip-btn` / `.tag` / `.mark` / `.callout`.
3. For manual switching: put the inline script at the start of the demo in `<head>` (it restores the theme before the first frame, with no flash), and copy the button script at the bottom.
4. Swap fonts to suit your site: the demo uses only system fonts, with the handwriting face falling back to a Kai typeface. For a more handwritten feel, pick an open-source handwriting font yourself.

## Pitfalls

- The night values have to be written twice (one for the manual choice, one for following the system); miss one and you get "the system is dark, but manually switching to light still shows dark".
- A block-level pseudo-element like `.t-h2::before` inherits the heading's `text-decoration`, so the numbering also gets highlighted; changing it to `inline-block; width: 100%` avoids this.
- Highlighter yellow is glaring on a dark background; at night switch to dark gold (`#7d6416`), and also lower the semi-transparent yellow used for emphasis.
- Chinese handwriting fonts are huge (several MB); always subset to the characters the page actually uses. Without subsetting, the performance score on phones drops a lot.
- Sticky notes and the terminal keep the same colors in both modes, so the text color inside them must be hard-coded rather than using `--ink`, which changes with the theme.
