---
title: "ChatGPT 有 Memory？Agent 工具不是 Cursor、Codex、Claude Code 这样的吗"
description: "用 Exa / Tavily / Context7 / WebSearch 四源交叉验证，覆盖 Anthropic / OpenAI / Google / Cursor 官方文档，Karpathy / LeCun / Raschka 等研究者原文，以及 MemGPT / Titans / Mamba-2 / Mem0 等关键论文。"
date: 2026-05-04
lastmod: 2026-07-09
tags: ["AI Agent", "LLM", "Memory", "记忆系统", "调研报告", "上下文工程"]
categories: ["调研报告"]
showToc: true
---

是的，ChatGPT 有 Memory，Claude 有 Memory，Cursor / Codex / Claude Code 这些 Agent 工具也都有各自的"记忆"系统。但**没有一个真的修改了模型权重**——所有"记忆"本质都是把结构化文本塞回 system prompt。这篇调研用 **67+ 条一手资料**交叉验证了这个结论，从架构约束到产品实现，彻底拆解 Agent 记忆系统的真相。

## 为什么这个问题值得花 67 条资料去研究

因为每个做 Agent 的人都会撞到这堵墙：

- ChatGPT 明明有 Memory，为什么还说"大模型没有记忆"？
- Cursor、Codex、Claude Code 这些 Agent 工具的"记忆"到底是怎么实现的？
- 为什么我让 AI 记住用户偏好，它过 10 轮就忘了？
- 为什么 Prompt Caching 不能替代 Memory？
- Mem0、Zep、Letta、LangGraph Store——到底选哪个？

答案在 Anthropic / OpenAI / Google 的官方文档、Karpathy 的公开访谈、以及 arXiv 论文里——但分散在 67 个不同的地方。这篇调研把它们串起来了。

---

## 一句话结论

所谓「大模型没有记忆」不是疏忽，而是 **Transformer O(n²) 注意力 + KV cache 显存 + 权重纠缠（灾难性遗忘）+ GDPR 合规** 四重约束的均衡解。ChatGPT / Claude / Cursor / Codex / Claude Code 的 "Memory" 本质都是**把结构化文本塞回 system prompt**，模型权重永远不动。Prompt Caching 只是性能优化，不是记忆。未来 1–3 年的主流是 **「无状态 LLM 内核 + 有状态 Agent 记忆层」** 混合架构。

| 计算复杂度 | 100M ctx 成本 | Cache 价格 | 主流 TTL |
|---|---|---|---|
| **O(n²)** | **638×H100** | **0.1×** | **5min–24h** |

---

## 1. 为什么 LLM 被设计成无状态

四个独立约束叠加，每一个单独都不致命，叠在一起就只剩"无状态"这一种工程解——这个结论来自对 67 条一手资料的交叉验证。

### 架构约束 · O(n²) 注意力

自注意力关于序列长度 n 的计算复杂度是 `O(n²)`，KV cache 显存随 n 线性增长但系数巨大——4096 token 单序列就要约 2 GB 显存，32 并发就 64 GB，比模型权重本身还大。Llama 3.1 在 100M token 上下文中，仅 KV cache 就需要 638 块 H100（约 ¥40,000/小时）。

→ Liu et al. "Lost in the Middle" (TACL 2024) 实证：长上下文不仅算得慢，模型对中段信息的利用呈 U 形曲线，比闭卷还差。

### 训练约束 · 灾难性遗忘

LLM 知识在数十亿权重里高度纠缠，没有"法语模块"或"用户偏好寄存器"可以独立写入。每次 fine-tune 都重塑整个参数景观，旧能力会被覆盖。即便是 LoRA，在 continual learning 场景下仍然受 catastrophic forgetting 困扰（arXiv 2404.16789）。

→ 业界普遍做法是周/天级别的离线 retrain，没人做 per-request 的在线权重更新。

### 合规约束 · 被遗忘权

GDPR 第 17 条和 PDPA 要求数据控制者"不得无故拖延"地删除个人数据。一旦个人数据烘焙进数十亿权重，"被遗忘权"在工程上几乎无法精确执行——你无法从模型中"减去"某个用户的影响。Anthropic 和 OpenAI 都明确表示 Memory 数据存储在外部、不在权重内，这不是技术选择，是法务硬约束。

→ RAG / Memory Layer 击败 fine-tuning 的根本原因是合规，不是技术优劣。

### 安全约束 · 持久记忆 = 持久攻击面

持久记忆的攻击面远不止 prompt injection。2025–2026 年的研究揭示了一个完整的威胁层级：

| 攻击类型 | 攻击方式 | 典型成功率 | 来源 |
|---|---|---|---|
| **Prompt Injection** | 通过 Google Doc / 图片让模型调用 `to=bio` 写入恶意指令 | — | Embrace The Red, 2024 |
| **环境注入投毒 (eTAMP)** | 仅通过浏览被篡改的产品页面污染 agent 记忆，跨站点生效 | GPT-5-mini 32.5% | arXiv 2604.02623 (预印本) |
| **潜伏式投毒 (Sleeper)** | 操纵外部文档使 agent 存储虚假记忆，可在多个后续对话中激活 | 写入率 99.8%，触发率 60-89% | arXiv 2605.15338 (预印本) |
| **自我强化注入 (Zombie)** | 在 RAG 记忆中累积约 240 个载荷副本，抗截断和摘要 | — | arXiv 2602.15654 (预印本) |

