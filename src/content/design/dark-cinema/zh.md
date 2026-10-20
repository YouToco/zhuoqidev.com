---
title: "暗场电影感"
summary: "暖棕黑底、一束跟着鼠标走的橙光、宽银幕黑边上的实时时间码和胶片颗粒；浅色是「日场」。"
category: style
origin: recreated
inspiredBy:
  name: "Oryzo AI（Lusion，Awwwards 2026-04 月度最佳）"
  url: https://www.awwwards.com/sites/oryzo-ai
stack: [html, css, js]
tags: [深色, 电影感, 胶片颗粒, 光晕, 鼠标跟随, 获奖风格]
order: 203
files: [index.html]
demoHeight: 720
added: 2026-10-20
---

照 Oryzo AI、Phantom.Land、Immersive Garden（Webby 2025「视觉设计 · 美感」冠军）这类暗场作品的味道重做，原站的 WebGL 部分换成了纯 CSS 和几行脚本。

## 看点

- **底色不是纯黑**：`#100904` 往暖棕偏一点，像放映厅而不像关机的屏幕。整页只有一个强调色 `#FF8539`。
- **一束光代替渐变背景**：一个大号 `radial-gradient` 加模糊，平时慢慢呼吸；鼠标进来后每帧往指针挪 8%，光是「飘」过去的，不是吸附过去的。
- **宽银幕黑边**：首屏上下两条黑边，上面是 24 fps 实时走的时间码和镜头参数，下面是场次，等宽小字只出现在黑边上。
- **胶片颗粒**：一张 SVG `feTurbulence` 噪点图铺满全屏，`mix-blend-mode: overlay`，深色时浓一点、浅色时淡一点。
- **胶片条**：三个镜头放在一条黑色胶片上，齿孔是两排 `radial-gradient` 重复出来的小圆。

## 怎么用

1. 拷 `:root` 和深色那段变量；这个风格以深色为主，浅色是「日场」：暖纸色底、深棕字、稍暗的橙。
2. 颗粒层 `.grain` 和光 `.light` 直接拷；光的跟随在脚本后半段，`prefers-reduced-motion` 时整段不跑。
3. 标题用细斜体衬线。演示用系统自带的 Iowan / Palatino / Georgia；要更有电影海报味，换一款开源的细衬线斜体，自己托管。

## 坑

- 颗粒层要 `position: fixed; pointer-events: none`，放最上层；不加 `pointer-events: none` 会挡住所有点击。
- 光团很大（620px），父元素要 `overflow: hidden`，否则会撑出横向滚动。
- 时间码每帧都在改文字，要用 `font-variant-numeric: tabular-nums`，不然数字宽度不同、整行会抖。
- 颗粒在浅色背景上用 `overlay` 几乎看不见、在深色上又容易太脏，两种模式的不透明度要分开调（演示里是 0.12 和 0.22）。
