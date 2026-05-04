---
title: "大模型为什么没有记忆——67 条一手资料的交叉验证调研"
description: "用 Exa / Tavily / Context7 / WebSearch 四源交叉验证，覆盖 Anthropic / OpenAI / Google / Cursor 官方文档，Karpathy / LeCun / Raschka 等研究者原文，以及 MemGPT / Titans / Mamba-2 / Mem0 等关键论文。"
date: 2026-05-04
tags: ["AI Agent", "LLM", "Memory", "调研报告"]
showToc: true
---

## 一句话结论

所谓「大模型没有记忆」不是疏忽，而是 **Transformer O(n²) 注意力 + KV cache 显存 + 权重纠缠（灾难性遗忘）+ GDPR 合规** 四重约束的均衡解。ChatGPT / Claude / Cursor 的 "Memory" 本质都是**把结构化文本塞回 system prompt**，模型权重永远不动。Prompt Caching 只是性能优化，不是记忆。未来 1–3 年的主流是 **「无状态 LLM 内核 + 有状态 Agent 记忆层」** 混合架构，而非单一胜出者。

<div class="research-stats">
  <div class="research-stat">
    <div class="stat-value">O(n²)</div>
    <div class="stat-label">注意力计算复杂度</div>
  </div>
  <div class="research-stat">
    <div class="stat-value">638×H100</div>
    <div class="stat-label">Llama 3.1 100M ctx 单用户 KV cache 成本</div>
  </div>
  <div class="research-stat">
    <div class="stat-value">0.1×</div>
    <div class="stat-label">Cache read 价格 (Anthropic / OpenAI)</div>
  </div>
  <div class="research-stat">
    <div class="stat-value">5min–24h</div>
    <div class="stat-label">主流 prompt cache TTL</div>
  </div>
</div>

---

## 1. 为什么 LLM 被设计成无状态

四个独立约束叠加，每一个单独都不致命，叠在一起就只剩"无状态"这一种工程解。

### 架构约束 · O(n²) 注意力

自注意力关于序列长度 n 的计算复杂度是 `O(n²)`，KV cache 显存随 n 线性增长但系数巨大——4096 token 单序列就要约 2 GB 显存，32 并发就 64 GB，比模型权重本身还大。

→ Liu et al. "Lost in the Middle" (TACL 2024) 实证：长上下文不仅算得慢，模型对中段信息的利用呈 U 形曲线，比闭卷还差。

### 训练约束 · 灾难性遗忘

LLM 知识在数十亿权重里高度纠缠，没有"法语模块"或"用户偏好寄存器"可以独立写入。每次 fine-tune 都重塑整个参数景观，旧能力会被覆盖。

→ 业界普遍做法是周/天级别的离线 retrain，没人做 per-request 的在线权重更新。

### 合规约束 · 被遗忘权

GDPR / PDPA 要求用户能删除自己的数据。一旦个人数据烘焙进权重，"被遗忘权"在工程上几乎无法精确执行——只能删掉外部存储。

→ 这是 RAG / Memory Layer 击败 fine-tuning 的根本原因，不是技术优劣，是法务硬约束。

### 安全约束 · 持久记忆 = 持久攻击面

ChatGPT Memory 已被多次 prompt injection 攻破：通过 Google Doc / 图片 / 网页让模型调用 `to=bio` 写入恶意持久指令，从此影响所有未来对话。

→ 这正是 Cursor 1.0→1.2 给 Memories 强制加 user approval 的原因，Anthropic 也专门测试 sycophancy / harmful conversation 后才发布 Memory。

<div class="research-callout callout-neutral">

> **Karpathy 的权威类比**：**权重 = ROM**（训练时烧入，静态）；**context window = RAM**（推理时活跃，可直接寻址）；**KV cache = working memory**（test-time 形成的工作记忆）；**外部 vector / KG store = disk**（持久但要 retrieve）。原话："权重里的知识是对训练时互联网文档的 hazy recollection；而 context window 里的内容是 directly accessible 的" — Andrej Karpathy, Dwarkesh Patel 专访 (2025-10)。

</div>

---

## 2. 主流产品的"记忆"策略对比

14 个主流产品，**没有任何一个真的修改了模型权重**。所谓 "Memory" 全部是产品层把文本塞回 prompt 的不同实现方式。