这正是 Cursor 1.0→1.2 给 Memories 强制加 user approval 的原因，也是 Anthropic 专门测试 sycophancy / harmful conversation 后才发布 Memory 的原因。

MPBench (arXiv 2606.04329, 预印本) 识别了 9 个结构性脆弱点：模型层（无法区分可信/不可信来源）、系统提示层（可被语义模仿绕过）、架构层（写入路径无验证、共享多源上下文无隔离）。SMSR (arXiv 2606.12703, 单作者预印本) 则提出了一个待验证但值得关注的论断：**仅在检索时运作、不具备写入时溯源的防御，无法对自适应攻击者提供有效安全保证**——安全必须从写入时开始。

{{< alert icon="circle-question" >}}

**Karpathy 的权威类比**：**权重 = ROM**（训练时烧入，静态）；**context window = RAM**（推理时活跃，可直接寻址）；**KV cache = working memory**（test-time 形成的工作记忆）；**外部 vector / KG store = disk**（持久但要 retrieve）。原话："权重里的知识是对训练时互联网文档的 hazy recollection；而 context window 里的内容是 directly accessible 的" — Andrej Karpathy, Dwarkesh Patel 专访 (2025-10)。

{{< /alert >}}

---

## 2. 主流产品的"记忆"策略对比（含 Cache vs Memory 辨析）

15 个主流产品，**没有任何一个真的修改了模型权重**。在这节我们同时辨析三个常被混为一谈的概念：

- **Cache**（KV / Prompt Caching）：缓存 attention 层的 K、V 投影张量，前缀逐 byte 匹配命中后跳过 prefill。生命周期 5min–24h。本质是算力优化，不是"记住"任何东西。
- **Memory**（产品层）：文本存储在外部数据库 / 向量库 / markdown 文件里，每次调用拼到 system prompt 头部。用户可控。
- **真模型记忆**（权重内）：改变模型权重本身。受灾难性遗忘、GDPR 被遗忘权、可解释性三重打击，业界普遍回避。

### 15 产品对比

| 产品 | 策略 | 本质 | 权重变? |
|---|---|---|---|
| **ChatGPT Memory** | 4 层: 元数据 + bio + ~40 条摘要 + 滑窗 | Memory | No |
| **OpenAI Codex** | AGENTS.md 项目指令 + 沙盒任务隔离 | Memory | No |
| _OpenAI Prompt Caching_ | ≥1024 token 自动 KV 缓存, 5min–24h TTL | Cache | No |
| _Anthropic Prompt Caching_ | 显式 `cache_control` ≤4 断点, 逐 byte 匹配 | Cache | No |
| _Gemini Context Caching_ | Implicit 90% 折扣 + Explicit 60min TTL | Cache | No |
| **Claude.ai Projects** | 项目说明 + 文件 + 历史, 全量塞 prompt | Memory | No |
| **Claude Memory** (2025-10) | 项目隔离, 24h 合成, 可视可编辑可导出 | Memory | No |
| **Claude Code** | CLAUDE.md + 模型自写 MEMORY.md (200 行) | Memory | No |
| **Cursor Rules / AGENTS.md** | 静态 markdown, 4 触发模式, Team > Project > User | Memory | No |
| **Cursor Memories** (1.0+) | AI 生成候选 → 用户审批 → 写入 | Memory | No |
| _Cursor Codebase Index_ | Merkle 树 + 加密 + Turbopuffer 向量库 | RAG | No |
| **Windsurf Cascade** | global + workspace rules + 自动 Memories + RAG | Memory | No |
| **Devin Knowledge** | 人写 + AI 建议 + DeepWiki + VM Snapshots | Memory+RAG | No |
| _Replit Checkpoints_ | VM 快照 = 文件 + DB + 对话 + Agent memory | Snapshot | No |

> 斜体行 = Cache/RAG/Snapshot 类；粗体行 = Memory 类。没有一个产品改权重。

{{< alert icon="bomb" >}}

**关键反向工程证据**：Manthan Gupta 三次实验证实：问 ChatGPT 一年前讨论过的具体话题，它**根本不知道**。ChatGPT Memory 没有用 RAG，存的只有：会话元数据 + 几十条 bio 条目 + 最近 ~40 个聊天的**用户消息摘要**（不存 ChatGPT 自己的回复）+ 当前滑窗。Cursor 官方文档第一句更直白：*"Large language models don't retain memory between completions. Rules provide persistent, reusable context at the prompt level."*

{{< /alert >}}

### 存储选型：向量库 vs 知识图谱 vs 关系库 vs 文件

上表的"本质"列背后隐藏着存储选型的架构权衡。不同存储后端决定了记忆系统的能力天花板：

