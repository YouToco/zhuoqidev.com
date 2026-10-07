---
title: Embedding CSS Animation Demos in Hugo Articles
description: Use custom shortcodes to run live CSS animations directly in Hugo blog posts — no CodePen account needed.
date: 2026-05-04
updated: 2026-07-30
lead: 'Hugo shortcodes make it easy to embed live code demos. Here are three ways:'
tags:
- Hugo
- CSS
- Animation
- Shortcode
categories:
- Tinkering
---

The diagram first separates their boundaries: a native shortcode, a CodePen iframe, and a CodeSandbox app serve different complexity levels and execute code in different places.

![Three ways to embed an interactive demo in a Hugo article](./hugo-embed-paths-bilingual-v1-4k.png "Three embed paths: prefer a native shortcode for simple, versioned effects; CodePen for shareable snippets; and CodeSandbox for a complete interactive application.")

## 1. Inline CSS Demo (No External Service)

A spinning loader animation, right in the article:

```html demo height=200 caption="Pure CSS Spinner"
<style>
  .loader {
    width: 48px;
    height: 48px;
    border: 4px solid #e8e4de;
    border-top-color: #c44020;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
<div class="loader"></div>
```

A gradient text animation:

```html demo height=160 caption="CSS Gradient Text"
<style>
  .gradient-text {
    font-size: 2rem;
    font-weight: 700;
    font-family: system-ui, sans-serif;
    background: linear-gradient(135deg, #c44020, #e8803a, #c44020);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 2s linear infinite;
  }
  @keyframes shimmer {
    to { background-position: 200% center; }
  }
</style>
<div class="gradient-text">ZhuoQi Dev</div>
```

## 2. Embed CodePen

If you already have CodePen creations, embed them with a single shortcode:

```
{{< codepen id="yourPenID" height="400" tab="result" >}}
```

## 3. Embed CodeSandbox

For React / Vue components, use CodeSandbox:

```
{{< codesandbox id="yourSandboxID" height="450" view="preview" >}}
```

---

These three shortcodes cover most code demo scenarios — no extra tools needed.