<table class="research-table">
<thead><tr><th>产品 / 能力</th><th>策略一句话总结</th><th>本质</th><th class="col-center">权重变化?</th></tr></thead>
<tbody>
<tr><td><strong>ChatGPT Memory</strong></td><td>4 层结构: 元数据 + Saved Memories (bio) + 最近 ~40 条对话摘要 + 当前滑窗</td><td>拼回 system prompt</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>OpenAI Prompt Caching</em></td><td>≥1024 token 自动 KV 前缀缓存, 5–10min in-mem / 24h Extended, 0.1–0.5x 价</td><td>推理算力优化</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>OpenAI Responses API</em></td><td><code>previous_response_id</code> 链式服务端状态, 主要为保留 reasoning trace 密文</td><td>服务端持久化对话</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>Anthropic Prompt Caching</em></td><td>显式 <code>cache_control</code> 断点 (≤4 个), 5min/1h TTL, 前缀逐 byte 匹配</td><td>推理算力优化</td><td class="col-center">No</td></tr>
<tr><td><strong>Claude.ai Projects</strong></td><td>项目说明 + 知识库文件 + 项目内对话历史, 全量塞 prompt 不做向量检索</td><td>拼回 system prompt</td><td class="col-center">No</td></tr>
<tr><td><strong>Claude Memory</strong> (2025-10)</td><td>项目隔离, 24h 自然语言再合成, 可视/可编辑/可导入导出</td><td>拼回 system prompt</td><td class="col-center">No</td></tr>
<tr><td><strong>Claude Code</strong></td><td>人写 CLAUDE.md (每会话加载) + 模型自写 <code>~/.claude/.../MEMORY.md</code> (前 200 行)</td><td>拼回 system prompt</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>Gemini Context Caching</em></td><td>Implicit (默认开 90% 折扣) + Explicit (TTL 60min, 按 token-小时收存储费)</td><td>推理算力优化</td><td class="col-center">No</td></tr>
<tr><td><strong>Cursor Rules / AGENTS.md</strong></td><td>静态 markdown, 4 种触发模式, Team > Project > User 优先级</td><td>拼回 system prompt</td><td class="col-center">No</td></tr>
<tr><td><strong>Cursor Memories</strong> (1.0+)</td><td>后台模型生成候选 → 用户审批 → 写入 per-project per-user</td><td>拼回 system prompt</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>Cursor Codebase Index</em></td><td>Merkle 树 + chunk 加密 + Turbopuffer 向量库, 服务端不留原文</td><td>RAG (向量检索)</td><td class="col-center">No</td></tr>
<tr><td><strong>Windsurf Cascade</strong></td><td>global rules + workspace rules + 自动 Memories + open files + M-Query RAG</td><td>拼回 system prompt</td><td class="col-center">No</td></tr>
<tr><td><strong>Devin Knowledge</strong></td><td>人写 + AI 建议 + DeepWiki (每几小时重建仓库 wiki) + VM Snapshots</td><td>拼回 + RAG + 状态快照</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>Replit Checkpoints</em></td><td>VM 快照 = 文件 + DB + 对话上下文 + Agent memory, CoW manifest 存 GCS</td><td>状态快照</td><td class="col-center">No</td></tr>
</tbody>
</table>

> 浅色行 = Cache 类（性能优化）；粗体行 = Memory 类（产品层文本注入）。所有产品的"权重变化"一栏都是 No。

---

## 3. Memory vs Cache vs 真模型记忆 · 三层辨析

这三个常被混为一谈，但它们在物理上是完全不同的东西。

### Cache (KV / Prompt Caching) `已普及`

| 维度 | 说明 |
|---|---|
| 物理层 | 缓存的是 attention 层的 K、V 投影张量；前缀逐 byte 匹配命中后跳过 prefill。对模型而言，cache 命中和重算的输出数学上完全等价。 |
| 生命周期 | 5 分钟 – 24 小时 |
| 本质 | 算力优化，不是"记住"任何东西 |

### Memory (产品层) `已普及`

| 维度 | 说明 |
|---|---|
| 物理层 | 外部数据库 / 向量库 / markdown 文件存储的**文本**，每次调用拼到 system prompt 头部。 |
| 生命周期 | 用户控制：可见、可编辑、可删除、可导入导出 |
| 本质 | 系统工程 + UX 问题，不是模型能力 |

### 真模型记忆 (权重内) `基本不存在`

| 维度 | 说明 |
|---|---|
| 物理层 | 改变模型权重本身。理论上是 fine-tuning / continual learning，实际上业界普遍回避。 |
| 生命周期 | 永久，但不可逐条删除（合规噩梦） |
| 本质 | 受灾难性遗忘 + 合规 + 可解释性三重打击 |

