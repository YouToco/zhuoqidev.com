---
title: "用 Hugo 和双栈 CDN 搭建个人网站"
description: "记录如何用 Hugo + Blowfish，通过阿里云 OSS/CDN（国内）+ Cloudflare Pages（国际）实现双栈加速，备案、DNS 分线路解析一次走通。"
date: 2026-05-04
tags: ["Hugo", "阿里云", "Cloudflare", "CDN", "ICP备案"]
categories: ["折腾记录"]
showToc: true
ShowReadingTime: true
cover:
  image: ""
  alt: "ZhuoQi Dev 网站架构"
---

## 为什么选 Hugo

做个人博客选框架，我的第一标准是**维护成本低**——不想三个月后因为 npm 依赖地狱放弃写作。

Hugo 是单二进制文件，无需 Node.js，构建几千篇文章只需 1-2 秒，Blowfish 主题开箱就有暗色模式、全文搜索、多语言、RSS、Open Graph、阅读时间估算。日常写作只需碰 Markdown。

## 整体架构

```
                  ┌─────────────────────────────┐
                  │       DNS 分线路解析          │
                  │   (阿里云云解析 GeoDB)        │
                  └──────┬──────────────┬────────┘
                         │              │
              国内访客    ▼    国际访客  ▼
          ┌──────────────────┐  ┌─────────────────┐
          │  阿里云 CDN      │  │ Cloudflare Pages │
          │  ↓               │  │  (免费，全球CDN) │
          │  阿里云 OSS      │  └─────────────────┘
          │  (静态托管)      │
          └──────────────────┘
                  ↑
        GitHub Actions 自动构建 & 双栈推送
```

这套方案全年花费约 ¥212：
- 域名 `zhuoqidev.com`：¥85/年（已买 3 年）
- 函数计算资源包（ICP 备案载体）：¥101/年（¥126 年包叠加 8 折优惠）
- 阿里云 CDN 100GB 流量包：¥20/年
- OSS 存储：~¥6/年
- Cloudflare Pages：¥0

## ICP 备案那些事

国内域名备案需要"备案载体"（服务器 IP）。不买服务器的话，阿里云**函数计算资源包**（¥101/年）可以作为备案载体，拿到备案服务码。

备案周期：阿里云初审 1-5 个工作日 + 管局审核 10-20 个工作日，整体约 3-6 周。等备案期间正好把网站搭完。

## DNS 分线路解析

阿里云云解析免费版支持"境内/境外"两条线路：
- 境内 → 阿里云 CDN CNAME
- 境外（默认）→ Cloudflare Pages CNAME

这样国内用户走备案过的阿里云节点，海外用户走 Cloudflare 免费全球 CDN，一套域名两套加速。

## 部署流程

推送到 GitHub → Actions 自动 `hugo build` → 并行上传到 OSS 和 Cloudflare Pages。

整个流程大约 2-3 分钟，文章发布基本无感。

---

后续文章会深入 Agent 架构设计、记忆层选型、多 Agent 编排等话题。
