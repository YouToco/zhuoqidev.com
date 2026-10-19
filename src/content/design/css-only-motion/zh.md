---
title: "纯 CSS 动效"
summary: "不引动画库：linear() 弹簧缓动、View Transitions 页面过渡、滚动驱动、@starting-style 入场、高度到 auto。"
category: motion
origin: original
stack: [html, css]
tags: [动效, 弹簧, 页面过渡, 滚动驱动, 零依赖]
order: 210
files: [index.html]
demoHeight: 720
added: 2026-10-14
---

## 看点

- **弹簧写成缓动曲线**：把阻尼弹簧采样成 31 个点，塞进 `linear()`，就是一条会冲过头再回来的 easing。两条够用：`--spring`（阻尼 0.5，过冲约 16%）给按下 / 拖动 / 落下，`--spring-soft`（约 8%）给窗口和页面。演示里的曲线图是直接读这两个 CSS 变量画的。
- **页面过渡**：`@view-transition { navigation: auto; }` 一行让同站跳转自带过渡；旧页上移淡出，新页用软弹簧落下，被点的标题通过同一个 `view-transition-name` 飞成下一页的大标题。
- **滚动驱动**：阅读进度条是 `animation-timeline: scroll()`，卡片入场是 `animation-timeline: view()` 加 `animation-range: entry 0% entry 75%`，没有一行滚动监听。
- **首帧入场**：`@starting-style` 写元素第一次渲染时的样子，新插进 DOM 的提示条会从那里过渡过来，不用 keyframes，也不用「等一帧再加类」。
- **高度到 auto**：根上 `interpolate-size: allow-keywords`，`height: 0 ↔ auto` 就能过渡，还能配弹簧。
- **每块都能退化**：不支持的浏览器直接显示最终状态；演示右上角的小标签会告诉你当前浏览器支持哪些。

## 怎么用

1. 拷 `:root` 里的 `--spring`、`--spring-soft` 两个变量，按钮写 `transition: scale .45s var(--spring)`，`:active { scale: .93 }`。
2. 多页站点要页面过渡：全局 CSS 加 `@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }`，顶栏、底部导航各给一个固定的 `view-transition-name`，跳转时它们就原地不动。
3. 想让标题「飞」过去：列表页被点的标题和详情页的大标题设成同一个 `view-transition-name`（同一时刻一页里只能有一个元素叫这个名字），再拷 `::view-transition-group(vt-title)` 那几段。
4. 滚动驱动的规则包在 `@supports (animation-timeline: view())` 和 `prefers-reduced-motion: no-preference` 里，拷演示里的长属性写法。

## 坑

- 演示是单个页面，跨文档的 `@view-transition` 跑不起来，所以用的是同文档的 `document.startViewTransition()`，效果和伪元素写法完全一样。真实多页站点用 `@view-transition`，不需要这段 JS。
- `animation` 简写会把 `animation-timeline` 重置成 `auto`，所以 `animation-timeline` 必须写在简写之后。更隐蔽的是：有的 CSS 压缩工具会把几个长属性重新合成一个浏览器不认的简写，效果静默消失，要去检查构建产物。
- `view-transition-name` 在同一时刻必须唯一：列表里每一项都写死同一个名字，过渡会直接被跳过。只在点击时给被点的那一项设名字。
- `linear()` 弹簧只是「时间 → 进度」的曲线，不认速度：拖拽松手时甩得再快，回弹也是同一条曲线。要真物理就得上 JS。
- 「减少动态效果」要单独处理过渡伪元素：通配符 `*` 管不到 `::view-transition-*`。