<div class="research-callout callout-warning">

> **关键反向工程证据**：Manthan Gupta 三次实验证实：问 ChatGPT 一年前讨论过的具体话题，它**根本不知道**。ChatGPT Memory 没有用 RAG，存的只有：会话元数据 + 几十条 bio 条目 + 最近 ~40 个聊天的**用户消息摘要**（不存 ChatGPT 自己的回复）+ 当前滑窗。Cursor 官方文档第一句更直白：*"Large language models don't retain memory between completions. Rules provide persistent, reusable context at the prompt level."*

</div>

---

## 4. 未来范式：四层混合栈

自下而上：底层永远无状态，上面三层是"给它装记忆"的不同抽象。短期主流是 L4，最值得押注的研究跃迁在 L2。

### L4 · Agentic Memory Layer (Stateful) <span class="research-pill pill-success">商业最成熟</span>

把 LLM 视为无状态 CPU，"记忆"放在外部数据库 + Agent runtime。代表：`Letta` (MemGPT 商业化) · `Mem0` · `Zep + Graphiti` · `LangGraph Store` · `AutoGen Memory`。

- ✅ 可审计 · 可删除 · 模型无关
- ⚠️ retrieval 质量决定上限 · 写入污染累积
- Mem0 在 LoCoMo benchmark 上比 OpenAI Memory 高 26%、p95 延迟降 91%、token 降 90%。

### L3 · Selective Ultra-Long Context <span class="research-pill pill-info">已商业化</span>

把记忆塞进超长 context window。代表：Gemini 2M (needle 召回 >99%) · Magic LTM-2-Mini 100M tokens · context caching。

- ✅ 会话内最佳载体
- ⚠️ Lost-in-the-middle 仍未解 · 100M ctx 单用户 638×H100
- 不会替代 Memory Layer——长上下文管不了跨会话/跨年的"真记忆"。

### L2 · In-Architecture Long-Term Memory <span class="research-pill pill-warn">研究价值最高</span>

把"持久记忆"做成可微模块嵌入网络。代表：Google `Titans` (短期 attention + 长期 neural memory + 任务先验) · `Infini-attention` · `Mamba-2` · `RWKV-7 Goose` · Test-Time Training。

- ✅ 常数显存 · 线性时间
- ⚠️ 尚未规模化验证
- 一旦某个变种被前沿厂商规模化（≥70B 参数 / ≥10T token 训练），可能改写 L4 格局。

### L1 · Stateless LLM Core (frozen weights) <span class="research-pill pill-neutral">永远无状态</span>

GPT / Claude / Gemini / Llama 内核。每次推理是新进程，权重不变。Continual learning 短期内不会成为 per-user 记忆主路：catastrophic forgetting 仍未根除，GDPR 被遗忘权在权重里无法精确执行。

- LoRA 用于领域/角色特化，不是 per-user。

---

## 5. 3 年范式演进地图

<table class="research-table">
<thead><tr><th>年份</th><th>工业主流配置</th><th>可能的黑马事件</th></tr></thead>
<tbody>
<tr><td class="col-center"><strong>2026</strong></td><td>Stateless LLM + Memory Layer (Mem0/Zep/Letta) + 长上下文 caching</td><td>Titans 系架构开始小规模商用；Sleep-time Compute 成 agent 标配</td></tr>
<tr><td class="col-center"><strong>2027</strong></td><td>Reflection / Sleep-time / TTT 进入 LangGraph / CrewAI / AutoGen 框架原语</td><td>某 SSM/Hybrid 7B 在 long-context benchmark 全面超 Transformer</td></tr>
<tr><td class="col-center"><strong>2028</strong></td><td>顶级模型自带 in-arch long-term memory module；Memory Layer 退化为治理层</td><td>LeCun H-JEPA + LLM 混合体出现端到端原型 (5–10 年押注的早期信号)</td></tr>
</tbody>
</table>

<div class="research-callout callout-info">

> **反直觉的观察**：Anthropic 在 2026-03 把默认 cache TTL 从 1h 静默降到 5min，导致 Claude Code 用户实测多花 17–26%。这暴露了一个被低估的事实：**cache TTL 是直接影响用户单价、但不在 SLA 上的隐藏开关**。未来的"记忆经济学"会越来越像云存储——分层、计时、可定价。

</div>

---

## 6. 给工程师的 9 条实用结论

1. **不要把 Cache 和 Memory 混为一谈**：Cache 是为已经组好的 prompt 加速；Memory 是产品层决定要把什么塞进 prompt。两者完全正交。