| 存储方案 | 优势 | 天花板 | 适用场景 |
|---|---|---|---|
| **向量库** (Pinecone / Qdrant / Chroma) | 零冷启动、亚毫秒语义检索、通用内容类型 | 无关系推理、无时序模型、~5 万条后 top-k 质量退化 (Oxagen) | 早期原型、个人助手、记忆量 < 5万 |
| **知识图谱** (Neo4j / Graphiti-Zep) | 多跳推理原生、实体消歧、时序正确性 (+18.5%, Zep 论文) | 冷启动成本高、LLM 抽取开销大 | 实体关系密集型领域、需审计路径 |
| **关系数据库** | 精确查询、事务一致性、结构化状态 | 无语义检索、无关系遍历 | 精确事务查询（配置项、profile） |
| **Markdown 文件** | 人可读、可 diff、可版本控制 | 无实体解析、无多跳推理、无时序推理 | 项目规则、小规模偏好（< 数百条） |

**生产共识是混合方案**：起步用向量库 → 瓶颈时加图 → 规模化走混合（向量 + 图 + 关系库，通过规范化 ID 关联）。Letta 的"Is a Filesystem All You Need?"实验中 plain agent 文件方案得分 74.0%（高于 Mem0-Graph 68.5%），但一旦超出记忆量小、领域简单、不需实体关系的条件，文件方案就触顶。

→ Oxagen — Memory Architectures for AI Agents · Atlan — Vector Database vs Knowledge Graph · arXiv 2501.13956 (Zep 论文)

---

## 3. 未来范式：四层混合栈

自下而上：底层永远无状态，上面三层是"给它装记忆"的不同抽象。L4（Agent 记忆层）是短期主流，L2（架构内记忆）是最值得押注的研究跃迁。

### L4 · Agent 记忆层

{{< badge >}}商业最成熟{{< /badge >}}

把 LLM 视为无状态 CPU，"记忆"放在外部数据库 + Agent runtime，每次推理把检索结果拼回 prompt。代表：`Letta` (MemGPT) · `Mem0` · `Zep + Graphiti` · `LangGraph Store` · `AutoGen Memory`。

- ✅ 可审计 · 可删除 · 模型无关
- ⚠️ retrieval 质量决定上限 · 写入污染累积
- Mem0 在 LoCoMo benchmark 上比 OpenAI Memory 高 26%、p95 延迟降 91%、token 降 90%

#### 记忆类型的四分类（CoALA 框架）

Agent 记忆不是一个桶——**CoALA 论文** (Sumers, Yao, Narasimhan, Griffiths, 2023) 基于认知科学的 Tulving 分类，将 Agent 记忆划分为四种最小完备类型。2026 年综述 (arXiv 2602.06052) 进一步扩展为五类原子认知记忆系统。

| 类型 | 定义 | 存储策略 | 检索策略 | 代表实现 |
|---|---|---|---|---|
| **Working** | 当前任务的临时暂存区（推理轨迹、中间结果），context 刷新即消失 | Prompt 本身（in-context） | 隐式——模型读 prompt 即读 | LangGraph State, Letta core blocks |
| **Episodic** | 按时间索引的过去事件/交互记录，"发生了什么" | Append-only，向量库 + 时间索引 | Recency × Importance × Relevance 三信号加权 | Letta recall memory, Generative Agents memory stream |
| **Semantic** | 从经历中蒸馏的事实性知识，与具体事件脱耦，"世界是怎样的" | KV 存储 / 向量库 / 知识图谱，有 distillation gate 门控写入 | Key-based 快速查找 或 向量相似度 | Mem0 facts, CLAUDE.md, Letta archival |
| **Procedural** | 可复用的技能、动作序列和执行策略，"如何做某事" | 独立索引，键=任务描述 embedding，值=成功执行的代码/prompt | 新任务到达时按描述 embedding 检索 top-K | Voyager skill library, Claude Code Skills |

**最常见的设计错误是用同一种基础设施服务四种不同需求**——这是"my agent forgot"投诉的根源，即使数据在技术上仍然存在于 context 中。

**Procedural memory 是生产环境中实现最不充分的一层**。大多数"记忆"产品只有 episodic + semantic，缺乏 procedural。Voyager 在 Minecraft 中的 skill library 证明了 procedural memory 的复利效应：解锁独特物品多 3.3×，达到里程碑快 15.3×——procedural memory compounds，semantic memory does not。

→ CoALA (arXiv 2309.02427) · Generative Agents (arXiv 2304.03442, UIST 2023) · MemGPT (arXiv 2310.08560, ICLR 2024) · Voyager (arXiv 2305.16291) · Foundation Agent Memory Survey (arXiv 2602.06052, 预印本)

#### 写入策略与冲突解决

记忆不只是"读"的问题——**什么时候写、怎么处理冲突**，是 Agent 记忆系统最容易踩坑的工程决策。

**写入决策的 5 个正交维度**（Jatin Bansal）：(a) 是否写入（admission control 门控）→ (b) 写入形态（raw episode vs distilled fact）→ (c) 写入到哪个层级 → (d) 写入时机（同步 / session 结束 / 后台异步）→ (e) 冲突时如何处理。核心隐喻是 **WAL + Checkpoint**：日志式写入保留完整历史，检查点式写入生成合并快照，成熟系统两者兼用。

