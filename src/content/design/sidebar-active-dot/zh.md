---
title: "会滑动的激活圆点侧边栏"
summary: "整个目录只有一个圆点：点哪项它就竖着滑过去、换成分组色，落地把文字顶开，颜色再从左往右刷过去；每段速度都照原片逐帧量。"
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

- **只有一个圆点**：不是每一项各带一个点、显示或隐藏，而是整个目录共用一个绝对定位的点。点了新的一项，它从上一项竖着滑过去（跨分组也一样），半路换成新分组的颜色。眼睛能跟着它走，知道「刚才在那、现在在这」。
- **五步有先后，而且没有一段是匀速的**（原片 60 帧逐帧量出来、写成 CSS `linear()` 曲线）：
  1. 点下去，上一项立刻退回灰色、滑回原位；
  2. 圆点**先往左退出文字区、在左边空白里弧线跳过去**：横向比竖直跑得快（竖直走到 30% 时横向已经退回 60%），还会比停靠位置再往左多绕 2px，然后慢慢回到贴着文字左边的位置；竖直方向慢起、中间快、落地前长长地减速，时长随距离变（一行约 0.2 秒，五行约 0.25 秒）。两个方向各走各的逐帧曲线（Web Animations 关键帧），叠出来就是一条往左鼓的弧线；
  3. 落地时压扁一帧（1.25 × 0.8），停 2–3 帧，再往右「顶」10px（4 帧）；
  4. 晚一帧，文字被挤开，往右滑 22px：0.1 秒走完八成，然后慢慢停住；
  5. 晚一帧，颜色从左往右刷过去：先冲、到四分之三处顿一下、再慢慢刷完（0.2 秒）。
- **刷色只用 CSS**：文字的背景是一条「左半分组色、右半当前色」的渐变，宽 200%，用 `background-clip: text` 裁到字形上；激活时把 `background-position` 从 100% 滑到 0%，颜色就从左往右扫过去。右半用 `currentColor`，所以悬停时是深色、平时是灰色，不用写两套。
- **分组各有颜色**：排版蓝、颜色粉、布局橙、动效紫，分组标题的小图标、圆点、激活文字、右侧内容的小标题都用同一个变量 `--c`。
- **滚动渐隐**：列表两端用 `mask: linear-gradient(transparent, #000 36px, … )` 渐隐，告诉人上下还有，不用画分隔线。

## 怎么用

1. 拷 `:root` 里的两条曲线（`--shove`、`--sweep`）、脚本里的三组关键帧（`Y_LONG`、`Y_SHORT`、`X_BACK`）、`.item`、`.item .t`、`.dot` 这几段 CSS 和脚本里的 `activate()`；每个分组设一个 `--c`。
2. 圆点放在列表容器里（容器 `position: relative`），位置用条目的 `offsetTop` 算：它是相对布局的，列表滚动也不会错位；而且只在点击时才读，页面加载时不碰布局。
3. 条目是真的链接，键盘能 Tab 过去，上下方向键在条目间移动；当前项用 `aria-current` 标出来，样式也挂在它上面。

## 坑

- `background-clip: text` 要配 `-webkit-text-fill-color: transparent`，只写 `color: transparent` 在 Safari 上不行。
- 文字的平移和刷色要**等圆点顶到**：语义上的 `aria-current` 点击时就设，视觉上的 `.lit`（挤开 + 上色）等圆点落地、顶过之后约 0.1 秒才加；否则几件事同时发生，就看不出是圆点「挤开」了文字。
- 速度曲线别用 `ease` 凑：按录屏逐帧量位置，直接写成 `linear(0, 0.065 9%, 0.13 18%, …)`，比任何三次贝塞尔都像。验证时 Playwright 的虚拟时钟管不了 CSS 过渡，要用 `document.getAnimations()` 暂停后手动拨 `currentTime` 再读。
- 连续快速点：每次先清掉上一轮还没执行的定时器，再把圆点身上的动画 `commitStyles()` 写回内联样式后 `cancel()`，新的动画从当前位置开始。**播完、靠 `fill: forwards` 停着的动画也要先 commit**，只 commit「播放中」的会让圆点跳回旧位置。
- 别用 `getBoundingClientRect()` 算圆点位置：列表滚动后它会变，点就跑偏；`offsetTop` 不受滚动影响。
- `prefers-reduced-motion` 下所有过渡都关掉，圆点和颜色直接跳到位。
