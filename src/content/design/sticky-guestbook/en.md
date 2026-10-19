---
title: "Sticky-Note Guestbook Wall"
summary: "A wall of colored sticky notes plus a post form: four colors, slight tilt, tape, straighten on hover; demo notes stay local."
category: layout
origin: original
stack: [html, css, javascript]
tags: [guestbook, sticky notes, handmade, form]
order: 120
files: [index.html]
demoHeight: 720
added: 2026-10-14
---

## What makes it work

- **Looks like paper**: the four note colors (yellow / pink / blue / green) and the dark text stay the same in both light and dark themes; paper is paper. The surroundings are a dot-grid paper background, and a strip of tape is stuck on top of the form card.
- **Tilted stably**: each note's tilt angle is computed from its id (`(id * 37) % 7 - 3` degrees), so it tilts the same way however many times you refresh, with no random jumping each time.
- **Straightens on hover**: when the mouse moves over a note it turns upright and lifts 3px, transitioning with the spring curve, which feels a bit like being pressed by a finger.
- **The note just posted**: it drops in from above, scales up slightly, then springs into place; your own note has a dashed border and an "only on this device" marker, and can be torn off.
- **Form details**: the character count counts characters (an emoji counts as 1), and the counter turns red when exceeded; the color choice is hidden radio buttons, so it can also be chosen from the keyboard; content is always inserted into the page with `textContent`, so even typed HTML is only displayed as text.

## How to use it

1. Copy the CSS blocks `.gb-form`, `.gb-wall`, `.gb-note` and the page structure, and swap the color variables for your own.
2. So that it can run on its own, the example stores messages only in the browser's `localStorage`. When connecting to your own site, change `submit` to `fetch` your backend endpoint (POST the content, signature and color), and make the notes on the wall a list fetched from the endpoint; the `card()` render function needs no changes.
3. For a public guestbook, moderating before notes go on the wall is recommended: a just-submitted message first shows only in the author's own browser (the "only on this device" look in the example), and appears on everyone's wall once approved.
4. The backend should validate length and color values again; the front-end limits are only for the user's convenience.

## Pitfalls

- The wall uses `grid` + `align-items: start`, otherwise notes in the same row are stretched to the same height and lose the uneven look of sticky notes.
- The tilt uses the separate `rotate` property rather than `transform`, so the hover `translate` and the entrance animation don't override the tilt.
- Notes need `white-space: pre-wrap` to preserve line breaks, plus `overflow-wrap: anywhere`, otherwise a long URL breaks the note's layout.
- On phones, iOS automatically zooms the page when an input with a font size under 16px gets focus, so all inputs are set to 16px.
