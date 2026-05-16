---
title: "大模型为什么没有记忆——67 条一手资料的交叉验证调研"
description: "用 Exa / Tavily / Context7 / WebSearch 四源交叉验证，覆盖 Anthropic / OpenAI / Google / Cursor 官方文档，Karpathy / LeCun / Raschka 等研究者原文，以及 MemGPT / Titans / Mamba-2 / Mem0 等关键论文。"
date: 2026-05-04
tags: ["AI Agent", "LLM", "Memory", "调研报告"]
showToc: true
---

## 一句话结论

所谓「大模型没有记忆」不是疏忽，而是 **Transformer O(n²) 注意力 + KV cache 显存 + 权重纠缠（灾难性遗忘）+ GDPR 合规** 四重约束的均衡解。ChatGPT / Claude / Cursor 的 "Memory" 本质都是**把结构化文本塞回 system prompt**，模型权重永远不动。Prompt Caching 只是性能优化，不是记忆。未来 1–3 年的主流是 **「无状态 LLM 内核 + 有状态 Agent 记忆层」** 混合架构。

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

ChatGPT Memory 已被多次 prompt injection 攻破：通过 Google Doc / 图片 / 网页让模型调用 `to=bio` 写入恶意持久指令，从此影响所有未来对话（Embrace The Red 博客, 2024）。这正是 Cursor 1.0→1.2 给 Memories 强制加 user approval 的原因，也是 Anthropic 专门测试 sycophancy / harmful conversation 后才发布 Memory 的原因。

{{< alert icon="circle-question" >}}

**Karpathy 的权威类比**：**权重 = ROM**（训练时烧入，静态）；**context window = RAM**（推理时活跃，可直接寻址）；**KV cache = working memory**（test-time 形成的工作记忆）；**外部 vector / KG store = disk**（持久但要 retrieve）。原话："权重里的知识是对训练时互联网文档的 hazy recollection；而 context window 里的内容是 directly accessible 的" — Andrej Karpathy, Dwarkesh Patel 专访 (2025-10)。

{{< /alert >}}

---

## 2. 主流产品的"记忆"策略对比（含 Cache vs Memory 辨析）

14 个主流产品，**没有任何一个真的修改了模型权重**。在这节我们同时辨析三个常被混为一谈的概念：

- **Cache**（KV / Prompt Caching）：缓存 attention 层的 K、V 投影张量，前缀逐 byte 匹配命中后跳过 prefill。生命周期 5min–24h。本质是算力优化，不是"记住"任何东西。
- **Memory**（产品层）：文本存储在外部数据库 / 向量库 / markdown 文件里，每次调用拼到 system prompt 头部。用户可控。
- **真模型记忆**（权重内）：改变模型权重本身。受灾难性遗忘、GDPR 被遗忘权、可解释性三重打击，业界普遍回避。

### 14 产品对比

| 产品 | 策略 | 本质 | 权重变? |
|---|---|---|---|
| **ChatGPT Memory** | 4 层: 元数据 + bio + ~40 条摘要 + 滑窗 | Memory | No |
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

---

## 3. 未来范式：四层混合栈

自下而上：底层永远无状态，上面三层是"给它装记忆"的不同抽象。L4（Agent 记忆层）是短期主流，L2（架构内记忆）是最值得押注的研究跃迁。

### L4 · Agent 记忆层

{{< badge >}}商业最成熟{{< /badge >}}

把 LLM 视为无状态 CPU，"记忆"放在外部数据库 + Agent runtime，每次推理把检索结果拼回 prompt。代表：`Letta` (MemGPT) · `Mem0` · `Zep + Graphiti` · `LangGraph Store` · `AutoGen Memory`。

- ✅ 可审计 · 可删除 · 模型无关
- ⚠️ retrieval 质量决定上限 · 写入污染累积
- Mem0 在 LoCoMo benchmark 上比 OpenAI Memory 高 26%、p95 延迟降 91%、token 降 90%

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

---

## 4. 记忆经济学：为什么 Cache TTL 是隐藏定价开关

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

## 5. 3 年范式演进地图

基于 Anthropic、Letta、Karpathy、LeCun 等来源的判断。2026 年主流配置有较高确信，2027–2028 为推断，含不确定性。

| 年份 | 工业主流配置 | 可能的黑马事件 |
|---|---|---|
| **2026** | 裸 LLM + Agent 记忆层 (Mem0/Zep/Letta) + 长上下文 caching | Titans 系架构开始小规模商用；Sleep-time Compute 成 agent 标配 |
| **2027** | Reflection / Sleep-time / TTT 进入主流 Agent 框架原语 | 某 SSM/Hybrid 7B 在 long-context benchmark 全面超 Transformer |
| **2028** | 顶级模型可能集成 in-arch memory module（高风险预测）；否则 Memory Layer 仍是标配 | LeCun H-JEPA + LLM 混合原型出现（5–10 年的早期信号） |

{{< alert icon="circle-info" >}}

**2028 预测需谨慎**：Titans 等架构内记忆方案需要 ≥70B 参数、≥10T token 训练才能规模化验证，目前仅在 arXiv。2028 年更可能的场景是 Agent 记忆层和架构内记忆共存，而非后者取代前者。

{{< /alert >}}

---

## 6. 给工程师的 9 条实用结论

1. **不要把 Cache 和 Memory 混为一谈**：Cache 是算力优化（跳过 prefill），Memory 是产品层决定把什么塞进 prompt。两者完全正交。

2. **写记忆就是写 system prompt**：凡是能用 markdown 写下来的项目约定（Cursor Rules / `CLAUDE.md` / AGENTS.md），永远比"让 AI 自己记"更可控、可 diff、可版本管理。