**冲突解决的三条路线**：

| 路线 | 代表 | 机制 | 适用场景 |
|---|---|---|---|
| **ADD-only + 检索排序** | Mem0 v3 | 矛盾记忆都保留，提取时捕获变迁（"User changed from A to B"），冲突在检索时由 recency + relevance 排序解决 | 小规模/个人助手 |
| **双时序边失效** | Zep / Graphiti | 每条 edge 携带 4 个时间戳（valid_at / invalid_at / created_at / expired_at），矛盾时标记旧 edge expired，支持 point-in-time 查询 | 企业级/复杂交互 |
| **记忆进化** | A-MEM (arXiv 2502.12110, 预印本) | 新记忆触发邻近旧记忆的 keywords/tags 更新，模拟"新知识重塑旧理解"，token 消耗仅 ~1.2K（vs MemGPT ~17K） | 自组织知识网络 |

{{< alert icon="bomb" >}}

**Mem0 v2→v3 的教训**：v2 采用"Latest Truth Wins"——LLM 判定冲突后执行 UPDATE 覆盖旧值。但实践中发现 **LLM 执行 UPDATE 时会 hallucinate**，把新值替换回旧值（Mem0 PR #4903）。v3 彻底转向 ADD-only 架构，时序推理在 LoCoMo 上提升 +29.6%。

{{< /alert >}}

→ Jatin Bansal — Memory Write Policies · Mem0 v2→v3 迁移文档 · Zep — Beyond Static Graphs · A-MEM (arXiv 2502.12110)

#### 记忆生命周期管理

L4 节的 ⚠️ "写入污染累积"不是一句警告就能解决的——生产系统需要完整的衰减 → 合并 → GC 流程。

**衰减（Decay）**：几乎所有生产系统收敛到指数衰减 `S(t) = S₀ × e^(-λt)`，半衰期按记忆类型分级——对话上下文 7–14 天、事实知识 60–90 天、身份信息 6–12 月。每次成功检索重置 `last_read_at`，常用记忆免于衰减（类似 OS 的 LRU 策略）。

**合并（Compaction）**：TypeGraph 给出三步流程——(1) HDBSCAN 聚类检测碎片记忆 → (2) LLM 生成合并摘要（解决矛盾、去除冗余）→ (3) 原始碎片归档（不删除，保留审计能力），插入合并记忆。Generative Agents 的"反思"机制本质上就是 episodic → semantic 的蒸馏式 compaction。

**垃圾回收（GC）**：衰减阈值淘汰（score < 0.01）、TTL 过期、supersede 链（新事实替代旧事实后旧记忆降权至 0.1）。

**Sleep-time Compute**：将上述流程从 test-time 移到后台执行。Lin et al. (arXiv 2504.13171) 证明 sleep-time 可将达到相同准确率的 test-time 计算降低约 **5×**。Letta 实现了 primary + sleep-time 双 agent 架构——primary 处理用户交互（只读共享记忆），sleep-time agent 后台执行 consolidation / pre-compute / GC（对共享记忆有独占写权限），每 N 步触发。Claude Code 的 auto-dream 在 24h 活动+5 个新会话后触发四阶段整理周期。

→ Sleep-time Compute (arXiv 2504.13171) · Letta Sleep-time 文档 · TypeGraph — Agent Memory Decay & Consolidation

#### 检索质量工程

"retrieval 质量决定上限"——具体怎么提升？几乎所有生产系统收敛到一个**三信号加权评分公式**：

```
composite_score = w_semantic × similarity + w_recency × recency + w_importance × importance
```

默认权重因场景浮动——客服 agent importance 0.4、研究 agent relevance 0.6、个人助手 recency 0.4。**归一化至关重要**：cosine similarity 通常聚集在 0.5–0.8 窄带，不做 per-batch min-max 归一化，动态范围最大的信号会淹没其他。

**提升检索质量的四个杠杆**：

1. **Contextual Retrieval**（Anthropic 2024.9）——在每个 chunk 前添加 LLM 生成的 50-100 token 上下文摘要再 embed，检索失败率降低高达 **49%**，结合 reranking 达 67%
2. **Hybrid Search**（Dense + Sparse）——并行 embedding ANN + BM25 词法搜索，用 Reciprocal Rank Fusion 合并
3. **Cross-encoder Reranking**——先 ANN 召回 top-50（快但粗），再精排到 top-10（准但慢）
4. **Late Chunking**（Jina AI, arXiv 2409.04701）——先 embed 全文档再切分，每个 chunk 保留文档级上下文

→ Anthropic — Contextual Retrieval · ChangeGamer — RAG Retrieval for Agents · Jatin Bansal — Memory Retrieval Policies

### L3 · 超长上下文

{{< badge >}}已商业化{{< /badge >}}

把记忆塞进超长 context window。代表：Gemini 2M (needle 召回 >99%) · Magic LTM-2-Mini 100M tokens。

