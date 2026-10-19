---
title: "印章按钮"
summary: "按下去像盖章：往下一压、轻轻一拧，松手后纸上留下一枚带颗粒感、慢慢淡掉的红印。"
category: button
origin: original
stack: [html, css, js]
tags: [按钮, 手作感, 微交互, 弹簧]
order: 1
files: [index.html]
demoHeight: 420
added: 2026-10-19
---

## 看点

- **压下去，不是缩小**：按下时 `translate: 0 3px` 往下沉、底下那条 `0 3px 0` 的硬阴影同时收成 0，看起来是整块印章贴到了纸上；再加 `rotate: 1deg`，像手腕带了一下。
- **弹回来**：松手用 `linear()` 写的弹簧曲线过渡（`--spring`），会冲过头一点再停，不用 JS 动画库。按下那一刻把 `transition-duration` 压到 0.06 秒，手感是「啪」一下。
- **印章的边**：`box-shadow: inset 0 0 0 2px` 在按钮里面画一圈浅色细框，像刻出来的印面边框；字用宋体加宽字距。
- **留下的印**：点击后在按钮下方插一个同样文字的 `.imprint`，位置和角度各带一点随机（±7°），用 `feTurbulence` 噪声做的 SVG 当 `mask`，墨色就不均匀；1.8 秒淡出后自己删掉。
- **三种形状**：实心（主操作）、描边（次要操作）、圆形「已阅」，都是同一个类加修饰类。

## 怎么用

1. 拷 `.stamp` 那几段 CSS 和 `--spring` 变量；颜色换成你自己的强调色（`--seal`）和它上面的字色（`--on-seal`）。
2. 想要落印效果，再拷 `.imprint`、`@keyframes ink` 和底部那段脚本；外层容器要 `position: relative; overflow: hidden`，印就落在这张「纸」上。
3. 只要按钮手感、不要印：只拷 CSS，一行 JS 都不用。

## 坑

- `mask` 用的噪声图是运行时生成的 data URL，放进 CSS 变量里；直接写在样式表里也行，但要把 `#` 编成 `%23`。
- `box-shadow` 里的 `color-mix()` 需要 2023 年后的浏览器；老浏览器整条阴影失效，按钮仍能用。
- 印章按钮适合「确认 / 提交」这类有仪式感的动作，别把页面上所有按钮都做成这样。