3. **拼前缀顺序: static → dynamic**：工具定义、System prompt、项目规则放最前；当前用户输入放最后。OpenAI / Anthropic / Google 三家文档的一致顶级建议。

4. **Compaction 必须 cache-safe**：不要为 summarization 单开新 system prompt——会让全长对话按 uncached 全价重算。Claude Code 称之为 "cache-safe forking"。

5. **TTL 是产品决策不只是工程参数**：Anthropic 1h→5min TTL 事件的教训。把 TTL 作为可配置项暴露给用户，否则用户会在账单里发现你的隐藏定价。

6. **AI 写、人审批 = 当前最稳的"自动 Memory"形态**：Cursor 1.2 加 user approval、Devin 默认走 suggestion 流，是被反复 prompt injection 教训之后的设计共识。

7. **可视、可编辑、可导出 = trust**：Anthropic 的 "natural language synthesis" 差异化和 ChatGPT 不透明合成，正反两面证明了这点。

8. **隐私模式与 Cache 有矛盾**：OpenAI Extended cache 失去 ZDR 资格、Cursor 隐私模式不存原文——把"性能 vs 隐私"作为两档让用户选。

9. **真正的护城河是"上下文工程"不是"记忆模型"**：把记忆写成 deterministic、version-controlled、人类可读的状态，curation cost 是一次性的，benefit 是 compounding 的。

---

## 7. 关键引用源

全部为 2024–2026 年一手资料。共 30+ 条精选，涵盖原厂文档、arXiv 论文、研究者原文。

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

**Google**
- [Gemini API Context Caching](https://ai.google.dev/gemini-api/docs/caching) — implicit vs explicit、TTL、storage 计费
- [Vertex AI Context caching overview](https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview) — 90% 折扣 + 跨租户隔离

**Cursor / Windsurf / Devin / Replit**
- [Cursor Rules](https://cursor.com/docs/context/memories) + [Codebase Indexing](https://cursor.com/docs/context/codebase-indexing) + [1.0 changelog](https://www.cursor.com/changelog/1-0) + [1.2 changelog](https://cursor.com/en/changelog/1-2)
- [Windsurf Cascade Memories](https://docs.windsurf.com/windsurf/cascade/memories) — 5 层 context 拼接
- [Devin Knowledge](https://cognitionai.mintlify.app/product-guides/knowledge) — 人写 + AI + DeepWiki + VM Snapshots
- [Replit Checkpoints](https://docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks) — VM + DB + AI 对话快照

### B. 关键论文

**架构 / 长上下文**
- [Lost in the Middle (TACL 2024)](https://arxiv.org/abs/2307.03172) — U 形曲线实证
- [Gemini 1.5 Technical Report](https://arxiv.org/abs/2403.05530) — 1M-10M token 标杆
- [Magic LTM-2-Mini](https://magic.dev/blog/100m-token-context-windows) — 100M token, 比 attention 省 1000× FLOPs
- [Titans: Learning to Memorize at Test Time](https://arxiv.org/abs/2501.00663) — Google neural memory module
- [Infini-attention](https://arxiv.org/abs/2404.07143) — Compressive memory, 1B 模型 5K → 1M passkey
- [Mamba-2 / SSD (ICML 2024)](https://proceedings.mlr.press/v235/dao24a.html) + [RWKV-7 Goose](https://arxiv.org/abs/2503.14456) + [KV-Direct](https://www.arxiv.org/pdf/2603.19664)

**Memory Layer / Agent 记忆**
- [MemGPT](https://arxiv.org/abs/2310.08560) · [Mem0](https://arxiv.org/abs/2504.19413) · [Zep + Graphiti](https://arxiv.org/abs/2501.13956) · [A-Mem](https://arxiv.org/abs/2502.12110) · [Generative Agents](https://arxiv.org/abs/2304.03442) · [Sleep-time Compute](https://arxiv.org/abs/2504.13171)

**Continual Learning**
- [Continual Learning of LLMs Survey](https://arxiv.org/abs/2404.16789) · [TTT (ICML 2025)](https://proceedings.mlr.press/v267/akyurek25a.html) · [Memory Survey](https://arxiv.org/abs/2505.00675)

### C. 范式判断 (Karpathy / LeCun / Raschka)

- [Andrej Karpathy · Dwarkesh Patel 专访 (2025-10)](https://www.dwarkeshpatel.com/p/andrej-karpathy)
- [Karpathy · Intro to LLMs](https://www.youtube.com/watch?v=zjkBMFhNj_g)
- [Yann LeCun · A Path Towards AMI](https://openreview.net/pdf?id=BZ5a1r-kVsf)
- [LeCun at NVIDIA GTC 2025](https://www.endofmiles.net/lecun-says-hes-not-so-interested-in-llms-anymore)
- [Sebastian Raschka · Coding the KV Cache](https://sebastianraschka.com/blog/2025/coding-the-kv-cache-in-llms.html)

### D. 工业框架

- [LangGraph Persistence & Memory](https://docs.langchain.com/oss/python/langgraph/persistence)
- [AutoGen Memory & RAG](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/memory.html)
- [Letta Research](https://www.letta.com/research)
- [Don't Break the Cache (arXiv 2601.06007)](https://arxiv.org/abs/2601.06007v2)
- [ctx.ist · Context Determinism Thesis](https://ctx.ist/thesis/)

---

*调研方法：三路并行子代理（技术原理 + 产品 API 设计 + 未来范式），交叉验证四个信息源（Exa、Tavily、Context7、WebSearch）。共 67 条一手 URL，时效 2024-Q1 至 2026-Q2。*
