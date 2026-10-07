---
title: 在 Hugo 文章里内嵌 CSS 动画 Demo
description: 用自定义 shortcode 在 Hugo 博客里直接运行 CSS 动画，无需 CodePen 账号，文章即 demo。
date: 2026-05-04
updated: 2026-07-30
lead: Hugo 用 shortcode 可以很优雅地内嵌代码演示。这里展示三种方式：
tags:
- Hugo
- CSS
- 动画
- Shortcode
categories:
- 折腾记录
---

先用一张图确定边界：原生 shortcode、CodePen iframe 和 CodeSandbox 分别适合不同复杂度，也把代码放在不同的执行与隔离位置。

![Hugo 文章嵌入交互 Demo 的三种方式](./hugo-embed-paths-bilingual-v1-4k.png "三条嵌入路径：简单且需要版本控制的效果优先用原生 shortcode；可分享片段适合 CodePen；完整交互应用再使用 CodeSandbox。")

## 1. 内联 CSS demo（无需外部服务）

直接在文章里跑一个旋转加载动画：

```html demo height=200 caption="纯 CSS 旋转加载器"
<style>
  .loader {
    width: 48px;
    height: 48px;
    border: 4px solid #e8e4de;
    border-top-color: #c44020;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
<div class="loader"></div>
```

一个渐变色文字动画：

```html demo height=160 caption="CSS 渐变文字"
<style>
  .gradient-text {
    font-size: 2rem;
    font-weight: 700;
    font-family: system-ui, sans-serif;
    background: linear-gradient(135deg, #c44020, #e8803a, #c44020);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 2s linear infinite;
  }
  @keyframes shimmer {
    to { background-position: 200% center; }
  }
</style>
<div class="gradient-text">ZhuoQi Dev</div>
```

## 2. 嵌入 CodePen

如果已有 CodePen 作品，用一行 shortcode 嵌入：

```
{{< codepen id="你的PenID" height="400" tab="result" >}}
```

## 3. 嵌入 CodeSandbox

React / Vue 组件用 CodeSandbox：

```
{{< codesandbox id="你的沙盒ID" height="450" view="preview" >}}
```

---

这三个 shortcode 覆盖了大多数代码展示场景，写博客基本不需要其他工具了。