- ✅ 会话内最佳载体
- ⚠️ Lost-in-the-middle 仍未解 · 100M ctx 单用户 638×H100

**L3 和 L4 是互补不是替代**：超长上下文处理会话内的即时关联，Agent 记忆层处理跨会话/跨年的持久记忆。将两者组合是当前工程上的最优解。

### L2 · 架构内记忆

{{< badge >}}研究价值最高{{< /badge >}}

把"持久记忆"做成可微模块嵌入网络——这可能是真正改写格局的方向。代表：Google `Titans` (短期 attention + 长期 neural memory) · `Infini-attention` · `Mamba-2` · `RWKV-7 Goose`。

- ✅ 常数显存 · 线性时间
- ⚠️ 尚未规模化验证（需 ≥70B / ≥10T token 训练才能证明可行性）

### L1 · 裸 LLM（frozen weights）

{{< badge >}}永远无状态{{< /badge >}}

GPT / Claude / Gemini / Llama 内核。每次推理是新进程，权重不变。Continual learning 短期内不会成为 per-user 记忆主路。LoRA 用于领域/角色特化，不是 per-user。

### 多 Agent 共享记忆

上述四层栈完全是单 Agent 视角。当多个 Agent 协作时，**记忆共享**成为 day-1 问题——一致性模型、权限隔离、记忆归属都需要独立设计。

**当前各框架的共享机制**：

| 框架 | 共享机制 | 一致性模型 | 成熟度 |
|---|---|---|---|
| **LangGraph** | 共享 State + Store (namespace-based) | Optimistic Concurrency（版本化 checkpoint，冲突时重试） | 高 |
| **AutoGen** | GroupChat 消息广播 + Context Variables | 无显式一致性（RFC #7748 提议 eventual consistency） | 中低 |
| **CrewAI** | Task output 传递 + Flows state | 无原生 pub-sub | 中低 |
| **Mem0** | 框架无关的四维 scoping (user_id / agent_id / run_id / app_id) | Eventual consistency | 中 |

**前沿研究（均为 2026 年预印本，尚未经同行评审）**：

- **StateFuse** (arXiv 2607.05844)：基于 CRDT 的 conflict-preserving memory contract。实验表明 conflict-preserving surfaces 的 false-confident actions 为 0%（vs collapsed surfaces 40%）
- **MemClaw** (arXiv 2606.24535)：将多 Agent 记忆形式化为 governed distributed-systems problem，识别四种 failure mode——unauthorized leakage、stale propagation、contradiction persistence、provenance collapse

**成熟度评估**：该领域仍处于早期探索。AutoGen 的跨 Agent 共享记忆仍在 RFC 阶段（GitHub #7748），StateFuse / MemClaw 刚发表。Mem0 将这个阶段称为 **"memory engineering"** 的诞生——一个与 prompt engineering、context engineering 并列的新工程学科。单 Agent 记忆已 largely solved，多 Agent 共享是下一个硬问题。

→ Mem0 — Multi-Agent Memory Systems · LangGraph Stores 文档 · AutoGen RFC #7748

---

## 4. 记忆评估：不只是 LoCoMo

Mem0 在 LoCoMo 上比 OpenAI Memory 高 26%——但 LoCoMo 只是冰山一角。2024–2026 年涌现了多个评估 benchmark，覆盖不同维度：

