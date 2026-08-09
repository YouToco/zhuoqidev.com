---
title: "Codex 第一次请求到底暴露了哪些 Tool？以及 tool_search 为什么用 BM25"
description: "基于 Codex 最新稳定版 rust-v0.147.0 源码，拆解 GPT-5.6 Code Mode 首次请求的工具表、exec 嵌套工具、延迟加载，以及 tool_search 选择 BM25 的工程原因。"
date: 2026-08-08
lastmod: 2026-08-09
tags: ["Codex", "OpenAI", "Tool Calling", "Tool Search", "BM25", "MCP", "Code Mode", "AI Agent"]
categories: ["AI Agent 工程"]
series: ["Agent 架构深度"]
series_order: 3
seriesOpened: true
showToc: true
ShowReadingTime: true
---

{{< lead >}}
把 Codex 第一次请求想成机场值机：模型面前不会摊开整座机场的所有钥匙，而只拿到几张“直达登机牌”；大量具体工具收进 `exec` 这道登机口，MCP 等延迟工具则留在后方库房，需要时再由 `tool_search` 找出来。这样既省上下文，也不牺牲扩展性。
{{< /lead >}}

本文核对的是 2026-08-07 发布的最新稳定版 [`rust-v0.147.0`](https://github.com/openai/codex/releases/tag/rust-v0.147.0)，源码 commit 为 [`be6e8eac`](https://github.com/openai/codex/commit/be6e8eac029b183056b7e4402879f15d2c85f61b)，并复查了 2026-08-08 的 `main`。先给结论：**“第一次暴露哪些 Tool”没有一张脱离模型、Provider、环境和 Feature 的永久名单。** 对当前 GPT-5.6 Sol/Terra 的默认 Code Mode 路径，最有用的答案是下面这张分层图。

{{< figure
  src="/images/posts/codex-first-request-tools/first-request-airport-zh.png"
  alt="用机场值机比喻说明 Codex 第一次请求的顶层工具、exec 内嵌工具、tool_search 和延迟工具库"
  caption="机场比喻：顶层工具是模型手里的登机牌，exec 是通往常用工位的登机口，tool_search 则是照向延迟工具库的检索灯。"
>}}

## 先澄清：“暴露”其实有两层

GPT-5.6 Sol 的模型目录把 `tool_mode` 设为 `code_mode_only`、`multi_agent_version` 设为 `v2`，并启用 `use_responses_lite`。Responses Lite 不再把工具放进传统顶层 `tools` 字段，而是在输入开头插入一个 developer 角色的 `additional_tools` item。换句话说，抓包时看到 `tools` 字段缺失，不代表模型没有工具。

在这条路径里，“模型第一次能看到”分为两种：

1. **请求协议里的顶层入口**：独立出现在 `additional_tools` 里的 Tool 或 Namespace；
2. **`exec` 里的嵌套工具**：它们的名称、说明与参数定义被写进 `exec` 的 JavaScript 工具指南，模型同样能在首轮阅读，但调用时要写成 `tools.xxx(...)`。

这和机场很像：登机牌只有几张，但 `EXEC` 那张票背面已经印着登机口内有哪些柜台。不能因为柜台不是单独一张票，就说旅客不知道它存在。

## GPT-5.6 Sol/Terra 的首轮顶层入口

在默认 App/CLI 配置、存在执行环境、未被企业策略关闭的前提下，核心顶层入口可以归纳为：

| 首轮顶层入口 | 它给模型的能力 | 为什么留在顶层 |
| --- | --- | --- |
| `exec` | 执行一段 JavaScript，在同一个 cell 里编排多个嵌套工具，并只返回压缩后的结果 | Code Mode 的总入口，减少多次模型—工具往返 |
| `wait` | 等待先前 yield 的长时间 `exec` cell | 等待期间不占住一次长工具调用 |
| `request_user_input` | 在允许的协作模式中向用户提短问题 | 它是人与 Agent 的控制面，不适合藏进代码编排 |
| `collaboration` | 一个 Namespace，包含 `spawn_agent`、`send_message`、`followup_task`、`wait_agent`、`interrupt_agent`、`list_agents` | GPT-5.6 Sol/Terra 选择 Multi-Agent V2，源码默认让这组工具保持非 Code Mode 直调 |

`collaboration` 是一个工具 Namespace，不是只有一个动作。因此从请求对象数量看它算一个入口，从可调用函数数量看则是六个。Luna 的模型目录仍选择 Multi-Agent V1，所以它的首轮形态会不同；若达到子 Agent 深度限制，协作工具还可能被关闭。

## `exec` 里面又有哪些工具

`exec` 不是 Shell 的别名，而更像一张能在候机楼内转乘的通票。源码中的 `add_core_tool_sources()` 依次汇集 Shell、MCP resource、通用工具和协作工具，再叠加 Extension、Dynamic Tool 与 Hosted Tool。常见成员如下：

| 类别 | 常见工具 | 出现条件 |
| --- | --- | --- |
| 命令执行 | Windows 常见 `shell_command`；启用 Unified Exec 时是 `exec_command` + `write_stdin` | 必须有执行环境；具体形态由模型与 Feature 决定 |
| 文件修改与检查 | `apply_patch`、`view_image` | 模型支持相应 Tool，且环境/Feature 可用 |
| 工作编排 | `update_plan` | 配置默认开启，可显式关闭 |
| MCP 资源 | `list_mcp_resources`、`list_mcp_resource_templates`、`read_mcp_resource` | 至少连接了一个 MCP Server |
| App 扩展 | `web.run`、`image_gen.imagegen` | Provider、登录、模型模态、网络与 Feature 均通过门禁 |
| 插件安装 | `request_plugin_install`，有时还有候选列表工具 | Apps、Plugins、ToolSuggest 开启且确有候选项 |
| 其他扩展 | Goal、自动化、App Server dynamic tools 等 | 相应 Extension 或客户端动态注册 |

所以“源码里定义了一个 Handler”不等于“它会出现在每次首轮请求”。真正的路径是：**注册 Runtime → 计算 Direct / Deferred / Hidden exposure → 处理 Code Mode → 合并 Namespace → 序列化请求**。环境不存在、Feature 关闭、Provider 不支持 Namespace、账号方案不满足或工具名冲突，都可能在中途把它拿掉。

## 那 `tool_search` 到底在不在第一次请求里

设计上，`tool_search` 只有同时满足两件事才会注册：

- 模型声明 `supports_search_tool`，Provider 支持 Namespace Tool；
- Registry 里确实存在至少一个带 `search_info` 的 Deferred Tool。

在 `rust-v0.147.0` 中，只要 Search 可用，MCP Tool 会先注册到 Runtime，但 exposure 设为 Deferred；它们的完整 Schema 不必全部塞进首轮上下文。模型调用 `tool_search` 后，命中的 `LoadableToolSpec` 才在下一次模型调用中被暴露，默认最多返回 8 个结果。

这里有一个容易错过的最新源码细节：**GPT-5.6 的 `code_mode_only` 路径当前并没有把 `ToolSpec::ToolSearch` 转成 `exec` 的嵌套定义。** `register_code_mode_executors()` 遇到 `ToolSearch` 会 `continue`，而 Code Mode Only 又会隐藏除 `exec` / `wait` 之外的普通 Direct Tool。因此：

- 在 Direct 模式，只要存在 Deferred Tool，`tool_search` 可以成为首轮顶层工具；
- 在 GPT-5.6 Code Mode Only 的稳定版路径，它虽然可能已注册、也有 BM25 Handler，却不一定真正出现在模型首轮可调用表中；
- 这正是公开 issue [#32101](https://github.com/openai/codex/issues/32101) 描述的桥接缺口。2026-08-08 的 `main` 仍保留该跳过分支。

这一区分很重要：**Registry 里“存在”，不等于首轮请求里“可见”；设计上“应该被搜索”，也不等于当前每种 Tool Mode 都已经接通。**

## BM25 不是“不要关键词”，而是“给关键词排座次”

常有人问：为什么不用关键词匹配，反而用 BM25？这句话本身有一点误会。**BM25 仍然是词法关键词检索**，它不是 Embedding，也不理解“订会议”和“安排日程”一定是同义词。它与朴素关键词匹配的区别，是后者通常只回答“命中 / 没命中”，BM25 还会回答“谁更应该排第一”。

{{< figure
  src="/images/posts/codex-first-request-tools/bm25-library-zh.png"
  alt="用图书馆理卡比喻比较关键词命中和 BM25 对 Tool metadata 的 Top-K 排序"
  caption="关键词筛选像把所有命中的卡片倒成一堆；BM25 像熟练馆员，按稀有度、重复饱和与描述长度把最相关的卡片排到前面。"
>}}

BM25 的简化打分可以写成：

```text
score(D, Q) = Σ IDF(t) × TF_saturation(t, D) × length_normalization(D)
```

仍用图书馆来理解：

- **稀有词更值钱（IDF）**：几乎每张工具卡都写着 `get`，它像“本馆藏书”一样没什么区分度；只有少数卡片写着 `calendar`，这个词更能定位目标；
- **重复会饱和**：描述里写三次 `calendar` 可以增强信号，但不会比写一次机械地强三倍，避免关键词堆砌霸榜；
- **长描述要归一**：一本厚说明书天然更容易碰到查询词，BM25 会校正长度，避免“写得最多”自动等于“最相关”；
- **直接产出 Top-K**：`tool_search` 需要的是默认 8 个有序候选，不是一大包无序布尔命中。

源码不是只搜索 Tool 名字。普通 Tool 的索引文本会拼接 Namespace 名称与说明、Tool 名称、把下划线换成空格后的名称、Tool 描述、参数名和参数描述；MCP Tool 还会加入 canonical/callable name、Server、标题、Connector、Plugin 显示名以及输入 Schema 的属性名。也就是说，一张“工具卡”已经把用户和模型可能想到的多个入口词放在了一起。

## 源码怎么跑：从 Deferred Tool 到可加载 Schema

公式回答了“怎样打分”，但真正的实现还要回答三个问题：文档从哪里来、BM25 返回的编号怎样找回 Tool、为什么搜索结果能在下一轮变成可调用 Schema。稳定版的答案集中在 `spec_plan.rs`、`tool_search.rs` 和 `codex-tools` 的检索文本构造代码里。

先说最容易误解的一点：**Codex 没有自己手写一遍 BM25 公式。** `codex-rs/Cargo.toml` 依赖 [`bm25 = "2.3.2"`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/Cargo.toml#L294)，分词、文档频率、平均文档长度和评分由这个内存检索库完成；Codex 写的是围绕它的数据准备与结果映射。

### 第一步：只收集延迟暴露的工具

`append_tool_search_executor()` 从 Registry 过滤出 Deferred Tool，再向每个 Runtime 索取 `search_info`。下面是保留真实类型和方法名的精简代码：

```rust
let search_infos = registry
    .entries()
    .filter(|tool| tool.exposure.is_deferred())
    .filter_map(|tool| tool.runtime.search_info())
    .collect::<Vec<_>>();

registry.register_trusted(
    tool_search_handler_cache.get_or_build(search_infos, source_listing),
);
```

每个条目把“用于搜索的卡片文字”和“命中后要返回的工具定义”绑在一起：

```rust
pub struct ToolSearchEntry {
    pub search_text: String,
    pub output: LoadableToolSpec,
}
```

这里的 `search_text` 就是上一节列出的名称、描述、参数和 Namespace 等元数据；`output` 则是下一轮模型请求可以装载的 Function 或 Namespace Schema。可以把它想成图书馆索引卡：正面写着供馆员检索的关键词，背面拴着书库中那本书的提取单。

### 第二步：把数组下标当成“取书号”建索引

[`ToolSearchHandler::new()`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/handlers/tool_search.rs#L76-L110) 枚举所有卡片，把 `search_infos` 的数组下标作为 BM25 文档 ID：

```rust
let documents = search_infos
    .iter()
    .map(|info| info.entry.search_text.clone())
    .enumerate()
    .map(|(idx, text)| Document::new(idx, text))
    .collect();

let search_engine =
    SearchEngineBuilder::<usize>::with_documents(
        Language::English,
        documents,
    )
    .build();
```

这个 `usize` 很关键。BM25 引擎只需返回诸如 `7、2、11` 这样的有序文档 ID，Codex 就能用它们回查 `search_infos[7]`、`search_infos[2]`、`search_infos[11]`。没有数据库主键，也没有第二张映射表，数组位置本身就是“取书号”。整个语料一次性装进内存，并明确采用 `Language::English`。

### 第三步：搜索 Top-K，再把 ID 映射回 Schema

调用时，Handler 会先 `trim()` 查询，拒绝空字符串和 `limit = 0`；未指定 `limit` 时使用 `TOOL_SEARCH_DEFAULT_LIMIT`，也就是 8。核心搜索代码很短：

```rust
let results = self.search_engine
    .search(query, limit)
    .into_iter()
    .map(|result| result.document.id)
    .filter_map(|id| self.search_infos.get(id))
    .map(|info| &info.entry);

coalesce_loadable_tool_specs(
    results.map(|entry| entry.output.clone()),
)
```

这里有两个值得注意的细节：

1. Codex 没有把 BM25 的数值分数继续传给模型，只使用检索库已经排好的顺序；
2. `coalesce_loadable_tool_specs()` 会把同一 Namespace 下命中的多个 Tool 合并，避免返回几份重复的 Namespace 外壳。

于是完整数据流就是：

```text
Deferred Runtime
  → ToolSearchInfo(search_text + LoadableToolSpec)
  → BM25 Document<usize>
  → Top-K 有序文档 ID
  → 回查 LoadableToolSpec
  → 合并 Namespace
  → 放进下一次模型请求
```

最后还有一个性能细节：[`ToolSearchHandlerCache`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/handlers/tool_search.rs#L34-L74) 会比较新的 `search_infos` 和 Source Listing。工具世界没变就复用已有 `Arc<ToolSearchHandler>` 和内存索引；MCP、Plugin 或动态工具发生变化才重建。它很像馆藏没变时继续用昨天的卡片柜，只有进了新书才重新编目。

对应源码入口可从 [`append_tool_search_executor()`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/spec_plan.rs#L1165-L1185)、[`ToolSearchHandler`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/handlers/tool_search.rs#L76-L197) 和 [`ToolSearchEntry` / `search_text` 构造](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/tools/src/tool_search.rs#L12-L150) 三处顺着读下来。

## 为什么这个场景选 BM25 很合理

源码明确告诉我们“用了什么”，没有留下“一定因为以下五点”的设计备忘录。结合数据形态做工程推断，BM25 很适合 Tool Discovery：

1. **工具元数据是短小、结构化、术语稳定的文本。** `calendar`、`pull_request`、`spawn_agent`、`issue_number` 这类 API 名和参数名本来就适合词法检索；
2. **索引可以完全在本地重建。** Handler 直接用 Rust `bm25` crate 和 `Language::English` 建引擎，不需要请求 Embedding 服务，也不需要维护向量数据库；
3. **首轮延迟和可用性优先。** Tool 列表会随 MCP、Plugin、动态工具和策略变化，BM25 对这类小型动态语料启动快、成本低、行为可解释；
4. **目标是缩小 Schema，而不是回答开放世界问题。** 搜索只需把几十或几百张工具卡缩成 Top-K，再让强模型判断最终该调哪个；
5. **精确技术词不能被“语义相似”冲淡。** `delete_issue` 与 `get_issue` 语义相关，但权限风险完全不同。名称与参数的词法证据在工具选择里很重要。

相比之下，朴素 substring filter 没有稳定排序；Embedding 虽能处理同义词和跨语言，却增加模型/服务依赖、索引更新和相似度误召回。对一批短 Schema 来说，BM25 是很务实的中间点。

## BM25 的边界也很清楚

当前实现把语言设为 `English`，没有再叠加向量召回、同义词表、exact-name boost 或 reranker。因此这些查询并非它的强项：

- 中文问“安排会议”，工具只写 `create_calendar_event`；
- 用户说“查代码评审”，工具只写 `pull_request_review`；
- 两个 Tool 的描述大量共享模板词，真正差异藏在很少见的业务语义里。

这也是为什么 Tool 的 `name`、`description` 和参数说明不能随便写。BM25 像馆员，但它只能阅读卡片上已有的字。好的元数据应该包含用户会说的动作、对象、约束和危险性；如果未来工具规模、跨语言需求或同义表达显著增加，更稳妥的升级路线是 **BM25 召回 + exact-name boost + 轻量 rerank**，而不是立刻把一切换成纯向量。

## 最值得带走的三点

第一，第一次请求不是“把所有 Tool 全塞给模型”，而是一个由 Exposure、Tool Mode、Provider 与 Feature 共同计算出的接口面。

第二，Code Mode 把大量工具 Schema 收进 `exec`，解决的不只是 Token 数量，还减少工具调用往返，让筛选、循环和并行能留在一个 JavaScript cell 里。

第三，`tool_search` 的价值不在“神奇地理解意图”，而在用一个便宜、确定、可解释的检索层，把不断扩大的工具仓库压缩成模型能认真选择的几张卡片。BM25 仍是关键词检索，只是它比“包含这个词就算命中”聪明得多。

## 源码索引

- [GPT-5.6 Sol 模型能力与 Tool Mode](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/models-manager/models.json#L4-L22)
- [Tool Registry、Exposure 与首轮可见 Spec 规划](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/spec_plan.rs#L319-L486)
- [核心 Tool 的条件化注册](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/spec_plan.rs#L818-L1118)
- [Responses Lite 的 `additional_tools` 请求封装](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/client.rs#L849-L885)
- [`tool_search` 的 BM25 Engine 与 Top-K 返回](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/handlers/tool_search.rs#L76-L169)
- [Tool Search 索引文本如何由名称、描述和 Schema 组成](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/tools/src/tool_search.rs#L23-L150)
- [MCP Tool 的 Direct / Deferred 注册策略](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/mcp_tool_exposure.rs#L17-L89)
- [BM25 crate 版本：2.3.2](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/Cargo.toml#L294)

> 源码核对日期：2026-08-08。本文描述的是上述稳定版公开实现；Tool Exposure 与模型目录会继续演进，排查具体环境时应以实际请求和对应 commit 为准。
