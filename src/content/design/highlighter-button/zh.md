---
title: "荧光笔划过"
summary: "链接和按钮被荧光笔从左往右涂一道：笔头是斜的、位置偏低、跨行每行单独划，离开时往右擦掉。纯 CSS。"
category: button
origin: original
stack: [html, css]
tags: [按钮, 链接, 手作感, 零依赖, 微交互]
order: 2
files: [index.html]
demoHeight: 560
added: 2026-10-19
---

## 看点

- **划线是背景，不是伪元素**：链接的背景是 `linear-gradient(transparent 52%, 黄 52%, 黄 90%, transparent 90%)`，只占行高的下半截，像荧光笔拖得偏低；`background-size` 从 `0% 100%` 过渡到 `100% 100%`，就是从左往右涂。
- **跨行也对**：`box-decoration-break: clone` 让换行的链接每一行各自有一道，而不是第一行起、最后一行止的一整块。
- **斜笔头**：按钮上的那道是 `::before`，`skewX(-18deg)` 把两端切成斜口，再 `rotate(-2deg)` 让它不那么正；`scaleX` 从 0 到 1。
- **擦掉的方向**：离开时把 `transform-origin` 换到右边，收起来就像往右擦掉，而不是原路缩回。
- **标重点**：第三种是可切换的，`aria-pressed="true"` 时留着那道黄，适合「读过」「收藏」这类状态。

## 怎么用

1. 正文链接：拷 `.hl`，给 `<a>` 加类名；换色改 `--c`。
2. 按钮：拷 `.mk` 和它的 `::before`、`:hover` 规则；按钮背景要透明，黄条才在字下面露出来（`isolation: isolate` + `z-index: -1` 已经处理好层级）。
3. 深色模式下荧光黄要换成暗一点的饱和色（示例里是 `#7d6416`），浅色字压在上面才读得清。

## 坑

- `background-size` 的过渡在 Safari 很老的版本里会跳帧，可以接受。
- 链接默认没有下划线，记得留一个平时就看得出是链接的记号（示例用一条虚线），不然只有指上去才知道能点。
- 触屏没有 hover：链接点下去就跳走了，看不到动画，这没关系；按钮可以把同一效果挂在 `:active` 上。
