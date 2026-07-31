---
title: "Agent 如何记住你：人脑记忆史与六大开源系统代码审计"
description: "从 Ebbinghaus、H.M.、工作记忆与 engram 出发，重建 Agent 记忆发展史；再对 Mem0、Letta、Graphiti、LangMem、Cognee、MemoryOS 做宣传卖点与实际代码架构对照。"
date: 2026-07-30
publishDate: 2026-07-30
lastmod: 2026-07-30
tags: ["AI Agent", "LLM", "Memory", "记忆系统", "认知科学", "开源架构"]
categories: ["深度调研"]
showToc: true
---

几乎每个 Agent 项目都说自己有「长期记忆」。

有的意思是把聊天记录做 embedding，有的意思是维护一份用户画像，有的意思是让模型自己修改 Markdown，还有的已经做到了双时序知识图谱。它们都叫 memory，却不是同一种东西，也不该放在一张跑分榜上直接比较。

{{< figure
  src="/images/posts/llm-memory-research/agent-memory-cover-v3-4k.png"
  alt="从人类记忆痕迹到 Agent 记忆栈"
>}}

要判断一个系统是不是真的「会记」，我更愿意问三个问题：

1. **一次经历之后，系统里的什么状态发生了变化？**
2. **这个状态存在哪里，谁能修改，什么时候失效？**
3. **下一次行动前，它如何被准确、合规地带回来？**

这篇文章从这三个问题出发。前半段把人类记忆科学与 Agent 记忆技术放在同一条历史轴上；后半段直接读代码，对照 Mem0、Letta、Graphiti、LangMem、Cognee 与 MemoryOS 的宣传卖点、实际数据流、系统边界和对应的记忆范式。

{{< alert icon="lightbulb" >}}
**先给结论：** 今天主流的 Agent 并没有获得一种像人脑那样的统一「记忆器官」。工程上真正有效的是一条闭环：**经历 → 写入门控 → 表征 → 存储 → 检索 → 上下文组装 → 行动反馈 → 巩固 / 修订 / 遗忘**。不同开源项目，只是选择接管这条闭环的不同部分。
{{< /alert >}}

下面这张图不是某个产品的组件架构，而是全文共用的**判断坐标系**。它要回答的不是「数据放在哪」，而是「一次过去的经历如何真正影响下一次行动」。阅读时先沿中间的七步主环看信息如何从经历变成行动；再看左侧三种载体，区分当前任务、跨会话记忆与真实世界状态；右侧说明每一步完成的变换，底部则展示长期运行后必须发生的巩固、修订与遗忘。这样能避免把数据库、Context、缓存和真实状态都笼统地叫作“记忆”。

{{< figure
  src="/images/posts/llm-memory-research/memory-loop-systems-map-v3-4k.png"
  alt="Agent 记忆科学系统图：七步闭环、三种载体与三种治理结果"
  caption="图 1：用来建立本文对“记忆系统”的工作定义。中心主环说明在线行为路径，左侧区分工作记忆、长期记忆与真实状态，底部说明记忆生命周期。数据库只占第四步；没有写入判断、检索、上下文组装、冲突处理和反馈更新，存得再多也只是日志。"
>}}

---

## 一、先把最容易混淆的五种「记忆」分开

LLM 系统里至少有五种状态载体。它们在物理位置、写入速度、生命周期和治理方式上完全不同。

这张图专门负责**术语消歧**。横向比较五个载体，纵向依次看「谁写、能活多久、最擅长什么、不擅长什么」。它不是要找一个最好的 memory，而是避免把性能缓存当成长期记忆、把 Context 当成持久层，或把真实业务状态复制成可能过期的自然语言回忆。

{{< figure
  src="/images/posts/llm-memory-research/memory-carriers-v4-zh-4k.png"
  alt="模型权重、上下文、KV Cache、外部记忆与环境状态的区别"
  caption="图 2：用来回答“状态究竟住在哪里”。工程设计里最危险的错误，是把其中两种载体当成同一种。"
>}}

### 1. 参数记忆：模型权重

预训练和微调把统计规律写进参数。它容量大、泛化强，但写入慢、难精确删除、很难回答「这条知识来自哪次经历」。

它适合语言能力、世界知识和稳定技能，不适合每个用户每轮对话后的实时更新。把用户偏好持续 fine-tune 进权重，不仅昂贵，还会遇到灾难性遗忘、租户隔离、删除权和审计问题。

### 2. 工作记忆：Context Window

当前 system prompt、对话、工具结果、scratchpad 和检索片段都在这里。模型能直接注意到它们，所以这是推理时最强的工作区。

但 context 不是跨调用自动持久的。窗口再长，也只是「这次桌面更大」；它没有自动决定哪些内容值得保留，更不会自动形成稳定的用户模型。

### 3. 计算缓存：KV Cache / Prompt Cache

KV Cache 保存注意力层已经算过的 K/V 张量，Prompt Cache 复用相同前缀的 prefill 结果。它们让推理少算一次，但不负责判断信息价值，也不形成可编辑、可检索的记忆条目。

所以：

- Cache 命中，可能什么都没「记住」，只是省了计算；
- Cache 失效，也不代表长期记忆丢了；
- Prompt 前缀里的记忆发生变化，反而可能让 Cache miss。

**Cache 是性能机制，Memory 是状态治理机制。**

### 4. 外部长期记忆：文件、SQL、向量库、图数据库

这是当前 Agent 记忆的主战场。它可以按用户隔离、保留来源、支持删除，并在下一次调用前检索回 context。

