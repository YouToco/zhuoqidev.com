---
title: Live CSS Animation Demos Right Inside a Blog Post
description: Write a bit of HTML and CSS in Markdown and the article shows a small live window — no CodePen account, it follows the site's day / night switch, and it grows to fit on a phone.
date: 2026-05-04
glyph: embedded-demo
updated: 2026-11-03
lead: 'To show a moving CSS effect in an article you need neither a GIF nor CodePen: write a code block marked `html demo` in the Markdown, and the build turns it into a small window in the page where the animation really runs in the reader''s browser. The two examples below are written exactly that way.'
tags:
- CSS
- Animation
- Markdown
- Astro
- Hugo
- Shortcode
categories:
- Tinkering
---

> [!NOTE]
> Rewritten on 2026-11-03 for how the site works now. The first version (2026-05) described the shortcode syntax of Hugo, the framework the site used then; since the move to Astro in 2026-10 that syntax is no longer used here.

## How: one code block

In the article's Markdown, write a code block whose language is `html`, followed by `demo` and a height:

````markdown
```html demo height=200 caption="Pure CSS spinner"
<style> … </style>
<div class="loader"></div>
```
````

At build time the site puts that HTML into an isolated small window (an `iframe`, a web page embedded in another). What that gives you:

- **Readers see it moving as soon as the article opens**: the code is already in the page, nothing is loaded from another site.
- **The code is fenced off**: its styles cannot break the article, and the article's styles cannot change it.
- **It follows the site's colours**: inside the window you can use the site's colour variables (`var(--ink)` for text, `var(--seal)` for the seal red, `var(--line)` for rules, and so on), so when the reader switches to night mode the demo switches too.
- **It is not cut off on a phone**: `height` is the minimum; when the content wraps and grows taller on a narrow screen, the window grows with it.

The plain-text copy for AI tools and search engines (add `index.md` to any article's address) keeps the original code block.

## Example 1: a spinner

```html demo height=200 caption="Pure CSS spinner (try night mode)"
<style>
  .loader {
    width: 48px;
    height: 48px;
    border: 4px solid var(--line);
    border-top-color: var(--seal);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
<div class="loader"></div>
```

A grey ring with only its top edge coloured red, turned forever: `animation: spin 0.8s linear infinite` means "one turn every 0.8 seconds, at an even speed, without stopping".

## Example 2: shimmering text

```html demo height=160 caption="CSS gradient shimmer text"
<style>
  .gradient-text {
    font-size: 2rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--seal), var(--gold), var(--seal));
    background-size: 200% auto;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: shimmer 2s linear infinite;
  }
  @keyframes shimmer {
    to { background-position: 200% center; }
  }
</style>
<div class="gradient-text">ZhuoQi Dev</div>
```

The background is a gradient twice as wide as the text; `background-clip: text` shows it only inside the letters, and moving the background steadily to the right looks like light sweeping across them.

## When to use CodePen or CodeSandbox instead

| What you want to show | Use |
| --- | --- |
| A small piece of HTML + CSS (an animation, a layout, a button effect) that should be edited and archived with the article | an `html demo` code block in the article |
| Something readers can edit online or fork to play with | a pen on [CodePen](https://codepen.io/), linked from the article |
| A complete small app with dependencies (a React / Vue component) | a sandbox on [CodeSandbox](https://codesandbox.io/), linked from the article |

The code block keeps the code in the same repository as the article, so moving hosts or switching frameworks never loses it; the outside platforms are for letting readers change the code themselves.

---

How this site is served both inside and outside China, and what that costs a year, is in [the dual-line deployment write-up](/en/posts/hugo-dual-cdn-blog/).
