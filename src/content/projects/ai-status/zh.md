---
title: AI 厂商状态 — 一页看各家官方状态页
description: 把 OpenAI、Claude、Gemini、Mistral、Cohere、DeepSeek、Kimi、MiniMax 等官方状态页的当前状态汇到一页：每家一盏灯，点开看组件和进行中的故障；没有状态页的厂商也列出来、写明为什么。Cloudflare Pages 函数每分钟最多读一次各家，不调用任何模型。
date: 2026-10-27
glyph: status-board
---

接口突然报错时，第一个问题是「是我的问题，还是厂商的问题」。各家都有状态页，但要一个个打开；国内厂商有的有、有的没有，格式也各不一样。这一页把它们汇到一起。

[🚦 打开 AI 厂商状态](/status/)

## 它读什么

只读厂商自己公开的数据，不替它们测：

| 厂商 | 数据从哪来 |
| --- | --- |
| OpenAI、Claude、Mistral、Cohere、Kimi、MiniMax | 状态页的标准接口（`/api/v2/summary.json`） |
| DeepSeek | 状态页没有接口，从页面里带的数据读出组件和进行中的事件 |
| Gemini（Vertex AI） | Google Cloud 故障列表里 Vertex Gemini API 的条目 |
| Google AI Studio / Gemini API | 状态页只能在浏览器里看（数据走 Google 内部接口），只放链接 |
| xAI | 状态页拒绝程序读取，只放链接 |
| 智谱、阿里云百炼、火山方舟 | 没有公开的模型状态页，只放公告入口 |

每家的灯取它所有组件和进行中故障里最坏的那一档：正常、维护中、性能下降、部分故障、重大故障。读不到的显示「读取失败」，不会默认成绿灯。

## 怎么跑

页面是静态的，厂商名单和链接直接写在 HTML 里，不开 JavaScript 也能用。打开后浏览器请求 `api.zhuoqidev.com/api/ai-status`：这是一个 Cloudflare Pages 函数，同时去读各家，把结果统一成一种格式，在 Cloudflare 的缓存里放一分钟。所以不管多少人在看，每个机房每分钟最多去各家读一次；国内线的读者也走这个接口，不用自己去连海外的状态页。

## 局限

- 状态页只写厂商自己承认的故障，通常比用户感觉到的晚 10–30 分钟。
- 不覆盖某个地区、某个账号、某条中转线路的问题：灯是绿的，不等于你的请求一定成功。
- 故障描述保留厂商原文，不做翻译。
