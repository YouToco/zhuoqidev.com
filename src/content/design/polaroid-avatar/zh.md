---
title: "拍立得头像"
summary: "头像做成一张拍立得：白边、一条胶带、一行手写字；放在桌面上可以拖，拖得快会歪，松手弹回。"
category: card
origin: original
stack: [html, css, svg, js]
tags: [头像, 拍立得, 手作感, 拖拽, 弹簧]
order: 20
files: [index.html]
demoHeight: 520
added: 2026-10-14
---

## 看点

- **三样东西就成立**：白色相纸边（底边留得比三边宽）、顶上一条半透明胶带、底下一行手写字。里面换成什么照片都像拍立得。
- **相纸永远是白的**：深色模式下桌面变暗，但相纸和手写字的颜色写死，像一张真的照片放在夜里的桌上。
- **胶带只用一个渐变**：`repeating-linear-gradient` 让同一种黄一深一浅地交替，再歪 3 度，就有和纸胶带的质感。
- **拖起来会歪**：按住时放大一点（`scale: 1.035`），按横向速度算出一个 `--tilt`，CSS 用 `rotate: calc(var(--tilt) * 1deg)` 歪过去；松手后去掉，`linear()` 弹簧曲线让它晃一下再停平。
- **静止的歪和拖动的歪分开**：平时的 4 度写在 `transform` 上，拖动的倾斜写在独立的 `rotate` 属性上，两者叠加互不覆盖，所以弹回时只回到 4 度。
- **占位头像是 SVG 铅笔画**：`feTurbulence` + `feDisplacementMap` 给线条加一点抖动，头发用斜线 `pattern` 排线，不需要任何图片。

## 怎么用

1. 拷 `.polaroid`、`.tape`、`.polaroid figcaption` 三段 CSS 和 `--spring` 变量。
2. 把 `<svg>` 换成你的 `<img>`（加 `draggable="false"`，否则浏览器会拖出图片的幽灵影子）。
3. 只想要静态的（比如「关于」页）：去掉脚本和 `touch-action: none`、`cursor: grab`，`transform` 里的角度按版面改（比如 `rotate(-3deg)`）即可。
4. 要拖动：父容器 `position: relative`，相片 `position: absolute`，把 `pointerdown` 那段脚本拷过去；需要记住位置就在 `up()` 里把 `left/top` 存进 `localStorage`。

## 坑

- `touch-action: none` 一定只加在相片上：加在整个容器上，手机上手指放在空白处也滚不动页面。更稳妥的做法是只在宽屏开启拖动，窄屏退回普通的一列。
- 不判断「移动超过 4px 才算拖」的话，点一下也会触发 `dragging` 类，相片会抖一下。
- 拖动用 `setPointerCapture`，否则鼠标甩快了离开相片，`pointermove` 就收不到了。
- 手写字体只用系统自带（苹果 / Windows 的楷体，Linux 的 AR PL UKai）。想要更像手写就自己加字体文件，中文字体记得按页面用到的字切子集，不然几 MB。
