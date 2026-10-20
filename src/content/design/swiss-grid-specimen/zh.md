---
title: "瑞士网格字体样本"
summary: "只用两种颜色：12 栏网格直接画在页面上，字号阶梯当内容，拖动条实时改字重，项目索引悬停整行反色。"
category: style
origin: recreated
inspiredBy:
  name: "Exat Typeface（Studio Size，Webby 2026 美感类提名）"
  url: https://www.awwwards.com/sites/exat-typeface
stack: [html, css, js]
tags: [瑞士风格, 网格, 字体样本, 可变字重, 双色, 获奖风格]
order: 201
files: [index.html]
demoHeight: 760
added: 2026-10-20
---

照 Exat Typeface、Siena Film Foundation、Anime.js 官网（都拿过 Awwwards 每日 / 月度最佳）的味道重做，没有用它们的代码和字体。

## 看点

- **网格画出来**：页面两侧留边后分 12 栏、栏距 16px，一层 `position: fixed` 的竖线把栏线画出来，顶栏按钮可以关掉；所有块都用 `grid-column` 对齐到栏线。手机上改成 6 栏。
- **只有两种颜色**：纸 `#EEEFEB` 和墨 `#1C1D1E`，深色模式就是两个对调。层次全靠字号、字重和 1px 细线。
- **字号就是内容**：96 / 64 / 40 / 24 / 16 / 12 一排排列出来，左边等宽小字标字号，每行一条细线，像字体厂的样本册。
- **一个交互撑起整页**：拖动条改一个 CSS 变量 `--w`，大字母、字号阶梯、样例词的 `font-weight` 一起变；四个常用字重是快捷按钮。
- **索引表悬停反色**：项目列表一行四格（编号 / 名称 / 标签 / 年份），悬停整行变墨底纸字、往右挪一点，不用卡片也有反馈。

## 怎么用

1. 拷 `:root` 里的 `--paper` / `--ink` / `--cols` / `--gap` / `--pad`，和 `.g` 网格类；每块内容给 `grid-column: 起点 / span 栏数`。
2. 要栏线就拷 `.overlay` 和脚本里的 `drawCols()`；栏数从 `--cols` 读，换断点时自动重画。
3. 改字重的效果要可变字体：苹果的系统字体和 Windows 11 的 Segoe UI Variable 都是可变的。要每台机器都一样，就换一款开源可变怪诞体（例如 Inter、Schibsted Grotesk），自己托管。

## 坑

- 系统字体在 Linux 上通常只有常规和粗体两档，拖动条会一档一档跳，不是连续变化；正式用要自带可变字体。
- 不要引 Google Fonts：国内访问不了，`<link>` 样式表还会卡住首屏渲染。
- 栏线层要 `pointer-events: none`，不然盖住下面的链接和拖动条。
- 大字母用 `line-height: 0.78` 贴着下边线，字号用 `clamp()` 跟着宽度变，太小的屏幕要单独给下限，否则 375px 时会撑出横向滚动。
