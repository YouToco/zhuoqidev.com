---
title: "OpenClaw 记忆实战：从「向量搜索挂了也能用」到用 NVIDIA 免费 API 补全最后一块拼图"
description: "OpenClaw 记忆系统的向量检索默认不可用——但 BM25 文本搜索兜底让系统照常运转。当你发现「不配 embedding 也能跑」，到底要不要修？怎么用 NVIDIA 免费 embedding API 零成本补上？这是一篇生产环境的真实记录。"
date: 2026-06-20
tags: ["OpenClaw", "AI Agent", "记忆系统", "Embedding", "NVIDIA", "向量搜索", "BM25"]
categories: ["AI Agent 工程"]
series: ["OpenClaw 生产实战"]
series_order: 2
seriesOpened: true
summary: "OpenClaw 记忆系统的向量检索默认不可用——但 BM25 文本搜索兜底让系统照常运转了两周。当你发现「不配 embedding 也能跑」，到底要不要修？怎么用 NVIDIA 免费 API 零成本补上？"
showToc: true
ShowReadingTime: true
---

> 这是 [OpenClaw 生产实战](/series/openclaw-生产实战/) 系列的第二篇。[第一篇](/posts/openclaw-pitfalls/) 聊的是 compaction 静默吞回复和 Outer Loop 的防御性设计。这篇聚焦记忆系统——具体来说，是一个让我重新理解"向量检索到底值不值"的真实经历。

## 背景：OpenClaw 的记忆检索是怎么工作的

OpenClaw 的记忆检索是一个**混合检索系统**——向量（embedding similarity）和 BM25（文本关键词匹配）按 7:3 权重融合，再经过 PPO 自适应的五维加权（recency 0.35 + frequency 0.25 + semantic 0.25 + saliency 0.15 + procedural 按需）产出最终结果。

架构上看：

```
用户查询
   ↓
┌──────────────┐   ┌──────────────┐
│ 向量检索(70%) │   │ BM25 检索(30%)│
│  embedding → │   │ 关键词匹配 → │
│  余弦相似度   │   │ TF-IDF 打分  │
└──────┬───────┘   └──────┬───────┘
       └────────┬─────────┘
                ↓
        混合排序 + PPO 五维加权
                ↓
           Top-K 记忆片段
```

看起来很完美。但部署后跑了两周，我发现了一个让人困惑的事实。

## 发现：向量搜索挂了，系统照常运转

起因是一次常规巡检。跑 `openclaw memory status` 时，我注意到一个异常：

```
Vector store: unknown
Embedding cache: enabled (0 entries)
FTS: ready
```

**向量存储状态 unknown，embedding 缓存 0 条**——这意味着向量检索根本没在工作。但奇怪的是：记忆系统每天照常检索、Dreaming 照常巩固、Agent 的回复质量也没有明显下降。

再看 FTS（全文检索）那行：**ready**。BM25 一直在正常兜底。

追查原因，是 `openclaw.json` 里的 `memorySearch` 配置项缺少 embedding provider——系统启动时 embedding 初始化失败，静默降级到了纯 BM25 模式。没有报错、没有告警，就是悄悄地只用了 30% 权重的那条检索通道，而且它扛住了。

### 这意味着什么

903 个记忆 chunk、512 条 recall 条目——整个记忆系统跑在**纯文本检索**上，用了两周，没人发现有什么问题。

这逼着我重新审视一个基本假设：**在编程 Agent 的记忆场景下，向量检索到底有多重要？**

## 为什么 BM25 在这个场景下够用

编程 Agent 的记忆内容有几个特征，恰好是 BM25 的甜区：

**1. 记忆内容高度结构化。** OpenClaw 的记忆文件是 Markdown，有 frontmatter（`name`、`type`、`description`）、有标题层级、有明确的技术术语。不是自然语言的模糊表述，而是 `compaction safeguard`、`Gemini 429 配额耗尽`、`fable-5 全球禁用` 这样的精确描述。BM25 对这类"半结构化技术文档"的匹配效果本来就不错。

**2. 查询和文档用同一套词汇。** 用户问"compaction 怎么配"，记忆里写的就是"compaction"这个词。不存在"用户说苹果、文档写 Apple"的语义鸿沟。编程领域的术语体系高度统一——`429` 就是 `429`，`context overflow` 就是 `context overflow`。这恰好是 BM25 最擅长的：**精确词匹配**。

