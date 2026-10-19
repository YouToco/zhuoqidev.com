---
title: "一键复制按钮"
summary: "复制成功：两张纸收起、画出对勾、文字往上换成「已复制」；失败：变红抖一下。还会念给读屏软件听。"
category: button
origin: original
stack: [html, css, svg, js]
tags: [按钮, 复制, 代码块, 微交互, 弹簧]
order: 3
files: [index.html]
demoHeight: 420
added: 2026-10-19
---

## 看点

- **一个 SVG 两个状态**：图标里同时画了「两张纸」和对勾。对勾是一条路径，`stroke-dasharray: 16; stroke-dashoffset: 16` 先藏起来，成功时 offset 变 0，看起来是一笔画出来的；两张纸同时 `scale(.4)` 淡出。
- **文字换行而不是换字**：标签是两行字放在一行高的窗口里（`height: 1em; overflow: hidden`），成功时整体 `translate: 0 -100%` 往上滑，用弹簧曲线，有一点回弹。
- **失败也有样子**：剪贴板被拒绝（不是 https、权限没给）时变红并左右抖两下，而不是什么都不发生。
- **复制的是 textContent**：代码块就算被折叠、隐藏也能复制到全文；`innerText` 遇到没有布局的元素会拿到空串。
- **读屏**：结果写进一个 `aria-live="polite"` 的区域，看不见屏幕的人也知道复制成没成。

## 怎么用

1. 拷 `.copy` 的 CSS 和按钮的 HTML（SVG 那段原样带上）。
2. 按钮放在哪都行：代码块标题栏里会去找同一块里的 `<pre>`；也可以用 `data-copy-text` 直接写要复制的内容（比如 API key、命令）。
3. 页面上放一个 `aria-live` 的空元素，脚本把结果写进去。

## 坑

- `navigator.clipboard` 只在 https 或 localhost 下有；本地双击打开的 `file://` 页面在有的浏览器里会失败，示例会走失败的样子。
- 内容要先 `fetch` 再复制时，Safari 要求在点击当下同步写剪贴板：用 `new ClipboardItem({ "text/plain": promise })`，或者提前把内容取回来。
- 连续快速点击要能重新播放：先移除类名、读一次 `offsetWidth` 触发重排，再加回去。