| Benchmark | 规模 | 侧重维度 | 关键发现 |
|---|---|---|---|
| **LoCoMo** (ACL 2024) | 10 对话, ~9K tok | 5 类 QA（单跳/多跳/时序/常识/对抗） | Backboard 90.0% > 人类 87.9% |
| **LoCoMo-Refined** (2026) | 1,382 问 | 更严格 LLM 裁判（一致率 86% vs 原版 44%） | 各系统得分下降 15-22 pp |
| **LoCoMo-Plus** (ACL 2026) | — | **认知记忆**（cue-trigger 语义断连） | 所有方法均大幅下降，认知记忆仍是开放问题 |
| **LongMemEval V1** (ICLR 2025) | 500 问, 115K-1.5M tok | 信息抽取/多 session 推理/时序/弃权 | 商业系统仅 30-70%；Zep 71.2% vs GPT-4o 60.2% |
| **LongMemEval V2** (2026) | 451 问, 115M tok | Web Agent 记忆，引入 LAFS（延迟-准确率前沿） | 最佳 RAG 48.5%, AgentRunbook 74.9% |
| **MemBench** (ACL 2025 Findings) | 100K+ tok | 事实性+反思性，双场景（参与/观察） | 4 维指标：准确率/召回率/容量/延迟 |
| **MemoryAgentBench** (2025) | 2,071 问, 103K-1.44M | 精确检索/测试时学习/长程理解/**选择性遗忘** | 增量多轮交互（vs 一次性给全部上下文） |

**评估维度覆盖矩阵**：事实召回（LoCoMo, LME）、多跳推理（LoCoMo, LME）、时序推理（LoCoMo, LME）、知识更新（LME, MAB）、弃权能力（LME, LoCoMo-Plus）、认知记忆（LoCoMo-Plus）、容量上限（MemBench）、读写延迟（MemBench, LME-V2）、端到端任务完成率（LME-V2）。

→ LoCoMo (github.com/snap-research/locomo) · LongMemEval (github.com/xiaowu0162/LongMemEval) · MemBench (github.com/import-myself/Membench) · MemoryAgentBench (arXiv 2507.05257)

---

## 5. 记忆经济学：为什么 Cache TTL 是隐藏定价开关

这条暗线在全篇中最被低估。

Anthropic 在 2026-03 把默认 cache TTL 从 1h **静默降到 5min**，导致 Claude Code 用户实测多花 17–26%。没有任何公告，没有 SLA 承诺。这条改变暴露了一个残酷的事实：**cache TTL 是直接影响用户单价、但不在任何 SLA 上的隐藏开关**。

| 指标 | 数值 |
|---|---|
| Anthropic TTL 调整后成本上浮 | **17–26%** |
| Cache 费用占比透明度 | **0%（完全隐藏）** |
| 100M ctx 硬件成本（单用户） | **~¥40k/小时** |
| SLA 中 cache TTL 承诺 | **0 条** |

如果推演下去：未来的"记忆经济学"会越来越像云存储——**分层**（5min/1h/24h/永久）、**可定价**（微调 TTL 就是反向定价）、**可锁定**（agent 工作流依赖特定 cache 策略后迁移成本极高）。

---

## 6. 3 年范式演进地图

基于 Anthropic、Letta、Karpathy、LeCun 等来源的判断。2026 年主流配置有较高确信，2027–2028 为推断，含不确定性。

| 年份 | 工业主流配置 | 可能的黑马事件 | 架构师该做什么 |
|---|---|---|---|
| **2026** | 裸 LLM + Agent 记忆层 (Mem0/Zep/Letta) + 长上下文 caching | Titans 系架构开始小规模商用；Sleep-time Compute 成 agent 标配 | 基于 StorageAdapter 模式构建可插拔记忆层；溯源元数据从 day-1 内建；四类记忆分别存储 |
| **2027** | Reflection / Sleep-time / TTT 进入主流 Agent 框架原语 | 某 SSM/Hybrid 7B 在 long-context benchmark 全面超 Transformer | 预留 sleep-time compute 集成点；记忆 API 支持 batch consolidation |
| **2028** | 顶级模型可能集成 in-arch memory module（高风险预测）；否则 Memory Layer 仍是标配 | LeCun H-JEPA + LLM 混合原型出现（5–10 年的早期信号） | 确保 remember / recall / forget 接口可路由到模型内部 API |

**可插拔架构参考**：PlugMem (arXiv 2603.03296, 预印本) 提出以知识单元（命题和规程）而非原始文本作为记忆基本单位，底层存储可替换。MemFactory (arXiv 2603.29493, 预印本) 设计了四层解耦架构（Module → Agent → Environment → Trainer），每层可独立替换。核心接口抽象：`remember()` / `recall()` / `forget()` 三个语义操作——当 L2 模型原生支持记忆时，将调用路由到模型内部而非外部存储。

{{< alert icon="circle-info" >}}

**2028 预测需谨慎**：Titans 等架构内记忆方案需要 ≥70B 参数、≥10T token 训练才能规模化验证，目前仅在 arXiv。2028 年更可能的场景是 Agent 记忆层和架构内记忆共存，而非后者取代前者。

{{< /alert >}}

---

## 7. 给工程师的 9 条实用结论

1. **Cache 和 Memory 概念正交但实现耦合**：Cache 是算力优化（跳过 prefill），Memory 是产品层决定把什么塞进 prompt——概念上完全正交。但工程上它们紧密耦合：记忆内容的任何变更都可能导致 prompt prefix mismatch → cache miss → 全量 prefill → 成本上浮。这正是 Claude Code 强调"cache-safe forking"的原因。

2. **写记忆就是写 system prompt**：凡是能用 markdown 写下来的项目约定（Cursor Rules / `CLAUDE.md` / AGENTS.md），永远比"让 AI 自己记"更可控、可 diff、可版本管理。但 markdown 方案在记忆量超过数百条、需要实体关系或时序推理时触顶——此时需要引入结构化存储（向量库 / 知识图谱）。

3. **拼前缀顺序: static → dynamic**：工具定义、System prompt、项目规则放最前；当前用户输入放最后。OpenAI / Anthropic / Google 三家文档的一致顶级建议。

4. **Compaction 必须 cache-safe**：不要为 summarization 单开新 system prompt——会让全长对话按 uncached 全价重算。Claude Code 称之为 "cache-safe forking"。

5. **TTL 是产品决策不只是工程参数**：Anthropic 1h→5min TTL 事件的教训。把 TTL 作为可配置项暴露给用户，否则用户会在账单里发现你的隐藏定价。

6. **自主 Agent 需要自动化写入门控和冲突解决**：对有人在环路的产品（Cursor、Devin），"AI 写 + 人审批"是最稳形态。但对自主 Agent，需要自动化的 admission control（轻量模型做 triage 分类）+ 冲突解决（ADD-only / bi-temporal / memory evolution）。核心原则：**每次写入都是对未来所有读取的税收**——宁可少存高质量 fact，不要多存低价值噪声。

7. **可视、可编辑、可导出 = trust**：Anthropic 的 "natural language synthesis" 差异化和 ChatGPT 不透明合成，正反两面证明了这点。

8. **隐私模式与 Cache 有矛盾**：OpenAI Extended cache 失去 ZDR 资格、Cursor 隐私模式不存原文——把"性能 vs 隐私"作为两档让用户选。

9. **上下文工程是护城河——但需要方法论**：把记忆写成 deterministic、version-controlled、人类可读的状态，curation cost 是一次性的，benefit 是 compounding 的。具体方法论：**Token 预算显式分配**（输出预留 10% → system prompt 15% → 对话历史 30% → 检索内容 45%，依场景浮动）+ **四策略管理**（Write 写出到 scratchpad / Select 复合评分选入 / Compress 阈值触发摘要 / Isolate 拆到子 Agent 独立窗口）。

→ Anthropic — Effective Context Engineering · Lance Martin — Agent Context Engineering 四策略

---

## 8. 关键引用源

全部为 2024–2026 年一手资料。共 50+ 条精选，涵盖原厂文档、arXiv 论文、研究者原文。

### A. 厂商一手资料

**OpenAI**
- [OpenAI Prompt Caching guide](https://developers.openai.com/docs/guides/prompt-caching) — KV cache 工作原理 + TTL + retention policy
- [OpenAI Prompt Caching 201 cookbook](https://developers.openai.com/cookbook/examples/prompt_caching_201/) — Extended cache 与 ZDR 的关系
- [Manthan Gupta · I Reverse Engineered ChatGPT's Memory](https://manthanguptaa.in/posts/chatgpt_memory/) — 4 层结构反向工程
- [Embrace The Red · ChatGPT Hacking Memories](https://embracethered.com/blog/posts/2024/chatgpt-hacking-memories/) — bio 工具与 prompt injection 攻击面

**Anthropic**
- [Anthropic Prompt Caching docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — cache_control / 5min vs 1h / 4 breakpoints
- [Lessons from building Claude Code](https://claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything) — cache-safe forking 实践
- [Claude Code Memory docs](https://docs.anthropic.com/en/docs/claude-code/memory) — CLAUDE.md vs auto memory
- [How does Claude's memory work](https://support.anthropic.com/en/articles/11817273-how-does-claude-s-memory-work) — RAG 工具调用 + 24h synthesis + 项目隔离
- [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — 上下文工程方法论

**Google**
- [Gemini API Context Caching](https://ai.google.dev/gemini-api/docs/caching) — implicit vs explicit、TTL、storage 计费
- [Vertex AI Context caching overview](https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview) — 90% 折扣 + 跨租户隔离

**Cursor / Codex / Windsurf / Devin / Replit**
- [Cursor Rules](https://cursor.com/docs/context/memories) + [Codebase Indexing](https://cursor.com/docs/context/codebase-indexing) + [1.0 changelog](https://www.cursor.com/changelog/1-0) + [1.2 changelog](https://cursor.com/en/changelog/1-2)
- [OpenAI Codex](https://openai.com/index/introducing-codex/) — AGENTS.md 项目指令 + 沙盒隔离
- [Windsurf Cascade Memories](https://docs.windsurf.com/windsurf/cascade/memories) — 5 层 context 拼接
- [Devin Knowledge](https://cognitionai.mintlify.app/product-guides/knowledge) — 人写 + AI + DeepWiki + VM Snapshots
- [Replit Checkpoints](https://docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks) — VM + DB + AI 对话快照

### B. 关键论文（已发表 / 高权威）

**架构 / 长上下文**
- [Lost in the Middle (TACL 2024)](https://arxiv.org/abs/2307.03172) — U 形曲线实证
- [Gemini 1.5 Technical Report](https://arxiv.org/abs/2403.05530) — 1M-10M token 标杆
- [Magic LTM-2-Mini](https://magic.dev/blog/100m-token-context-windows) — 100M token, 比 attention 省 1000× FLOPs
- [Titans: Learning to Memorize at Test Time](https://arxiv.org/abs/2501.00663) — Google neural memory module
- [Infini-attention](https://arxiv.org/abs/2404.07143) — Compressive memory, 1B 模型 5K → 1M passkey
- [Mamba-2 / SSD (ICML 2024)](https://proceedings.mlr.press/v235/dao24a.html) + [RWKV-7 Goose](https://arxiv.org/abs/2503.14456) + [KV-Direct](https://www.arxiv.org/pdf/2603.19664)

**Memory Layer / Agent 记忆（高权威）**
- [CoALA (arXiv 2309.02427)](https://arxiv.org/abs/2309.02427) — Agent 记忆四分类框架，Griffiths h-index 99
- [Generative Agents (UIST 2023)](https://arxiv.org/abs/2304.03442) — Memory stream + reflection + 三信号检索
- [MemGPT (ICLR 2024)](https://arxiv.org/abs/2310.08560) — OS 虚拟内存分层模型
- [Voyager](https://arxiv.org/abs/2305.16291) — Procedural memory (skill library) 标杆
- [Mem0](https://arxiv.org/abs/2504.19413) · [Zep + Graphiti](https://arxiv.org/abs/2501.13956) — 商业记忆层
- [Sleep-time Compute](https://arxiv.org/abs/2504.13171) — Stoica h-index 134，test-time 降 5×

**Continual Learning**
- [Continual Learning of LLMs Survey](https://arxiv.org/abs/2404.16789) · [TTT (ICML 2025)](https://proceedings.mlr.press/v267/akyurek25a.html) · [Memory Survey](https://arxiv.org/abs/2505.00675)

**评估 Benchmark**
- [LoCoMo (ACL 2024)](https://github.com/snap-research/locomo) — 5 类 QA 记忆评估
- [LongMemEval (ICLR 2025)](https://github.com/xiaowu0162/LongMemEval) — 5 项核心能力 + 可扩展历史
- [MemBench (ACL 2025 Findings)](https://github.com/import-myself/Membench) — 事实性+反思性双场景
- [MemoryAgentBench](https://arxiv.org/abs/2507.05257) — 增量多轮交互评估

### C. 预印本 / 前沿探索（未经同行评审）

以下论文均为 2026 年预印本，引用时请注意标注"未经同行评审"。

- [A-MEM](https://arxiv.org/abs/2502.12110) — Zettelkasten 式记忆进化
- [Foundation Agent Memory Survey](https://arxiv.org/abs/2602.06052) — 五类原子认知记忆综述（60 位作者）
- [MPBench](https://arxiv.org/abs/2606.04329) — 记忆投毒 9 脆弱点系统研究
- [eTAMP](https://arxiv.org/abs/2604.02623) — 环境注入记忆投毒
- [Sleeper Memory](https://arxiv.org/abs/2605.15338) — 潜伏式记忆投毒
- [Zombie Agents](https://arxiv.org/abs/2602.15654) — 自我强化注入
- [SMSR](https://arxiv.org/abs/2606.12703) — 记忆投毒认证防御（单作者）
- [StateFuse](https://arxiv.org/abs/2607.05844) — CRDT conflict-preserving memory
- [MemClaw](https://arxiv.org/abs/2606.24535) — Governed shared memory
- [PlugMem](https://arxiv.org/abs/2603.03296) — 可插拔记忆模块
- [MemFactory](https://arxiv.org/abs/2603.29493) — 统一记忆训练推理框架

### D. 范式判断 (Karpathy / LeCun / Raschka)

- [Andrej Karpathy · Dwarkesh Patel 专访 (2025-10)](https://www.dwarkeshpatel.com/p/andrej-karpathy)
- [Karpathy · Intro to LLMs](https://www.youtube.com/watch?v=zjkBMFhNj_g)
- [Yann LeCun · A Path Towards AMI](https://openreview.net/pdf?id=BZ5a1r-kVsf)
- [LeCun at NVIDIA GTC 2025](https://www.endofmiles.net/lecun-says-hes-not-so-interested-in-llms-anymore)
- [Sebastian Raschka · Coding the KV Cache](https://sebastianraschka.com/blog/2025/coding-the-kv-cache-in-llms.html)

### E. 工业框架 / 工程实践

- [LangGraph Persistence & Memory](https://docs.langchain.com/oss/python/langgraph/persistence)
- [AutoGen Memory & RAG](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/memory.html)
- [Letta Research](https://www.letta.com/research) + [Sleep-time 文档](https://docs.letta.com/guides/agents/architectures/sleeptime/)
- [Don't Break the Cache (arXiv 2601.06007)](https://arxiv.org/abs/2601.06007v2)
- [ctx.ist · Context Determinism Thesis](https://ctx.ist/thesis/)
- [Jatin Bansal — Memory Write Policies](https://jatinbansal.com/ai-engineering/memory-write-policies/) + [Retrieval Policies](https://jatinbansal.com/ai-engineering/memory-retrieval-policies/)
- [Lance Martin — Agent Context Engineering](https://rlancemartin.github.io/2025/06/23/context_engineering/)
- [Oxagen — Memory Architectures for AI Agents](https://www.oxagen.ai/blog/memory-architectures-for-ai-agents)
- [Mem0 — Multi-Agent Memory Systems](https://mem0.ai/blog/multi-agent-memory-systems)
- [Microsoft — Agent 记忆安全指南](https://learn.microsoft.com/en-us/security/zero-trust/sfi/manage-agentic-memory-safety)

---

*调研方法：三路并行子代理（技术原理 + 产品 API 设计 + 未来范式），交叉验证四个信息源（Exa、Tavily、Context7、WebSearch）。共 67+ 条一手 URL，时效 2024-Q1 至 2026-Q2。2026-07 更新：补充记忆类型分类、写入/冲突策略、多 Agent 共享、生命周期管理、检索质量工程、存储选型、评估 benchmark 全景、安全威胁模型、上下文工程方法论等内容，基于 6 路 Exa 深度研究。*
