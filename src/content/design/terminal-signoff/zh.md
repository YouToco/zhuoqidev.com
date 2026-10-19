---
title: "开场 / 告别终端"
summary: "页脚是一段终端会话：see you、联系方式、fortune、exit 逐行打出来；另附一段首访开机动画。"
category: motion
origin: original
stack: [html, css, js]
tags: [终端, 页脚, 打字机, 开场动画]
order: 30
files: [index.html]
demoHeight: 640
added: 2026-10-14
---

## 看点

- **页脚当成一次告别**：每页结尾都是同一段 shell 会话，`echo "see you"` → `cat contact.md`（联系方式）→ `fortune`（一句话）→ `exit`，最后一行 `[Process completed]` 用荧光黄标出来。
- **一台笔记本**：终端就是屏幕（10px 深色边框当屏幕边），下面一条 `::after` 画的浅色机身，中间一个径向渐变的「开盖凹口」。机身比屏幕宽 7%，`overflow-x: clip` 保证手机上不撑出横向滚动。
- **打字机靠 CSS**：命令行用 `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)` 配 `steps(字数)`，一格一格露出来；输出行淡入上移。JS 只做一件事：给每行算好开始时间 `--d` 和字数 `--n`。
- **第一次滚到才播**：`IntersectionObserver` 看到页脚 30% 进入视口才加 `.play`，笔记本同时「开盖」（绕底边 `rotateX`）。
- **开场动画**：同一套行动画先打出 `whoami` / `ls` / `open`，进度条走满后整块放大 7 倍淡出，像镜头穿过屏幕进到页面里；任意点击、按键、滚轮都能跳过。
- **扫描线**：终端上盖一层 1px 间隔的半透明横纹，像旧显示器，几乎看不出来但有味道。

## 怎么用

1. 拷 `.laptop`、`.terminal`、`.tty`、`.ln` 几段 CSS 和三个 `@keyframes`（`ln-in`、`ln-type`、`lid-open`）。
2. 每行写成 `<p class="ln cmd">`（命令）或 `<p class="ln o">`（输出），多加一段空隙用 `.gap`。
3. 拷 `cue()` 和 `IntersectionObserver` 那段脚本。想更克制：页面短到一打开就看得到页脚时，干脆不播，直接显示完成状态。
4. 开场动画只在首页、第一次访问、宽屏时播：在 `<head>` 里用内联脚本判断（读 `localStorage` 标记）并给 `<html>` 加类，这样不会先闪一下正文；再加一个几秒的保底定时器，主脚本没跑起来也会自动撤掉遮罩。

## 坑

- 命令行必须 `width: fit-content`，否则 `clip-path` 按整行宽度切，打字速度和字数对不上。
- 字数要按折叠空白后的文本算（`textContent.replace(/\s+/g, " ")`），格式化工具把标签换行后，原始 `textContent` 会多出一堆空格。
- 隐藏未播放的行要用「JS 加上 `.armed` 才隐藏」，不要默认 `opacity: 0`：没 JS、开了「减少动态效果」的人才能直接看到完整内容。
- 开场的跳过监听要在点击按钮之后再挂（`setTimeout` 推迟一拍），不然触发它的那次点击会立刻把它跳过。
- 扫描线那层 `::after` 盖在整个终端上，必须 `pointer-events: none`，否则终端里的链接点不动。