**3. 记忆总量在千级，不在百万级。** 99 个文件、903 个 chunk——这个规模下，BM25 的 precision 和 recall 都不会太差，因为候选集本身就不大。向量检索的优势在大规模数据集上才真正体现，1000 个 chunk 的场景下优势可忽略。

**4. PPO 五维加权弥补了检索质量。** 即使 BM25 的初始排序不够精准，recency（最近用过的记忆排前面）和 frequency（常被调用的记忆权重更高）两个维度会把高频使用的记忆推到顶部。这些维度不依赖 embedding，纯靠使用统计。

一句话总结：**在"技术术语精确、数据量千级、有使用统计加权"的场景下，BM25 本身就是一个足够好的检索方案。**

这也呼应了我在 [记忆选型框架](/posts/memory-choice-framework/) 里写的结论：**能不用 RAG 就不用 RAG**。向量检索不是默认选择，是数据量和语义复杂度逼你选的。

## 那为什么还要修？

既然 BM25 够用，为什么我最终还是把向量检索补上了？三个原因：

**1. 跨语言检索。** 我的记忆文件里中英文混杂——有些事故记录是中文（"Gemini 资源池配额枯竭"），有些是英文（"unrestricted key enforcement"）。BM25 对跨语言的模糊匹配无能为力：用中文"资源耗尽"搜不到英文的"quota exhausted"。向量检索的 embedding 空间天然做了语义对齐，同义词、跨语言都能匹配。

**2. 概念级检索。** 问"之前遇到过 bot 不回复的情况吗"——BM25 会匹配"不回复"三个字，但不会匹配 `compaction 静默吞回复`（虽然这正是答案）。向量检索能把"bot 不回复"和"静默吞回复"在语义空间里拉近。随着记忆积累越多，这种概念级关联会越来越重要。

**3. 混合检索的互补性。** 向量强在语义召回，BM25 强在精确匹配——两者混合的效果严格优于任何单独一个。7:3 的权重分配意味着：BM25 给你保底的精确匹配，向量给你锦上添花的语义发现。前两周纯 BM25 够用，但"够用"和"好用"之间差了一个向量检索。

## 实现：用 NVIDIA 免费 Embedding API 零成本补全

修复的关键约束是：**不能花钱**。OpenClaw 本身已经在消耗模型 API 额度，如果 embedding 还要按 token 计费（OpenAI `text-embedding-3-small` 每百万 token $0.02），对于 903 个 chunk 的持续索引和每次查询的实时 embedding，虽然不多但完全没必要。

NVIDIA 的 `nv-embed-v1` 是免费的 embedding 模型，通过 NVIDIA API Catalog 提供，兼容 OpenAI API 格式。它在 MTEB 排行榜上的表现和 OpenAI 的 embedding 模型在同一梯队，4096 维度，对多语言支持良好。

### 获取 API Key

