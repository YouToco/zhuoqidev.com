---
title: "底部悬浮药丸导航"
summary: "页面底部居中的药丸形导航：毛玻璃底、当前栏目高亮、按下回弹，旁边点缀会闪的小星星。"
category: navigation
origin: original
stack: [html, css]
tags: [导航, 药丸, 手作感, 毛玻璃]
order: 10
files: [index.html]
demoHeight: 360
added: 2026-10-14
---

## 看点

- **位置**：`position: fixed` + `left: 50%` + `translateX(-50%)`，永远贴在底部正中，手机上大拇指也够得着。
- **毛玻璃**：底色是 `color-mix(in srgb, var(--card) 82%, transparent)` 再加 `backdrop-filter: blur(16px)`，压在内容上也读得清。
- **回弹**：按下 `scale: .93`，松开用 `linear()` 写的弹簧曲线弹回来，不用任何 JS 动画库。
- **编号**：每项前面一个等宽小编号（01–04），让一排字有节奏。

## 怎么用

1. 把 `.dock` 和 `.stars` 两段 CSS 拷进你的样式表，颜色变量换成自己的。
2. 当前页面的链接加 `aria-current="page"`（服务端或路由里设），高亮和读屏都靠它。
3. 页面底部留出 `padding-bottom`，别让最后一段内容被导航盖住。

## 坑

- `backdrop-filter` 在 Safari 要带 `-webkit-` 前缀。
- `linear()` 弹簧曲线不支持的老浏览器会退回线性过渡，不影响使用。
