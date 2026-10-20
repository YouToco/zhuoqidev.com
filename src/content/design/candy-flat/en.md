---
title: "Candy Flat"
summary: "Periwinkle and clashing candy colors, morphing blobs, a mascot whose eyes follow you, a springy card stack, sticker-shadow buttons."
category: style
origin: recreated
inspiredBy:
  name: "MindMarket (Louis Paquet, Awwwards Site of the Month Dec 2025)"
  url: https://www.awwwards.com/sites/mindmarket
stack: [html, css, js]
tags: [flat illustration, clashing colors, blob shapes, spring, mascot, award-winning style]
order: 204
files: [index.html]
demoHeight: 760
added: 2026-10-20
---

Rebuilt after the palette and feel of MindMarket (flat illustration with Rive animation) and Ponpon Mania (an interactive comic, Site of the Month Oct 2025). The illustrations are replaced with plain CSS shapes.

## What makes it work

- **Saturated, clashing colors**: periwinkle `#7E7EFF` as the base with pink, grass green and lemon yellow. None of them harmonize, which is what makes it lively.
- **No right angles**: the background blobs are irregular shapes drawn with an eight-value `border-radius`. The `@keyframes` only change the radii and add a little rotation, so they breathe slowly.
- **Hard shadows like stickers**: buttons, cards and swatches all sit on an unblurred dark shadow (`0 5px 0`). A pressed button moves down 5px and the shadow goes to zero, like pressing a sticker flat.
- **A card stack that springs**: three cards overlap, each tilted a little. Click and they fan out with a spring, click again and they close. The stack is one `<button aria-expanded>`, so it works from the keyboard too.
- **A mascot that looks at you**: a blob with two eyes whose pupils move toward the pointer, at most 30% of the eye's width.

## How to use it

1. Copy the colors and `--spring` from `:root`. With `.blob` and `@keyframes morph` you can put blobs behind any section.
2. Copy `.btn` for the buttons (lift on hover, flatten on press). For the stack copy `.stack` and `.card` with its three `nth-child` positions; the open positions live under `[aria-expanded="true"]`.
3. Rounded type: the demo uses `ui-rounded` (SF Rounded on Apple devices) and falls back to Arial Rounded or the system sans elsewhere. There is no built-in rounded Chinese font, so for that self-host an open-source one and subset it.

## Pitfalls

- The blobs are decoration: give them `z-index: -1` and the parent `isolation: isolate`, or they cover the text or vanish behind the page background.
- Dark mode can't just darken the base: pink and yellow glow on deep purple, so lower the saturation across the board (the demo has its own set of values).
- Text color must follow the card. The yellow and pink cards stay light in both modes, so their text is hard-coded dark; only the white card turns deep purple in dark mode, so only it uses the theme-following color.
- Eye tracking listens to `pointermove` on the whole window and isn't bound at all under `prefers-reduced-motion`.
