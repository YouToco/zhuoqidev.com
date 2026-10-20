---
title: "糖果扁平插画"
summary: "紫底撞色、慢慢变形的软胶色块、眼睛跟着鼠标的吉祥物、一点就弹开的卡片摞，按钮垫硬阴影像贴纸。"
category: style
origin: recreated
inspiredBy:
  name: "MindMarket（Louis Paquet，Awwwards 2025-12 月度最佳）"
  url: https://www.awwwards.com/sites/mindmarket
stack: [html, css, js]
tags: [扁平插画, 撞色, 软胶形状, 弹簧, 吉祥物, 获奖风格]
order: 204
files: [index.html]
demoHeight: 760
added: 2026-10-20
---

照 MindMarket（扁平插画 + Rive 动画）和 Ponpon Mania（可交互漫画，2025-10 月度最佳）的配色和手感重做，插画换成了纯 CSS 形状。

## 看点

- **高饱和撞色**：长春花紫 `#7E7EFF` 做底，粉、黄绿、柠檬黄三个配角，彼此都不调和，所以热闹。
- **没有直角**：背景色块用八个值的 `border-radius` 画成不规则的软胶形状，`@keyframes` 只改圆角和一点旋转，它们就会慢慢「呼吸」。
- **硬阴影像贴纸**：按钮、卡片、色块底下都是一条不模糊的深色阴影（`0 5px 0`）；按钮按下去时往下移 5px、阴影归零，像把贴纸按平。
- **卡片摞会弹**：三张卡叠在一起各歪一点，点一下用弹簧缓动散开，再点收回。整摞是一个 `<button aria-expanded>`，键盘也能操作。
- **会看人的吉祥物**：一块软胶加两只眼睛，瞳孔朝鼠标方向挪，最多挪眼睛宽度的 30%。

## 怎么用

1. 拷 `:root` 的颜色和 `--spring`；`.blob` 和 `@keyframes morph` 拷过去就能在任何区块后面放色块。
2. 按钮拷 `.btn`（悬停抬起、按下压平）；卡片摞拷 `.stack` + `.card` 三种 `nth-child` 位置，展开位置写在 `[aria-expanded="true"]` 下面。
3. 圆体字：演示用 `ui-rounded`（苹果设备是 SF Rounded），其他系统落到 Arial Rounded 或系统无衬线；中文没有系统圆体，要圆就自带开源字体并切子集。

## 坑

- 色块是装饰，要放 `z-index: -1` 并在父元素加 `isolation: isolate`，否则会盖到文字上，或者跑到页面背景后面看不见。
- 深色模式不能只把底色换深：粉和黄在深紫上会发荧光，要整体压低一点饱和（演示里换了一套值）。
- 卡片上的字颜色要跟着卡片走：黄卡、粉卡在两种模式下都是浅底，字写死成深色；白卡在深色模式变成深紫，字才用跟主题变的颜色。
- 眼睛跟随监听的是整个窗口的 `pointermove`，在 `prefers-reduced-motion` 下整段不绑。
