---
title: "像素溶解下拉框"
summary: "胶囊下拉框：菜单像一帘像素从按钮里倒出来；换选项时菜单碎成新颜色的像素被吸回按钮后面，名字也碎一下再拼好。"
category: button
origin: recreated
inspiredBy:
  name: "recent.design · Vibe selector"
  url: https://recent.design/i/maajesu-vibe-selector-microinteraction
stack: [html, css, canvas, js]
tags: [下拉框, 像素, 溶解动画, 动效, 微交互]
order: 5
files: [index.html]
demoHeight: 460
added: 2026-10-19
---

在 recent.design 看到一段 8 秒的录屏（作者只发了视频、没给代码），我和 Agent 逐帧看完后从零写的复现。

## 看点

- **打开和收起是两种动画**（逐帧看出来的）：打开时像素从按钮下沿往下「倒」，前沿是一个深 V 形、颜色最深，后面渐渐变成卡片底色，最后真菜单从上往下显出来；收起时菜单从下往上变成新颜色的像素，整团往上穿到按钮后面消失。
- **真 DOM + 像素遮罩**：菜单是真的 `<ul role="listbox">`，键盘、读屏都照常；动画期间每帧在一张小 canvas 上按 5px 格子画哪些格子该露出来，转成 `mask-image: url(dataURL)` 盖在菜单上。
- **像素在中间那层**：层级是 菜单（5）< 像素 canvas（6）< 按钮（7），所以被吸回去的像素是从按钮**后面**穿过去的。
- **抖动顺序**：每个格子什么时候翻面 = 4×4 Bayer 矩阵 × 0.35 + 随机数 × 0.65，部分露出的区域看起来是规则的网点而不是一片噪声。
- **颜色跟着选项走**：每个选项一种颜色（深色模式另有一套），像素用的是当前或新选项的颜色；按钮里的名字先碎成墨点和彩点，再一格一格拼出新名字。

## 怎么用

1. 拷 `<style>` 里 `.pick` 开头的那些规则和第一段 `<script>`（它把 `window.pixelPick` 挂出来）。
2. `pixelPick.mount(元素, { value, label, onChange })` 建一个，再 `setItems([{ id }])` 填选项；颜色写在脚本顶部的 `VIBES` 表里。
3. 想把同样的「名字碎掉再拼好」用在别处，直接调 `pixelPick.swapText(元素, 新文字, 颜色)`。

## 坑

- `requestAnimationFrame` 在后台标签页、被隐藏的预览窗格里不跑，动画会挂在半路：页面 `hidden` 或 `prefers-reduced-motion` 时直接跳过动画。
- 每帧 `toDataURL()` 一张遮罩不便宜，菜单很高（几百个格子以上）时会掉帧；5px 格子、十来个选项是舒服的规模。
- 动画进行中又点了一次：先 `restart()` 把旧动画停掉、清掉 canvas 和遮罩，再开始新的，否则会留下残影。