2. **写记忆就是写 system prompt**：凡是能用 markdown 写下来的项目约定（Cursor Rules / `CLAUDE.md` / AGENTS.md），永远比"让 AI 自己记"更可控、可 diff、可版本管理。

3. **拼前缀顺序: static → dynamic**：工具定义、System prompt、项目规则放最前；当前用户输入放最后。OpenAI / Anthropic / Google 三家文档的一致顶级建议。

4. **Compaction 必须 cache-safe**：不要为 summarization 单开新 system prompt——会让全长对话按 uncached 全价重算。Claude Code 称之为 "cache-safe forking"。

5. **TTL 是产品决策不只是工程参数**：Anthropic 把默认 TTL 从 1h 改到 5min 触发巨大用户反弹证明了这点。把 TTL 作为可配置项暴露给用户。

6. **AI 写、人审批 = 当前最稳的"自动 Memory"形态**：Cursor 1.2 加 user approval、Devin 默认走 suggestion 流，是被反复 prompt injection 教训之后的设计共识。

7. **可视、可编辑、可导出 = trust**：Anthropic 的 "natural language synthesis" 差异化和 ChatGPT 不透明合成，正反两面证明了这点。

8. **隐私模式与 Cache 有矛盾**：OpenAI Extended cache 失去 ZDR 资格、Cursor 隐私模式不存原文——把"性能 vs 隐私"作为两档让用户选。

9. **真正的护城河是"上下文工程"不是"记忆模型"**：把记忆写成 deterministic、version-controlled、人类可读的状态，curation cost 是一次性的，benefit 是 compounding 的。

---

## 7. 关键引用源

全部为 2024–2026 年一手资料，按主题分组。共 30+ 条精选，涵盖原厂文档、arXiv 论文、研究者原文。

### A. 厂商一手资料

