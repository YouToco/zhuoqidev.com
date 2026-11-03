---
title: 在博客文章里直接跑 CSS 动画 Demo
description: 在 Markdown 里写一段 HTML 和 CSS，文章里就是一个能动的小窗口：不用 CodePen 账号，跟着网站切换白天 / 夜间，手机上高度自动撑开。
date: 2026-05-04
glyph: embedded-demo
updated: 2026-11-03
lead: 想在文章里放一个能动的 CSS 效果，不用截 GIF，也不用去 CodePen：在 Markdown 里写一个标成 `html demo` 的代码块，网站构建时就把它变成文章里的一个小窗口，读者看到的是真在浏览器里跑的动画。下面两个例子就是这么写出来的。
tags:
- CSS
- 动画
- Markdown
- Astro
- Hugo
- Shortcode
categories:
- 折腾记录
---

> [!NOTE]
> 2026-11-03 按现状重写。初版（2026-05）写的是本站当时用的 Hugo 框架的 shortcode 嵌入写法；网站 2026-10 换成 Astro 后，那套写法已经不用了。

## 写法：一个代码块

在文章的 Markdown 里写一个代码块，语言写 `html`，后面跟 `demo` 和高度：

````markdown
```html demo height=200 caption="纯 CSS 旋转加载器"
<style> … </style>
<div class="loader"></div>
```
````

网站构建时把这段 HTML 放进一个隔离的小窗口（`iframe`，网页里嵌的另一个网页）。效果：

- **读者打开文章就能看到在动的效果**，网页里已经带着这段代码，不用再去别的网站加载。
- **代码关在小窗口里**：它的样式不会弄乱文章，文章的样式也不会改它。
- **跟着网站换颜色**：小窗口里可以用网站的颜色变量（`var(--ink)` 文字色、`var(--seal)` 印章红、`var(--line)` 线条色等），读者切到夜间模式，demo 一起变。
- **手机上不会被截断**：`height` 是最小高度，内容在窄屏上折行变高时，小窗口自己长高。

给 AI 和搜索引擎看的那份纯文本版（每篇文章地址后面加 `index.md`）里，保留的还是原来的代码块。

## 例子 1：旋转加载器

```html demo height=200 caption="纯 CSS 旋转加载器（切到夜间模式试试）"
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

一圈灰色边框，只把上边染成红色，再让整个圆一直转：`animation: spin 0.8s linear infinite` 就是「0.8 秒转一圈，匀速，不停」。

## 例子 2：流光文字

```html demo height=160 caption="CSS 渐变流光文字"
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

背景是一条比文字宽一倍的渐变，`background-clip: text` 让它只在文字的形状里显示，再把背景位置不停往右推，就像光从字上扫过。

## 什么时候不用这个，改用 CodePen / CodeSandbox

| 想放的东西 | 用什么 |
| --- | --- |
| 一小段 HTML + CSS（动画、布局、按钮效果），想跟文章一起改、一起存档 | 文章里的 `html demo` 代码块 |
| 想让读者直接在线改代码、fork 一份去玩 | 在 [CodePen](https://codepen.io/) 上建一个，文章里放链接 |
| 要装依赖的完整小应用（React / Vue 组件） | 在 [CodeSandbox](https://codesandbox.io/) 上建一个，文章里放链接 |

代码块的好处是代码跟文章在同一个仓库里，网站搬家、换框架都不会丢；外部平台适合「让读者自己动手改」。

---

这套网站是怎么同时在国内和海外上线、一年花多少钱的，见[《一份静态站，国内走阿里云、海外走 Cloudflare》](/posts/hugo-dual-cdn-blog/)。
