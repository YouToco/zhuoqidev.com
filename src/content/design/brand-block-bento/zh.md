---
title: "品牌色块拼贴"
summary: "Bento 色块墙，一块砖讲一条品牌规范：字体、缓动、图标、圆角、颜色、语气、时长，每块都能点能玩。"
category: style
origin: recreated
inspiredBy:
  name: "Dropbox Brand（Daybreak Studio，Awwwards 2025-02 月度最佳）"
  url: https://www.awwwards.com/sites/dropbox-brand
stack: [html, css, js]
tags: [品牌规范, bento, 色块, 设计系统, 微交互, 获奖风格]
order: 202
files: [index.html]
demoHeight: 680
added: 2026-10-20
---

照 Dropbox 品牌站的思路重做：把一份品牌规范拆成一墙色块，没有用它的代码、字体和图标。

## 看点

- **一块砖一条规范**：字体、缓动、图标、圆角、颜色、语气、时长各占一格，每格只说一句话，读的人一眼扫完整份规范。
- **每块都能玩**：缓动块里三个点用不同曲线跑同一段路，「品牌曲线」先快后慢；图标块点一下像老虎机转一格；颜色块点哪块哪块就展开、露出色值；字体块悬停时超大的 Aa 从粗变细。
- **大块纯色 + 一个超大字母**：主色那块占 2×2，一个 Aa 就是封面，不用插图。
- **圆角会算**：圆角块演示「里层圆角 = 外层圆角 − 内边距」，三层套在一起边缘才是平行的。
- **语气也是规范**：划掉的官腔和改过的白话并排放，写文案的人也知道该怎么写。

## 怎么用

1. 拷 `.bento` 网格（4 栏 → 2 栏 → 1 栏）和 `.tile` 基础样式；大块用 `grid-column: span 2; grid-row: span 2`。
2. 换颜色只改 `:root` 里的 `--blue` / `--coral` / `--lime` / `--pink` / `--yellow`，深色模式那段也一起改。
3. 弹簧缓动是一条 `linear()` 采样曲线（`--spring`），悬停抬起和颜色展开都用它；不支持 `linear()` 的旧浏览器会退回默认缓动。

## 坑

- 浅色字只放在主色和深色块上；珊瑚、黄绿、粉、黄这几块的字要写死成深色，否则深色模式下会变浅、看不清。
- 老虎机转到最后一格要瞬间跳回第一格：先去掉 `transition`，设回 `translateY(0)`，读一次 `offsetHeight` 强制重排，再把 `transition` 加回来。
- 色块按钮用 `flex` 展开，最小宽度要设 `min-width: 0`，不然色值文字会撑开、把别的块挤出边界。