但「放进向量库」不等于「完成记忆」。向量库只解决近似相似搜索；它不天然解决事实冲突、时序真值、重要性、权限、错误写入和遗忘。

### 5. 环境记忆：Git、CRM、日历与真实世界状态

很多信息根本不该复制成一条自然语言记忆。代码是否已部署、客户是否付款、会议是否改期，这些事实应优先回源查询。

一个可靠 Agent 要区分：

- **该回忆的**：用户偏好、过去决策、成功经验；
- **该查询的**：订单、权限、库存、代码状态；
- **该重新计算的**：价格、统计值、派生指标。

这也是为什么「把所有东西都做 embedding」通常会得到一个信息很多、事实却不可靠的系统。

---

## 二、人类是怎样逐步理解记忆的

把向量库类比成海马、把 context 类比成工作记忆，可以帮助入门，但不能当成结构等价。人类记忆研究一百多年最重要的发现，恰恰是：**记忆不是一个位置，也不是一次写入后永久不变的文件。**

这里放历史图，不是为了给文章增加一段背景知识，而是为了说明本文为什么拒绝「记忆 = 存储」这个模型。阅读时间线时，不必记住所有年份；要观察的是底部的三次概念转向：从单一仓库，到多个可分离系统，再到会在提取中被重构的动态过程。后文的事件、事实、程序、巩固与修订，全部来自这条问题线索。

{{< figure
  src="/images/posts/llm-memory-research/human-memory-history-v4-zh-4k.png"
  alt="人类怎样逐步理解记忆：从遗忘曲线到记忆痕迹"
  caption="图 3：用来解释本文的记忆范式来源。一百多年的研究逐渐把记忆从“一个存放位置”，改写成多个系统共同完成的编码、巩固、提取与重构过程。"
>}}

### 1885：Ebbinghaus 把记忆变成可测量对象

Hermann Ebbinghaus 用无意义音节在自己身上做重复学习实验，并用「节省法」测量遗忘：即使无法直接回忆，重新学习所需时间仍会缩短。记忆第一次从哲学讨论变成可以画曲线、比较间隔与重复次数的实验对象。

今天 Agent 评估里只测「最终答对多少题」，其实退回到了比 Ebbinghaus 更粗糙的尺度。一个记忆系统还应测：

- 写入后多久可用；
- 多次正确提取后是否更稳定；
- 旧事实被新事实替代时是否仍会误召回；
- 完全想不起来时能否正确弃权。

