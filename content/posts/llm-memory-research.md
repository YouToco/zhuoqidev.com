---
title: "大模型为什么没有记忆——67 条一手资料的交叉验证"
description: "覆盖 Anthropic / OpenAI / Google / Cursor 官方文档，Karpathy / LeCun / Raschka 原文，以及 MemGPT / Titans / Mamba-2 / Mem0 等关键论文的调研。"
date: 2026-05-04
tags: ["AI Agent", "LLM", "Memory", "调研报告", "上下文工程"]
categories: ["调研报告"]
showToc: true
---

这不是一篇"AI 科普"——这是一次用 Exa / Tavily / Context7 / WebSearch 四源交叉验证，覆盖 **67 条一手资料** 的硬核调研。如果你在给 Agent 系统设计记忆层，或者想搞清楚 ChatGPT Memory / Claude Memory / Cursor Rules 到底是怎么回事，这篇是你要看的东西。

**→ [完整报告（含 14 产品对比表、9 条工程结论、3 年范式演进地图）](/projects/llm-memory-research/)**

---

## 一句话结论

所谓「大模型没有记忆」不是疏忽，而是 **O(n²) 注意力 + KV Cache 显存 + 灾难性遗忘 + GDPR 合规** 四重约束的均衡解。ChatGPT / Claude / Cursor 的 "Memory" 本质都是把结构化文本 **塞回 system prompt**，模型权重永远不动。未来 1–3 年的主流是 **「无状态 LLM 内核 + 有状态 Agent 记忆层」** 混合架构。

## 为什么这个问题值得花 67 条资料去研究

因为每个做 Agent 的人都会撞到这堵墙：

- 为什么我让 AI 记住用户偏好，它过 10 轮就忘了？
- 为什么 Prompt Caching 不能替代 Memory？
- 为什么所有产品都说有"记忆"，但没有一个改模型权重？
- Mem0、Zep、Letta、LangGraph Store——到底选哪个？

这些问题在 Anthropic/OpenAI/Google 的官方文档、Karpathy 的公开访谈、以及 arXiv 论文里都有答案——但分散在 67 个不同的地方。这篇调研把它们串起来了。

## 4 层记忆栈

自下而上：

- **L1 · 裸 LLM（冻结权重）**：永远无状态，每次推理是新进程
- **L2 · 架构内记忆**：Titans / Infini-attention / Mamba-2，最具研究价值，但尚未规模化验证（需 ≥70B / ≥10T token）
- **L3 · 超长上下文**：Gemini 2M、Magic 100M，会话内关联的最佳载体，但 O(n²) 天花板仍在
- **L4 · Agent 记忆层**：外部数据库 + Agent Runtime，商业最成熟，Mem0 / Zep / Letta / LangGraph Store

**→ [完整四层栈分析 + 14 产品对比表](/projects/llm-memory-research/#2-主流产品的记忆策略对比含-cache-vs-memory-辨析)**

## 最适合工程团队的 3 条结论

1. **不要把 Cache 和 Memory 混为一谈**——Cache 跳过 prefill（省钱），Memory 决定 prompt 内容（涨能力），完全正交
2. **写 Memory 就是写 System Prompt**——markdown 文件（CLAUDE.md / Cursor Rules）永远比"让 AI 自己记"更可控、可 diff、可版本管理
3. **AI 写 + 人审批 = 当前最稳的自动 Memory 形态**——Cursor 1.2 加 user approval、Devin 默认走 suggestion 流，是被反复 prompt injection 教训后的共识

---

**→ [查看完整报告：包含 Karpathy 权威访谈原文、记忆经济学分析、9 条工程实用结论、3 年范式演进地图](/projects/llm-memory-research/)**
