---
title: "编辑风结论报告页"
summary: "结论先行的杂志式报告：衬线大标题、一张大结论卡加四张小卡、Chart.js 图表配可点图例，表格各自横向滚动。"
category: layout
origin: original
stack: [html, css, chart.js]
tags: [报告, 编辑风, 结论先行, 图表, 对比卡片]
order: 150
files: [index.html]
demoHeight: 720
added: 2026-10-14
---

演示里的品牌、型号和数字全是编的，只为展示排版。

## 看点

- **结论先行**：标题下面第一块就是答案，一张蓝框大卡给最推荐的选项和一个大数字，旁边四张小卡用「最稳 / 要画质 / 先等 / 掉得最快」标签分人群；宽屏时散点图并排放在右边，打开就能看到结论和依据。
- **编辑风排版**：标题用系统衬线字体（宋体 / Noto Serif CJK），正文无衬线，数字等宽对齐；章节之间只用一条细线分隔，不套大卡片，读起来像一页账本。标题里的关键词用 `linear-gradient` 画半截荧光笔底色。
- **图表跟主题走**：Chart.js 的颜色全部从 CSS 变量读，`prefers-color-scheme` 一变就销毁重建，深色模式不用写第二套配色。
- **散点图的 100% 线**：网格线颜色写成函数，`tick.value === 100` 那条加深，一眼看出哪些点「卖过了首发」；虚线叠加往年平均折旧作对照。
- **浮动条形图**：横向柱子的数据写成 `[低, 高]`，Chart.js 直接画成区间条，适合「估计在 3–6 之间」这类数字。
- **HTML 图例**：图例是一排 `<button aria-pressed>`，点按切换数据集显隐，键盘和读屏都能用；`<canvas>` 里写一段文字描述，脚本加载失败时也有内容。
- **宽表不撑破页面**：每张表包在 `overflow-x: auto` 的盒子里，`section` 用 `minmax(0, 1fr)` 列，375px 宽也不会出现整页横向滚动。

## 怎么用

1. 拷 `<style>` 里的变量和版式部分，把 `--s1`–`--s4` 换成你的系列色，`--f-display` 换成你想要的衬线字体栈。
2. 按「先看结论 → 背景 → 明细表 → 推算 → 规律 → 来源」的顺序填内容；推算的数字加 `class="est"` 变灰。
3. 引入 Chart.js（`chart.js@4.5.1/dist/chart.umd.min.js`），把脚本里的 `retention` / `timeline` / `loss` 三组数据换成自己的，图例 `<ul class="legend" data-chart="画布 id">` 会自动生成。
4. 图表高度由外面的 `.chart` 容器决定（`maintainAspectRatio: false`），想改高度改 CSS，不要改 canvas。

## 坑

- Chart.js 不认识 `var(--x)`，必须先 `getComputedStyle` 读成具体颜色再传进去；所以切换深浅色要重建图表，单纯改 CSS 没用。
- `.chart` 容器必须 `position: relative` 且有明确高度，否则 `responsive` 模式下画布会越长越高。
- Grid 子元素默认 `min-width: auto`，里面的 canvas 或宽表会把整列撑开；列要写成 `minmax(0, 1fr)`。
- 系统里没有中文衬线字体时（部分安卓、Windows），标题会退回黑体；需要统一观感就自托管一个可商用的衬线字体。