原始资料：[Ebbinghaus, *Memory: A Contribution to Experimental Psychology* (1885/1913)](https://psychclassics.yorku.ca/Ebbinghaus/)

### 1900：记忆不是瞬间写盘，而要经历巩固

Georg Elias Müller 与 Alfons Pilzecker 发现，新学习之后立刻插入其他材料会增加干扰，并提出记忆痕迹需要时间稳定的思路。后来「consolidation」成为记忆研究的核心概念。

对 Agent 的启示不是简单做一个 nightly cron，而是区分两份东西：

- **原始经历**：完整、可追溯、尽量 append-only；
- **巩固结果**：画像、事实、规则、摘要，可以更新或推翻。

如果只保存后者，模型一次错误总结就可能改写历史；如果只保存前者，检索会被大量低价值事件淹没。

原始资料：[Müller & Pilzecker, *Experimentelle Beiträge zur Lehre vom Gedächtniss* (1900)](https://books.google.com/books?id=5RdCAQAAMAAJ)

### 1949：Hebb 把持久变化放到连接上

Donald Hebb 提出细胞集群与连接效率随共同活动而改变的理论框架。那句广为流传的「fire together, wire together」不是原文，但准确概括了关键方向：经验通过网络连接的可塑性留下痕迹。

这对应 Agent 里的一个重要分界：

- 把经历放进 context，只是**激活状态变化**；
- 把经历写入持久存储，才是**系统状态变化**；
- 更新模型权重，则是更慢、更难治理的**参数变化**。

### 1957：H.M. 证明「记忆」可以分成不同系统

Scoville 与 Milner 报告患者 H.M. 在双侧内侧颞叶手术后出现严重的顺行性遗忘，但短时保持和部分技能学习并非以同样方式受损。这项研究击碎了「记忆是一种单一能力」的直觉。

它也是今天 Agent 设计最值得继承的认知：不要让同一个 collection 同时承担当前任务状态、历史事件、用户事实和执行技能。

原始论文：[Scoville & Milner, “Loss of Recent Memory after Bilateral Hippocampal Lesions” (1957)](https://pmc.ncbi.nlm.nih.gov/articles/PMC497229/)

### 1970s：情景、语义、程序与工作记忆逐渐分开

Endel Tulving 区分了：

- **情景记忆（episodic）**：我在何时何地经历了什么；
- **语义记忆（semantic）**：脱离具体经历后，我知道什么。

Baddeley 与 Hitch 则用多组件工作记忆替代单一短时仓库。与此同时，技能学习与陈述性知识的分离让程序记忆逐渐成为独立范畴。

这套分类到今天仍然比「短期 / 长期」更能指导 Agent 架构：

| 人类记忆范畴 | Agent 中的对应物 | 典型存储 | 典型读取 |
|---|---|---|---|
| 工作记忆 | 当前目标、计划、中间结果、工具输出 | Context / graph state / scratchpad | 每步直接注入 |
| 情景记忆 | 对话、行动、失败、环境观察 | 事件日志 + 时间索引 | 时间、实体、相似度联合检索 |
| 语义记忆 | 用户偏好、稳定事实、概念与关系 | Profile / KV / 向量 / 知识图谱 | 精确键、语义或图查询 |
| 程序记忆 | Prompt、规则、技能、成功轨迹 | 文件 / 版本库 / skill registry | 按任务路由或显式挂载 |

**「短期 / 长期」描述的是寿命；「情景 / 语义 / 程序」描述的是内容与功能。** 两个维度不能互相替代。

原始资料：[Tulving, “Episodic and Semantic Memory” (1972)](https://cir.nii.ac.jp/crid/1574231874408386176?lang=en)；[Baddeley & Hitch, “Working Memory” (1974)](https://doi.org/10.1016/S0079-7421%2808%2960452-1)

### 1971–2012：从海马空间表征到可操控 engram

O'Keefe 发现海马 place cells；此后 grid cells 等研究进一步展示了空间表征的神经机制。2012 年，Liu、Ramirez、Tonegawa 等用光遗传方法重新激活在恐惧记忆形成时被标记的海马细胞群，并诱发记忆提取相关行为。

这并不意味着找到了一个装着完整记忆的「地址」。现代 engram 研究更接近一个分布式、可再激活的细胞集群。记忆内容仍依赖跨脑区网络与提取条件。

资料：[2014 Nobel Prize scientific background](https://www.nobelprize.org/prizes/medicine/2014/advanced-information/)；[Liu et al., “Optogenetic stimulation of a hippocampal engram activates fear memory recall” (2012)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3331914/)

### 2000：提取不是只读，记忆会再巩固

Nader、Schafe 与 LeDoux 的实验显示，已经巩固的恐惧记忆在被重新激活后会进入可塑状态，并需要蛋白质合成才能再次稳定。这推动了 reconsolidation 研究。

对 Agent 来说，最有价值的类比是：**每次 recall 都可能成为一次 update。**

用户说「我现在不喝咖啡了」，系统不应只是把新旧两条偏好并排丢进向量库。它至少要表达：

```text
旧事实：user likes coffee
有效期：2025-03 → 2026-07
新事实：user avoids coffee
来源：conversation/event/...
关系：new_fact supersedes old_fact
```

原始论文：[Nader, Schafe & LeDoux, “Fear memories require protein synthesis in the amygdala for reconsolidation after retrieval” (2000)](https://pubmed.ncbi.nlm.nih.gov/10963596/)

### 从脑科学真正能借走的四条原则

1. **记忆是多个系统，不是一个向量库。**
2. **巩固是从事件到稳定表征的转换，不是简单压缩文本。**
3. **提取具有重构性，必须保留来源与版本。**
4. **遗忘不是纯故障；它也是抑制干扰、控制成本和保护隐私的机制。**

但不要把工程组件和脑区做一一映射。海马不是 Redis，向量相似度不是联想记忆的完整模型，LLM 摘要也不等于睡眠巩固。类比的作用是提出问题，不是替代证据。

---

## 三、Agent 记忆是怎样走到今天的

人类记忆时间线解释「我们为什么这样提问」，下面的 Agent 时间线则解释「工程为什么走成今天这样」。阅读重点不是模型名称本身，而是状态边界怎样一步步外移：先写在程序和网络内部，后来放进 Context，再通过检索连接外部数据，最后形成包含写入、权限、时间与删除的独立记忆层。

{{< figure
  src="/images/posts/llm-memory-research/agent-memory-history-v4-zh-4k.png"
  alt="Agent 记忆发展史：从符号状态、LSTM 到记忆工程"
  caption="图 4：用来定位当前技术阶段。Agent 记忆的竞争，已经从“能不能保存状态”转向“写什么、何时想起、怎样修订、谁能删除”。"
>}}

### 第一阶段：状态写在程序里

早期符号 AI 与认知架构已经有工作记忆、产生式规则和长期知识，只是状态由程序员定义，表征结构也高度人工化。它们解决的是「推理系统如何维护状态」，而不是今天的自然语言个性化记忆。

### 第二阶段：让神经网络学会保存与寻址

LSTM 用门控循环状态缓解长程依赖；2014 年 Neural Turing Machine 又把网络与可微读写的外部记忆矩阵连接起来。这里的目标是端到端学会复制、排序和关联回忆等算法。

原始论文：[Neural Turing Machines (2014)](https://arxiv.org/abs/1410.5401)

这条路线把 memory 做进模型架构，但训练难度、规模化和可治理性限制了它成为通用 Agent 的用户记忆层。

### 第三阶段：Transformer 把 Context 变成通用工作区

Transformer 让序列内部任意位置之间直接交互，prompt 逐渐成为统一接口。模型权重不再需要为每次任务变化；规则、示例、文档和工具结果都可以在推理时提供。

代价是每次调用默认从一份新 context 开始。所谓「LLM 无状态」，更准确地说是：**模型 API 不替应用承诺跨调用状态语义。**

### 第四阶段：RAG 把非参数记忆接到生成前

2020 年的 RAG 把参数模型与可检索的非参数语料结合。它最初解决的是知识密集型任务与来源更新，不是个人记忆；但「先检索，再生成」很快成为 Agent 长期记忆的基本读取模式。

原始论文：[Lewis et al., “Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks” (2020)](https://arxiv.org/abs/2005.11401)

这里要保留一个边界：**RAG 是读取机制，不是完整记忆系统。** 如果数据从未经过经历驱动的写入、更新、冲突处理或遗忘，它更像外部知识库。

### 第五阶段：2023 年把写入、反思、技能与分层组合起来

2023 年几项工作几乎同时补上了不同缺口：

- **Generative Agents**：事件流 + recency / relevance / importance 检索 + reflection，把情景事件巩固为高层理解；
- **Voyager**：把成功代码沉淀为可复用 skill library，突出程序记忆；
- **MemGPT**：借用操作系统虚拟内存，把有限 context 当作工作集，由 Agent 工具化地在不同层级间搬运信息；
- **CoALA**：把工作记忆、情景、语义、程序记忆与决策循环统一成语言 Agent 的认知架构。

原始论文：[Generative Agents](https://arxiv.org/abs/2304.03442) · [Voyager](https://arxiv.org/abs/2305.16291) · [MemGPT](https://arxiv.org/abs/2310.08560) · [CoALA](https://arxiv.org/abs/2309.02427)

### 第六阶段：2024–2026 年，竞争从「能记」转向「怎么治理」

今天开源项目真正分化的地方已经不是有没有 vector search，而是：

- 谁决定写入；
- 记忆是事件、事实、文档、图边还是可执行技能；
- 冲突是覆盖、并存还是带时间失效；
- 是否保留 provenance；
- 是否有后台巩固；
- 是否能按 user / agent / tenant 隔离；
- 是否能查看、修改、导出与删除；
- 记忆失败时是否可观测。

这就是接下来代码审计的尺子。

---

## 四、怎么读一个「Agent 记忆」开源项目

我没有按官网 benchmark 排名。跑分会受到基础模型、回答 Prompt、裁判模型、检索预算和数据清洗影响，而且「记忆问答」高分不等于权限、删除、稳定性和成本都适合生产。

本次审计固定在 2026-07-30 可见的仓库版本，并观察七个层面：

1. **写入路径**：谁触发，是否有门控、去重和结构化抽取；
2. **记忆表征**：原始事件、事实、画像、图、Prompt 还是技能；
3. **存储抽象**：文件、SQL、向量、图，能否替换；
4. **检索路径**：精确、向量、BM25、图遍历、rerank；
5. **时间与冲突**：覆盖、失效、版本、双时序；
6. **系统边界**：只是库，还是含 Agent Runtime、API、租户和运维；
7. **闭环完整度**：有没有巩固、反馈、遗忘、删除和观测。

下面这张图承担的是**选型导航**，不是展示项目 Logo，也不是给出总分。最有用的读法是逐行看：官网卖点在左，真实代码主链路在中间，系统边界和记忆范式在右。这样可以迅速判断一个项目是在提供 SDK、Runtime、图引擎、框架工具箱、知识管线，还是研究实现，再决定是否值得进入后面的详细审计。

{{< figure
  src="/images/posts/llm-memory-research/open-source-memory-architectures-v4-zh-4k.png"
  alt="六类开源 Agent 记忆系统的系统边界与记忆范式"
  caption="图 5：用来缩短项目选型路径，而不是评选“综合第一”。完整 Runtime 更重，轻量工具箱更容易嵌入；关键是系统边界与目标记忆范式是否匹配。"
>}}

### 总表：宣传卖点、代码事实与记忆范式

| 项目 | 对外卖点 | 实际代码主链路 | 更像哪类记忆 | 架构类型 | 主要边界 |
|---|---|---|---|---|---|
| **Mem0** | Universal memory layer、个性化、跨会话学习 | 历史与向量召回 → LLM 增量事实抽取 → 批量 embedding → vector store；SQLite 记消息/变更 | 语义事实为主，兼顾用户/Agent scope | 可插拔 Memory SDK | Runtime、任务状态和完整治理不在核心内 |
| **Letta** | Stateful agents、自我改进、先进记忆 | AgentState + memory blocks + messages/passages + context window calculator + agent loop/tools | 工作 + 情景 + 语义，Agent 主动管理 | 完整 Stateful Agent Runtime | 较重；采用它往往也采用它的 Agent 运行模型 |
| **Graphiti** | 实时 temporal context graph、历史真值 | episode → entity/fact 抽取 → 双时序边 → semantic/BM25/graph hybrid search | 带情景溯源的时序语义记忆 | 专用 Temporal Graph Engine | 不自带完整用户/会话/Agent 服务 |
| **LangMem** | Agent 持续学习、热路径工具、后台记忆 | manage/search tools + background manager + LangGraph BaseStore + prompt optimizer | 语义 / 情景模板 + 程序记忆 | Framework Toolkit | 持久化、部署、权限主要继承 LangGraph/自建系统 |
| **Cognee** | 把数据 cognify 成 AI memory、替代传统 RAG | add → cognify pipeline → graph/vector/relational storage → search/memify | 企业语义记忆与知识图谱 | Knowledge Pipeline / Infrastructure | 个人对话记忆生命周期不是唯一中心 |
| **MemoryOS** | OS 式短/中/长期分层、个性化 | 短期 QA 队列 → 中期 segment/heat → LLM 画像与知识抽取 → 长期 JSON/embedding 检索 | 情景到语义的分层巩固 | Research Reference Implementation | 生产级租户、事务、治理与代码收敛度仍需补齐 |

下面逐个拆开。

---

## 五、六大开源系统：宣传与代码之间到底隔着什么

### 1. Mem0：不是「大脑」，而是一条事实蒸馏与检索管线

Mem0 的定位非常清楚：给现有应用加一个统一的长期记忆层。API 围绕 `add / search / get / update / delete`，并提供多种 LLM、embedding、vector store 和 reranker provider。

在当前 OSS Python 实现里，v3 写入主链路可以直接从 [`mem0/memory/main.py`](https://github.com/mem0ai/mem0/blob/9c2d6222ce86bf6a73ae7ca97464a8e1a55ab3ca/mem0/memory/main.py) 读出来：

1. 根据 `user_id / agent_id / run_id` 建立 scope；
2. 从 SQLite 取最近消息；
3. 用当前对话去 vector store 召回既有记忆；
4. 把「旧记忆 + 新消息 + 最近上下文」交给 LLM 做一次增量抽取；
5. 对抽出的 memory texts 批量 embedding；
6. 写回向量库，并记录历史。

这说明它的核心不是保存原始聊天，而是让 LLM 把对话**蒸馏成较短的可检索事实**。

**宣传成立的部分：**

- 接入成本低；
- provider abstraction 完整；
- scope、metadata、history、async API、reranker 等工程接口较成熟；
- 很适合「记住偏好、身份信息、过去决定」。

**宣传容易让人误解的部分：**

- universal 不代表自动适合所有记忆类型；
- 核心默认仍偏语义事实，不是完整的工作记忆或技能系统；
- 事实抽取依赖 LLM，因此写入时就可能发生遗漏、归因错误和错误概括；
- vector search 能找相似内容，但不能天然回答复杂历史真值。

{{< alert icon="circle-info" >}}
**对应范式：** 以 semantic memory 为主的 external memory layer。
{{< /alert >}}

### 2. Letta：记忆不是外挂，而是 Agent Runtime 的状态模型

Letta 的前身就是 MemGPT。它和 Mem0 最大的差别，不是检索算法，而是系统边界。

从 [`AgentState`](https://github.com/letta-ai/letta/blob/b76da9092518cbaa2d09042e52fdcbde69243e18/letta/schemas/agent.py)、[`Memory`](https://github.com/letta-ai/letta/blob/b76da9092518cbaa2d09042e52fdcbde69243e18/letta/schemas/memory.py)、[`Passage`](https://github.com/letta-ai/letta/blob/b76da9092518cbaa2d09042e52fdcbde69243e18/letta/schemas/passage.py) 和 [`agent_loop.py`](https://github.com/letta-ai/letta/blob/b76da9092518cbaa2d09042e52fdcbde69243e18/letta/agents/agent_loop.py) 可以看到：

- memory blocks 是 Agent 状态的一部分；
- messages、passages、tools、model config 与 Agent identity 一起持久化；
- context window calculator 决定哪些状态进入本轮；
- Agent 可以通过工具修改自己的记忆，而不只是被动接受后台抽取；
- server、API、ORM、multi-agent group 都在同一代码库的运行模型中。

**宣传成立的部分：**

- 它确实是 stateful agent platform，不只是一个 vector wrapper；
- memory 与 Agent loop、工具和 context budgeting 一体化；
- 很适合长期运行、需要自我维护状态的 Agent。

**代价：**

- 你采用的不只是一个 memory library，而是一整套 Agent Runtime；
- 自主改写记忆提高了能力，也扩大了 prompt injection、错误写入和权限边界；
- Runtime 很完整，不代表每个具体场景都需要这么重。

{{< alert icon="circle-info" >}}
**对应范式：** OS-style hierarchical memory + model-managed memory；覆盖 working、episodic、semantic，程序记忆则更多通过 tools/files/skills 承载。
{{< /alert >}}

### 3. Graphiti：真正的卖点不是「图」，而是时间与溯源

很多知识图谱项目都能存 `subject - predicate - object`。Graphiti 的差异在于 episode provenance 与双时序关系。

从 [`graphiti_core/edges.py`](https://github.com/getzep/graphiti/blob/2645dee20fd71797a61e1c6177a93cccd5584574/graphiti_core/edges.py) 和 [`graphiti.py`](https://github.com/getzep/graphiti/blob/2645dee20fd71797a61e1c6177a93cccd5584574/graphiti_core/graphiti.py) 可以看到：

- episode 保存原始输入与来源；
- entity node 表示人、物、组织或概念；
- entity edge 表示事实关系；
- `valid_at / invalid_at` 描述事实何时在现实中有效；
- `created_at / expired_at` 描述系统何时知道、何时失效；
- 搜索 recipes 组合 semantic、BM25、graph traversal 与 rerank。

这让系统可以同时回答：

- 现在什么是真的？
- 2025 年 3 月时什么是真的？
- 我们什么时候才知道它变了？
- 这条边由哪次 episode 推导出来？

**宣传成立的部分：**

- 时序与 provenance 是真实的数据模型，不只是 Prompt 里写一句「考虑时间」；
- 对变化的实体关系、多跳查询、审计非常有价值；
- graph backend 和搜索 recipe 有明确抽象。

**必须看清的边界：**

- 开源 Graphiti 是图引擎，不是完整的用户、会话与 Agent 产品；
- README 也明确区分 Graphiti 与托管 Zep：用户管理、规模化检索、治理、SLA 和开发工具属于更外层；
- 图构建依赖 LLM 结构化抽取，schema 与模型质量会直接影响写入正确性。

{{< alert icon="circle-info" >}}
**对应范式：** temporal semantic memory + episodic provenance。
{{< /alert >}}

### 4. LangMem：最像一盒积木，而不是一台记忆服务器

LangMem 的价值在于把常见记忆动作做成可组合原语：

- 热路径里的 `manage_memory` / `search_memory` tools；
- 后台 manager 做抽取、合并和更新；
- profile 与 collection 两种语义记忆形态；
- 从成功/失败轨迹优化 Prompt 的 procedural memory；
- 通过 LangGraph `BaseStore` 持久化。

代码核心可见 [`knowledge/extraction.py`](https://github.com/langchain-ai/langmem/blob/56d85939d80bb731bd5e237567148d817d7bfd16/src/langmem/knowledge/extraction.py) 与 [`prompts/optimization.py`](https://github.com/langchain-ai/langmem/blob/56d85939d80bb731bd5e237567148d817d7bfd16/src/langmem/prompts/optimization.py)。

**宣传成立的部分：**

- 同时覆盖 in-the-loop 与 background 两种写入模式；
- procedural memory 不是一句口号，确实有 Prompt optimizer；
- 对已经使用 LangGraph 的项目，组合自由度很高。

**边界：**

- 它不自带独立的生产数据库、用户系统或完整 Agent Server；
- `InMemoryStore` 示例重启就丢，生产需要 Postgres Store 或其他 BaseStore；
- 一致性、权限、删除与观测取决于外层 LangGraph 平台或你自己的实现。

{{< alert icon="circle-info" >}}
**对应范式：** memory primitives；重点覆盖 semantic 与 procedural memory。
{{< /alert >}}

### 5. Cognee：更像知识基础设施，而不是聊天偏好记忆

Cognee 宣称把原始数据转成 AI memory，代码里真正成熟的部分是一条 ECL 风格知识管线：

```text
add
  → classify / chunk
  → cognify（LLM 抽实体与关系）
  → graph + vector + relational storage
  → search / memify
```

[`cognify.py`](https://github.com/topoteretes/cognee/blob/88aa09b4e3289e3dbf12c0c090080920816e2fb7/cognee/api/v1/cognify/cognify.py) 组织 pipeline；数据库层有 graph/vector interface；上层还有 dataset、user、role 与 ACL。

**宣传成立的部分：**

- 数据摄取、任务管线、图/向量/关系数据库适配做得很完整；
- 支持多种 search type、ontology 和多租户权限；
- 对文档、代码、企业数据形成持久知识图很有吸引力。

**需要校准的部分：**

- 它最强的是 semantic knowledge infrastructure；
- 如果需求只是「记住这个用户不吃香菜」，完整 cognify pipeline 可能过重；
- 如果需求是大量异构资料、关系查询、权限隔离，它又比纯聊天 memory SDK 更合适。

{{< alert icon="circle-info" >}}
**对应范式：** graph-structured semantic memory / knowledge memory。
{{< /alert >}}

### 6. MemoryOS：脑科学启发最直观，生产架构仍偏研究参考

MemoryOS 把短期、中期和长期做成显式层级：

- 短期保存最近 QA；
- 容量达到阈值后迁移到中期 session segment；
- segment 具有 heat；
- 热度达到阈值后，用 LLM 更新 user profile、用户知识与 assistant knowledge；
- Retriever 从中期页面与长期知识中取回内容，再拼回生成 Prompt。

这些链路可以在 [`memoryos-pypi/memoryos.py`](https://github.com/BAI-LAB/MemoryOS/blob/587ed7755c7aed179965792830ff1b5ad9a6fa92/memoryos-pypi/memoryos.py) 直接读到。

**宣传成立的部分：**

- 分层、迁移、热度和巩固都有明确实现；
- 很适合复现论文，观察 episodic → semantic consolidation；
- 代码直观，研究者容易修改策略。

**代码层面的现实：**

- 默认实现大量使用本地 JSON、SentenceTransformer 与 LLM 调用；
- `memoryos-pypi`、`memoryos-playground`、`memoryos-chromadb`、`memoryos-mcp` 保留多份近似模块；
- 事务、并发、租户隔离、统一 schema、迁移、监控与细粒度删除仍需要应用补齐。

这不是说它「差」，而是它交付的是研究型参考实现，不应和完整平台用同一把尺子衡量。

{{< alert icon="circle-info" >}}
**对应范式：** hierarchical episodic memory → profile/semantic consolidation。
{{< /alert >}}

---

## 六、真正公平的比较：不是一张总分榜，而是八个能力面

| 能力面 | Mem0 | Letta | Graphiti | LangMem | Cognee | MemoryOS |
|---|---|---|---|---|---|---|
| 当前任务状态 | 外部 Runtime 负责 | **核心能力** | 非核心 | LangGraph 负责 | 非核心 | 短期层覆盖一部分 |
| 情景事件 | 可由应用保留，核心偏蒸馏事实 | messages / passages | **episode 是一等对象** | 可用 schema 抽取 | 可摄取 | **短中期核心** |
| 语义事实 / 画像 | **核心能力** | memory blocks | entity / fact graph | **核心能力** | **核心能力** | 长期层 |
| 程序记忆 | 有 agent/procedural 路径，但非最强项 | tools / files / skills | 非核心 | **Prompt optimizer** | rules / memify 可扩展 | 非核心 |
| 时序冲突 | 主要靠抽取与 metadata 策略 | 由 Agent / 应用策略决定 | **双时序原生** | 由 schema / manager 决定 | 有 temporal search，取决于数据模型 | 画像合并与热度迁移 |
| 存储可插拔 | **强** | 平台持久化模型 | 图 backend 可换 | BaseStore 可换 | **图/向量/关系适配强** | 有不同发行实现 |
| 完整 Agent Runtime | 否 | **是** | 否 | 否 | 否 | 带生成流程的研究 runtime |
| 最自然的使用方式 | 给现有应用加记忆 API | 直接构建长期有状态 Agent | 给动态关系加时间图 | 给 LangGraph 拼记忆策略 | 建企业知识记忆层 | 做实验与论文复现 |

加粗不是绝对优劣，而是该项目把主要复杂度投入在哪里。

### 为什么 benchmark 不能替代这张表

LoCoMo、LongMemEval 等 benchmark 很有价值，但它们主要观察回答是否利用了历史。生产系统还要面对：

- **写错**：LLM 把推测当成用户事实；
- **记太多**：每轮都生成重复、低价值条目；
- **旧事实复活**：相似度高但已经过期；
- **跨用户泄漏**：scope 或 filter 漏掉；
- **记忆投毒**：外部内容诱导 Agent 写入长期指令；
- **不可删除**：衍生摘要、向量、图边和缓存没有级联清理；
- **不可解释**：回答用了哪条记忆无法追踪；
- **成本失控**：每轮抽取、embedding、rerank 与图构建叠加。

一个 LoCoMo 分数更高的系统，完全可能不适合医疗、金融或多租户 SaaS。

---

## 七、怎样为自己的 Agent 选记忆范式

### 场景 A：编程 Agent、个人工具、几百条稳定规则

优先：

```text
Markdown / JSON
  + 明确命名空间
  + Git 版本
  + BM25 或简单全文检索
```

原因是可读、可 diff、可审查。文件记忆不是「落后版向量库」；在精确术语多、数据量小、规则必须确定性加载的场景，它往往更可靠。

只有出现跨语言、同义改写或数千条以上内容时，再加 embedding 做辅助召回。

### 场景 B：聊天助手、客服、轻量个性化

优先 Mem0 或 LangMem 风格：

```text
对话
  → 写入门控
  → 事实 / profile 抽取
  → user-scoped store
  → semantic retrieval
```

关键不是选哪个向量库，而是先设计：

- 哪些内容禁止写；
- 用户能否查看与删除；
- 新旧偏好如何替代；
- 模型不确定时是否只存原始 episode。

### 场景 C：长期自治、模型要主动维护自身状态

优先 Letta 风格的完整 Runtime。

你需要的不只是「搜索历史」，而是 Agent identity、memory blocks、消息持久化、context budgeting、工具权限与 Agent loop 一起工作。

### 场景 D：事实会变化，还要回答历史状态

优先 Graphiti 风格的 temporal graph。

典型问题：

- 客户之前属于哪个合同版本？
- 某人何时从团队 A 转到团队 B？
- 系统在做出决定时掌握的是哪一版事实？

这些不是把 top-k 从 5 调到 20 能解决的。

### 场景 E：企业文档、多源数据、知识关系与权限

优先 Cognee 风格的 knowledge pipeline，或在现有数据平台上构建图 + 向量 + SQL 混合层。

这里 memory 更接近「可持续更新、可检索、可授权的组织知识」，不只是聊天回忆。

### 场景 F：研究分层巩固、热度、遗忘策略

MemoryOS 适合当可读、可改的实验基线；不要把论文参考实现未经补强就当成高并发多租户服务。

---

## 八、我会怎样设计一个可上线的 Agent 记忆层

前面的图负责定义概念和比较项目，这张图才是**落地蓝图**。阅读顺序是自上而下：顶部是一次请求经过的在线读写链路，中部是按记忆类型拆开的持久层，底部是来源血缘、巩固、冲突修订和删除等后台治理。它的目的不是要求所有团队照抄组件，而是确保生产设计没有漏掉生命周期中的关键责任。

{{< figure
  src="/images/posts/llm-memory-research/production-memory-blueprint-v4-zh-4k.png"
  alt="可上线的 Agent 记忆层：写入、存储、召回、过滤与维护"
  caption="图 6：用来把全文判断转成实施检查表。生产级记忆不是一个向量库，而是从原始事件、写入门控到召回、权限过滤、上下文组装和后台治理的一整层系统。"
>}}

### 1. 原始事件与派生记忆分开

```text
event_log（不可变、可审计）
  ├─ conversation
  ├─ tool_result
  ├─ user_correction
  └─ environment_observation

derived_memory（可更新、可失效）
  ├─ profile_fact
  ├─ episodic_summary
  ├─ entity_relation
  ├─ procedure
  └─ policy
```

任何派生记忆都保存 `source_event_ids`。删除源数据时，系统才知道哪些摘要、embedding 和图边需要重建或撤销。

### 2. 写入门控先于 embedding

门控至少判断：

- 是否与未来任务有关；
- 是明确事实还是模型推断；
- 是否含敏感信息；
- 用户是否授权持久化；
- 是否已存在；
- 应写成 episode、fact、relation 还是 procedure。

**每条记忆都是未来每次检索的税。**

### 3. 不同记忆类型使用不同主键与检索

| 类型 | 推荐主键 | 首选检索 |
|---|---|---|
| Profile fact | `tenant/user/fact_type` | 精确键 + 版本 |
| Episode | `tenant/user/time/event_id` | 时间过滤 + hybrid search |
| Relation | entity IDs + relation type + validity | 图查询 + 时间 |
| Procedure | task signature + version | 路由 + 语义召回 |
| Policy | scope + priority + version | 确定性挂载 |

不要用一个 embedding collection 代替 schema 设计。

### 4. 把时间和来源当成一等字段

最小字段建议：

```yaml
id:
tenant_id:
subject_id:
memory_type:
content:
source_event_ids:
confidence:
valid_from:
valid_to:
created_at:
expired_at:
supersedes:
access_scope:
```

如果事实会变化，再考虑 Graphiti 式双时序；如果事实简单，至少保留 `valid_from / valid_to / supersedes`。

### 5. 读取要做候选生成、过滤与组装

一个稳健读取链路通常是：

```text
query
  → scope / ACL filter
  → exact + BM25 + vector + graph candidates
  → recency / importance / validity rerank
  → contradiction check
  → token budget packing
  → provenance-preserving context
```

「相似」只是其中一个信号。

### 6. 巩固与遗忘都走后台任务

后台任务负责：

- 相似 episode 聚类；
- 提取稳定事实；
- 更新画像；
- 生成 procedure；
- 标记被替代事实；
- 低价值内容降权；
- TTL 与用户删除；
- 重建受影响索引。

在线路径只做必要的快速写入，避免每轮对话承担全部 LLM 成本。

### 7. 用任务结果评估，而不只用问答准确率

至少观察：

- write precision：写入的条目有多少真的值得保留；
- stale recall rate：召回结果中有多少已失效；
- provenance coverage：有多少回答能追到源事件；
- cross-tenant leakage：必须为零；
- deletion completeness：删除后派生数据是否残留；
- task success delta：加记忆后任务成功率是否真的提高；
- token / latency / cost：每次有效记忆带来的边际成本。

---

## 九、最后的判断：Agent 记忆会向哪里演进

短期内，不会有一个「最像人脑」的项目统一市场。更可能出现三层收敛：

1. **Runtime 层**：维护当前任务、Agent identity、工具权限和 context；
2. **Memory service 层**：管理事件、事实、关系、技能、时间与删除；
3. **Model 层**：更长 context、更好的 test-time learning，以及可能的架构内 memory module。

真正稳定的接口不会是 `vector_db.search(text)`，而会逐渐接近：

```text
remember(event, policy)
recall(query, scope, time, budget)
revise(memory, evidence)
forget(subject, reason)
explain(memory_id)
```

人类记忆科学用了一百多年，才从「记忆存在哪里」走到「多个系统怎样在提取中重构过去」。Agent 记忆工程也正在经历同样的概念升级：

{{< alert icon="lightbulb" >}}
**我们不再问 Agent 有没有 memory，而是问：它把什么变化保留下来，为什么保留，何时想起，怎样修订，以及谁有权让它忘记。**
{{< /alert >}}

---

## 关键一手资料与代码入口

### 人类记忆科学

- [Ebbinghaus — *Memory: A Contribution to Experimental Psychology*](https://psychclassics.yorku.ca/Ebbinghaus/)
- [Müller & Pilzecker — *Experimentelle Beiträge zur Lehre vom Gedächtniss*](https://books.google.com/books?id=5RdCAQAAMAAJ)
- [Scoville & Milner — H.M. 双侧海马相关病例](https://pmc.ncbi.nlm.nih.gov/articles/PMC497229/)
- [Baddeley & Hitch — Working Memory](https://doi.org/10.1016/S0079-7421%2808%2960452-1)
- [2014 Nobel Prize — place cells 与 grid cells 科学背景](https://www.nobelprize.org/prizes/medicine/2014/advanced-information/)
- [Nader, Schafe & LeDoux — Reconsolidation](https://pubmed.ncbi.nlm.nih.gov/10963596/)
- [Liu et al. — Optogenetic activation of a hippocampal engram](https://pmc.ncbi.nlm.nih.gov/articles/PMC3331914/)

### Agent 记忆论文

- [Neural Turing Machines](https://arxiv.org/abs/1410.5401)
- [Retrieval-Augmented Generation](https://arxiv.org/abs/2005.11401)
- [Generative Agents](https://arxiv.org/abs/2304.03442)
- [Voyager](https://arxiv.org/abs/2305.16291)
- [CoALA](https://arxiv.org/abs/2309.02427)
- [MemGPT](https://arxiv.org/abs/2310.08560)
- [Lost in the Middle](https://arxiv.org/abs/2307.03172)

### 固定提交的代码审计入口

- [Mem0 `memory/main.py` @ `9c2d622`](https://github.com/mem0ai/mem0/blob/9c2d6222ce86bf6a73ae7ca97464a8e1a55ab3ca/mem0/memory/main.py)
- [Letta `schemas/memory.py` @ `b76da90`](https://github.com/letta-ai/letta/blob/b76da9092518cbaa2d09042e52fdcbde69243e18/letta/schemas/memory.py)
- [Graphiti `graphiti_core/edges.py` @ `2645dee`](https://github.com/getzep/graphiti/blob/2645dee20fd71797a61e1c6177a93cccd5584574/graphiti_core/edges.py)
- [LangMem `knowledge/extraction.py` @ `56d8593`](https://github.com/langchain-ai/langmem/blob/56d85939d80bb731bd5e237567148d817d7bfd16/src/langmem/knowledge/extraction.py)
- [Cognee `cognify.py` @ `88aa09b`](https://github.com/topoteretes/cognee/blob/88aa09b4e3289e3dbf12c0c090080920816e2fb7/cognee/api/v1/cognify/cognify.py)
- [MemoryOS `memoryos.py` @ `587ed77`](https://github.com/BAI-LAB/MemoryOS/blob/587ed7755c7aed179965792830ff1b5ad9a6fa92/memoryos-pypi/memoryos.py)

---

*审计时间：2026-07-30。开源项目变化很快，因此代码判断全部链接到固定提交；官网卖点只用于说明项目自我定位，不作为架构事实。*