1. 注册 [NVIDIA API Catalog](https://build.nvidia.com/) 账号
2. 在 NV-Embed-V1 模型页面点击 "Get API Key"
3. 拿到一个 `nvapi-` 前缀的 key，免费使用，有速率限制但对 Agent 记忆这种低频场景完全够用

### 配置 OpenClaw

在 `openclaw.json` 的 agent 配置中加入 `memorySearch` 段：

```json
{
  "agents": {
    "defaults": {
      "memorySearch": {
        "enabled": true,
        "provider": "openai",
        "remote": {
          "baseUrl": "https://integrate.api.nvidia.com/v1",
          "apiKey": "nvapi-你的key"
        },
        "model": "nvidia/nv-embed-v1"
      }
    }
  }
}
```

这里有一个关键点：`provider` 填的是 `"openai"` 而不是 `"nvidia"`。因为 NVIDIA API Catalog 的接口完全兼容 OpenAI 的 `/v1/embeddings` 格式——request body 结构一样、response 格式一样。OpenClaw 只要知道"这是一个 OpenAI 兼容的 embedding 端点"，剩下的全靠 `baseUrl` 路由到 NVIDIA 的服务器。

这也是 OpenAI embedding API 格式成为事实标准的一个例证：NVIDIA、阿里通义、Jina、Cohere 等厂商的 embedding API 全都兼容这个格式。选 provider 时不用纠结，只要接口兼容，`"openai"` 就是万能适配器。

### 重建索引

改好配置后重启 Gateway，然后重建记忆索引：

```bash
openclaw memory reindex --deep
```

输出：

```
Indexed: 99/99 files · 903 chunks
Vector dims: 4096
Embedding cache: enabled (779 entries)
```

99 个文件全部被重新 embedding、索引到向量存储里。4096 维度是 nv-embed-v1 的默认维度，比 OpenAI 的 1536 维（text-embedding-3-small）更高，理论上语义空间更细腻。

### 验证混合检索

用语义模糊的查询测试：

```bash
openclaw memory search "之前 bot 不响应的事故怎么回事"
```

返回的 top-1 结果是 compaction 静默吞回复的记忆条目——这在纯 BM25 模式下是匹配不到的（因为记忆里没有"不响应"这三个字，只有"静默丢弃"和"Compaction 输出空摘要"）。

再试一个跨语言的：

```bash
openclaw memory search "Gemini quota issue"
```

匹配到了中文写的"Gemini 资源池整体配额枯竭"记忆条目。BM25 不可能完成这个匹配。

## 修复前后对比

| 维度 | 修复前（纯 BM25） | 修复后（向量 + BM25 7:3） |
|------|----------|----------|
| 精确术语匹配 | 正常 | 正常 |
| 语义/概念匹配 | 不支持 | 支持 |
| 跨语言检索 | 不支持 | 支持 |
| 同义词匹配 | 不支持 | 支持 |
| 成本 | 0 | 0（NVIDIA 免费） |
| 索引规模 | 903 chunks | 903 chunks |
| Embedding 缓存 | 0 | 779 条 |
| 检索延迟 | <10ms | <50ms（含 API 调用） |
| 系统稳定性 | 稳定 | 稳定（BM25 仍兜底） |

最后一行值得强调：即使 NVIDIA 的 API 偶尔超时或不可用，系统会自动降级回纯 BM25——和修复前一模一样。**向量检索是增益，不是依赖。**

## 经验总结

**1. 先跑起来，再补锦上添花。** 向量检索没配好，系统跑了两周没人发现。这说明记忆系统的核心价值不在检索算法的精度，而在"记忆是否被写入、是否被管理、是否在需要时出现"。BM25 能解决 80% 的检索场景，剩下 20% 的语义匹配是优化项，不是必需品。

**2. 混合检索的正确心态是"BM25 保底、向量加分"。** 不要反过来理解成"向量为主、BM25 辅助"。在生产环境里，确定性（BM25 的精确匹配一定能找到关键词完全一致的记忆）比概率性（向量的语义相似度可能把不相关的内容排上来）更重要。7:3 的权重分配里，那个 3 才是系统的安全网。

**3. OpenAI 兼容格式是 embedding 领域的事实标准。** 无论你用 NVIDIA、阿里、Jina 还是 Cohere 的 embedding 模型，配置方式都是：`provider: "openai"` + `baseUrl: "厂商端点"` + `model: "模型名"`。不需要为每个厂商写适配器。这也意味着：如果 NVIDIA 的免费额度哪天取消了，切换到其他免费 embedding 服务只需要改两行配置。

**4. 免费 ≠ 不好用。** NVIDIA nv-embed-v1 是 MTEB 同梯队的模型，4096 维度，多语言支持良好。它免费是因为 NVIDIA 要推广自己的 API 生态——你拿到的是一个真正有竞争力的 embedding 模型，不是阉割版。

**5. "向量检索到底值不值"取决于你的数据特征。** 如果你的记忆全是精确技术术语、数据量在千级、查询和文档用同一套词汇——BM25 就够了，向量检索是可选项。如果你的记忆里有跨语言内容、自然语言描述、概念级关联——向量检索从"可选"变成"需要"。我的场景是后者（中英文混杂、事故描述 vs 技术术语的语义关联），所以最终还是补上了。

---

> 下一篇：[一行路径省掉 84% 的工具调用——Cron Job 排障实录](/posts/openclaw-cron-skill-optimization/)。当你的 AI Agent 每次执行都花 15 次 exec 调用搜索一个 skill 的路径，消息数从 54 膨胀到 165，根因只是 SKILL.md 里少写了一行绝对路径。这比任何算法调优都管用。
