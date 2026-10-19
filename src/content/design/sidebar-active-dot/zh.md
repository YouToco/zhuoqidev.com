---
title: "会滑动的激活圆点侧边栏"
summary: "整个目录只有一个圆点：点哪项它就从上一项竖着滑过去、换成分组的颜色，落地后文字让位，颜色从左往右刷过去。"
category: navigation
origin: recreated
inspiredBy:
  name: "recent.design · Sidebar Active State（Gustavo）"
  url: https://recent.design/i/9e89xf0-design-guidelines-app-ui
stack: [html, css, js]
tags: [导航, 侧边栏, 激活状态, 微交互, 滚动渐隐]
order: 11
files: [index.html]
demoHeight: 620
added: 2026-10-20
---

在 recent.design 看到 Gustavo 一个设计规范 App 的录屏（只有视频、没有公开代码），我和 Agent 每 70ms 抽一帧，把激活状态拆成了四步再复现。目录条目是我自己写的同类设计话题。

## 看点

- **只有一个圆点**：不是每一项各带一个点、显示或隐藏，而是整个目录共用一个绝对定位的点。点了新的一项，它从上一项竖着滑过去（跨分组也一样），路上被拉长一点（`scale: 0.7 1.35`），落地变回圆形，颜色换成新分组的颜色。眼睛能跟着它走，知道「刚才在那、现在在这」。
- **四步有先后**：① 悬停时文字从灰变深；② 点下去圆点先动（0.2 秒）；③ 圆点快到时文字往右让出 15px（延迟 0.1 秒）；④ 文字颜色从左往右「刷」成分组色（延迟 0.14 秒，0.26 秒刷完）。上一项同时退回灰色、回到原位。
- **刷色只用 CSS**：文字的背景是一条「左半分组色、右半当前色」的渐变，宽 200%，用 `background-clip: text` 裁到字形上；激活时把 `background-position` 从 100% 滑到 0%，颜色就从左往右扫过去。右半用 `currentColor`，所以悬停时是深色、平时是灰色，不用写两套。
- **分组各有颜色**：排版蓝、颜色粉、布局橙、动效紫，分组标题的小图标、圆点、激活文字、右侧内容的小标题都用同一个变量 `--c`。
- **滚动渐隐**：列表两端用 `mask: linear-gradient(transparent, #000 36px, … )` 渐隐，告诉人上下还有，不用画分隔线。

## 怎么用

1. 拷 `.item`、`.item .t`、`.dot` 这几段 CSS 和脚本里的 `activate()`；每个分组设一个 `--c`。
2. 圆点放在列表容器里（容器 `position: relative`），位置用条目的 `offsetTop` 算：它是相对布局的，列表滚动也不会错位；而且只在点击时才读，页面加载时不碰布局。
3. 条目是真的链接，键盘能 Tab 过去，上下方向键在条目间移动；当前项用 `aria-current` 标出来，样式也挂在它上面。

## 坑

- `background-clip: text` 要配 `-webkit-text-fill-color: transparent`，只写 `color: transparent` 在 Safari 上不行。
- 文字的平移和刷色要**等圆点**：都比圆点晚 0.1–0.14 秒开始，否则三件事同时发生，就看不出是圆点「带来」了激活。
- 别用 `getBoundingClientRect()` 算圆点位置：列表滚动后它会变，点就跑偏；`offsetTop` 不受滚动影响。
- `prefers-reduced-motion` 下所有过渡都关掉，圆点和颜色直接跳到位。
