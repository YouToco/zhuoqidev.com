---
title: "大模型为什么没有记忆——67 条一手资料的交叉验证"
description: "覆盖 Anthropic / OpenAI / Google / Cursor 官方文档，Karpathy / LeCun / Raschka 原文，以及 MemGPT / Titans / Mamba-2 / Mem0 等关键论文的调研。"
date: 2026-05-04
lastmod: 2026-07-09
tags: ["AI Agent", "LLM", "记忆系统", "调研报告", "上下文工程"]
categories: ["调研报告"]
showToc: true
---

这不是一篇"AI 科普"——这是一次用 Exa / Tavily / Context7 / WebSearch 四源交叉验证，覆盖 **67+ 条一手资料** 的硬核调研。如果你在给 Agent 系统设计记忆层，或者想搞清楚 ChatGPT Memory / Claude Memory / Cursor Rules 到底是怎么回事，这篇是你要看的东西。

**→ [完整报告（含 14 产品对比表、记忆类型四分类、写入/冲突策略、评估 benchmark 全景、9 条工程结论、3 年范式演进地图）](/projects/llm-memory-research/)**

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

## 2026-07 更新：面向 Agent 架构师的深度补充

基于 6 路 Exa 深度研究，完整报告新增以下内容：

- **记忆类型的四分类**（CoALA 框架）：Working / Episodic / Semantic / Procedural——为什么"用同一个向量库服务四种不同需求"是最常见的设计错误
- **写入策略与冲突解决**：Mem0 ADD-only vs Zep 双时序 vs A-MEM 记忆进化三条路线对比
- **记忆生命周期管理**：衰减（指数衰减 + 半衰期分级）→ 合并（HDBSCAN + LLM 摘要）→ GC → Sleep-time Compute
- **检索质量工程**：三信号复合评分公式 + Contextual Retrieval（检索失败率降 49%）
- **存储选型**：向量库 / 知识图谱 / 关系库 / Markdown 的决策矩阵
- **多 Agent 共享记忆**：LangGraph / AutoGen / CrewAI / Mem0 + StateFuse / MemClaw 前沿研究
- **评估 benchmark 全景**：LoCoMo / LongMemEval / MemBench / MemoryAgentBench 等 8+ 个 benchmark
- **安全威胁模型**：从 prompt injection 扩展到环境注入投毒、潜伏式投毒、自我强化注入

**→ [查看完整报告](/projects/llm-memory-research/)**

## 最适合工程团队的 3 条结论

1. **Cache 和 Memory 概念正交但实现耦合**——Cache 跳过 prefill（省钱），Memory 决定 prompt 内容（涨能力），但记忆变更会导致 cache miss
2. **写 Memory 就是写 System Prompt**——markdown 文件（CLAUDE.md / Cursor Rules）永远比"让 AI 自己记"更可控、可 diff、可版本管理——但记忆量超过数百条时需引入结构化存储
3. **自主 Agent 需要自动化写入门控和冲突解决**——对有人在环路的产品，"AI 写 + 人审批"是最稳形态；对自主 Agent，需自动化 admission control + 冲突解决

---

**→ [查看完整报告：包含 Karpathy 权威访谈原文、记忆经济学分析、9 条工程实用结论、3 年范式演进地图](/projects/llm-memory-research/)**