**OpenAI**
- [OpenAI Prompt Caching guide](https://developers.openai.com/docs/guides/prompt-caching) — KV cache 工作原理 + TTL + retention policy
- [OpenAI Prompt Caching 201 cookbook](https://developers.openai.com/cookbook/examples/prompt_caching_201/) — Extended cache 与 ZDR 的关系
- [Manthan Gupta · I Reverse Engineered ChatGPT's Memory](https://manthanguptaa.in/posts/chatgpt_memory/) — 4 层结构反向工程
- [Embrace The Red · ChatGPT Hacking Memories](https://embracethered.com/blog/posts/2024/chatgpt-hacking-memories/) — bio 工具与 prompt injection 攻击面
- [Sean Goedecke · The whole point of Responses API](https://www.seangoedecke.com/responses-api/) — 揭穿 Responses API 的真正动机

**Anthropic**
- [Anthropic Prompt Caching docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — cache_control / 5min vs 1h / 4 breakpoints
- [Lessons from building Claude Code: Prompt caching is everything](https://claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything) — cache-safe forking 实践
- [Claude Code Memory docs](https://docs.anthropic.com/en/docs/claude-code/memory) — CLAUDE.md vs auto memory
- [How does Claude's memory work](https://support.anthropic.com/en/articles/11817273-how-does-claude-s-memory-work) — RAG 工具调用 + 24h synthesis + 项目隔离

**Google**
- [Gemini API Context Caching](https://ai.google.dev/gemini-api/docs/caching) — implicit vs explicit、TTL、storage 计费
- [Vertex AI Context caching overview](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview) — 90% 折扣 + 跨租户隔离

**Cursor / Windsurf / Devin / Replit**
- [Cursor Rules](https://cursor.com/docs/context/memories) — 4 种 trigger + Team/Project/User Rules + AGENTS.md
- [Cursor Codebase Indexing](https://cursor.com/docs/context/codebase-indexing) — Merkle 树 + obfuscated path + 客户端解密
- [Cursor 1.0 changelog](https://www.cursor.com/changelog/1-0) + [1.2 changelog](https://cursor.com/en/changelog/1-2) — Memories beta → GA + user approval 演进
- [Securely indexing large codebases (Cursor 博客)](https://www.cursor.so/blog/secure-codebase-indexing) — Merkle 跨账号 index 复用
- [Windsurf Cascade Memories](https://docs.windsurf.com/windsurf/cascade/memories) — 5 层 context 拼接
- [Devin Knowledge](https://cognitionai.mintlify.app/product-guides/knowledge) — 人写 + AI 建议 + DeepWiki + VM Snapshots
- [Replit Checkpoints](https://docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks) — VM + DB + AI 对话作为快照单元

### B. 关键论文

**架构 / 长上下文**
- [Lost in the Middle (TACL 2024)](https://arxiv.org/abs/2307.03172) — U 形曲线实证
- [Gemini 1.5 Technical Report](https://arxiv.org/abs/2403.05530) — 1M-10M token 标杆
- [Magic LTM-2-Mini](https://magic.dev/blog/100m-token-context-windows) — 100M token, 长程算法比 attention 省 1000× FLOPs
- [Titans: Learning to Memorize at Test Time](https://arxiv.org/abs/2501.00663) — Google neural long-term memory module
- [Infini-attention](https://arxiv.org/abs/2404.07143) — Compressive memory, 1B 模型 5K → 1M passkey
- [Mamba-2 / SSD (ICML 2024)](https://proceedings.mlr.press/v235/dao24a.html) — 2-8× 加速
- [RWKV-7 Goose](https://arxiv.org/abs/2503.14456) — 常数显存, attention-free
- [KV-Direct (arXiv 2603.19664)](https://www.arxiv.org/pdf/2603.19664) — 证明 KV cache 是 residual stream 的确定性投影

**Memory Layer / Agent 记忆**
- [MemGPT](https://arxiv.org/abs/2310.08560) — OS-inspired hierarchical memory 范式奠基
- [Mem0](https://arxiv.org/abs/2504.19413) — LoCoMo 91.6, 比 full-context p95 延迟降 91%
- [Zep + Graphiti](https://arxiv.org/abs/2501.13956) — 双时态 KG, DMR 94.8%
- [A-Mem](https://arxiv.org/abs/2502.12110) — Zettelkasten 启发的自演化记忆
- [Generative Agents (Park et al.)](https://arxiv.org/abs/2304.03442) — memory stream + reflection + planning 模板
- [Sleep-time Compute](https://arxiv.org/abs/2504.13171) — Letta 团队, test-time compute ↓5× / accuracy ↑13-18%

**Continual Learning / TTT**
- [Continual Learning of LLMs Survey](https://arxiv.org/abs/2404.16789) — LoRA 仍受 catastrophic forgetting 困扰
- [TTT for Few-shot Learning (ICML 2025)](https://proceedings.mlr.press/v267/akyurek25a.html) — ARC 8B + TTT ≈ 人类平均
- [Memory Survey: Taxonomy & Operations](https://arxiv.org/abs/2505.00675) — parametric/contextual + 6 原子操作

### C. 范式判断 (Karpathy / LeCun / Raschka)

- [Andrej Karpathy · Dwarkesh Patel 专访 (2025-10)](https://www.dwarkeshpatel.com/p/andrej-karpathy) — 权重 = hazy recollection, KV cache = working memory
- [Karpathy · Intro to LLMs (LLM OS)](https://www.youtube.com/watch?v=zjkBMFhNj_g) — context = RAM 隐喻最权威出处
- [Yann LeCun · A Path Towards Autonomous Machine Intelligence](https://openreview.net/pdf?id=BZ5a1r-kVsf) — H-JEPA + 持久关联记忆
- [LeCun at NVIDIA GTC 2025](https://www.endofmiles.net/lecun-says-hes-not-so-interested-in-llms-anymore) — 持久记忆是 LLM 通往 AMI 的四大障碍之一
- [Sebastian Raschka · Coding the KV Cache](https://sebastianraschka.com/blog/2025/coding-the-kv-cache-in-llms.html) — 从零实现 + 工程权衡

### D. 工业框架

- [LangGraph Persistence & Memory](https://docs.langchain.com/oss/python/langgraph/persistence) — short-term checkpointer + long-term Store
- [AutoGen Memory & RAG](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/memory.html) — Memory protocol + ChromaDB/Redis/Mem0
- [Letta Research / Stateful Agents](https://www.letta.com/research) — MemGPT 创始团队商业化产品
- [Don't Break the Cache (arXiv 2601.06007)](https://arxiv.org/abs/2601.06007v2) — agentic 工作流量化对比, 41-80% 成本节省
- [ctx.ist · Context Determinism Thesis](https://ctx.ist/thesis/) — 17 系统 + 56 拒绝决定的工程论证

---

*调研方法：三路并行子代理（技术原理 + 产品 API 设计 + 未来范式），交叉验证四个信息源（Exa Web Search/Fetch、Tavily Research/Search、Context7 拉取 Cursor 官方文档、WebSearch）。共 67 条一手 URL，时效落在 2024-Q1 至 2026-Q2。*
