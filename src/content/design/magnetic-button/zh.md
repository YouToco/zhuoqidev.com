---
title: "磁吸按钮"
summary: "鼠标靠近，按钮被「吸」过去，里面的字跟得更多，像有厚度；移开时用弹簧弹回原位。JS 只写两个变量。"
category: button
origin: original
stack: [html, css, js]
tags: [按钮, 动效, 弹簧, 微交互]
order: 4
files: [index.html]
demoHeight: 420
added: 2026-10-19
---

## 看点

- **JS 只算两个数**：指针相对按钮中心的偏移，归一化到 -1…1，写进 `--x`、`--y`。位移全在 CSS：按钮 `translate: calc(var(--x) * var(--pull)) …`。
- **视差出厚度**：里面的字移动按钮的 0.6 倍、方向相同但叠加在按钮上，看起来字比按钮「浮」得高一点。
- **跟手和回弹是两条曲线**：指针在附近时加 `.near`，过渡缩到 0.18 秒 ease-out，紧紧跟着；离开后去掉 `.near`，回到 0.9 秒的弹簧曲线，会冲过头一点再停。
- **吸力范围**：按钮外 60px 内就开始受影响，越靠近中心越强；`--pull` 控制最大位移，圆按钮给得大一点。
- **一帧最多算一次**：`pointermove` 只记位置，真正计算放进 `requestAnimationFrame`。

## 怎么用

1. 拷 `.mag`、`.mag .t`、`.mag.near` 三段 CSS 和脚本；按钮里的字包一层 `<span class="t">`。
2. 想要更夸张就调 `--pull`，想要范围更大就调脚本里的 `REACH`。
3. 只在 `(hover: hover) and (pointer: fine)` 下启用：触屏上没有「靠近」这回事，手指按下去按钮跑掉只会让人点不中。

## 坑

- 算距离时要用按钮**原来的**位置：`getBoundingClientRect()` 拿到的是位移后的框，示例把上一次的位移存在 `data-dx/dy` 里减回去，否则按钮会越吸越远、抖动。
- 一页别放太多：每个按钮每帧都要量一次尺寸，十几个以内没问题。
- `prefers-reduced-motion: reduce` 下直接关掉位移。
