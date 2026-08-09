---
title: "Codex 首轮 Tool 怎么分层？从 exec、tool_search 缺口到 BM25 实现"
description: "基于 Codex rust-v0.147.0 源码，面向不熟 Rust 的 Agent 工程师，拆解 GPT-5.6 首轮工具、请求上下文、Tool Search 生命周期、Code Mode Only 与 BM25/Memory 检索。"
date: 2026-08-08
lastmod: 2026-08-09
audience_profile: "agent-engineer-source-transition"
tags: ["Codex", "OpenAI", "Tool Calling", "Tool Search", "BM25", "MCP", "Code Mode", "AI Agent"]
categories: ["AI Agent 工程"]
series: ["Agent 架构深度"]
series_order: 3
seriesOpened: true
showToc: true
ShowReadingTime: true
---

{{< lead >}}
把 Codex 首轮请求想成机场值机：模型不会拿到每个柜台的一张票，而只拿到少数顶层入口；大量具体工具收进 `exec` 这道登机口，其他工具可以延迟发现。你不需要会 Rust，本文会先解释系统角色，再用伪代码和真实源码回答：Tool 放在请求哪里、什么时候搜索、结果能用几轮，以及 BM25 能不能检索 Memory。
{{< /lead >}}

本文固定在 2026-08-07 发布的稳定版 [`rust-v0.147.0`](https://github.com/openai/codex/releases/tag/rust-v0.147.0)，源码 commit 为 [`be6e8eac`](https://github.com/openai/codex/commit/be6e8eac029b183056b7e4402879f15d2c85f61b)；另复查了 2026-08-09 的 `main` commit [`646f7c0a`](https://github.com/openai/codex/commit/646f7c0a91b8e327d263335da68ae8ef212895ce)。先给两个不会误导人的结论：

1. **首轮 Tool 没有脱离模型、Provider、环境和 Feature 的永久名单。**
2. **`tool_search` 功能和 BM25 Handler 已实现，Direct 模式可用；但在这个稳定版的 GPT-5.6 Code Mode Only 路径中，它没有进入模型首轮可见工具表。** 这不是“功能尚未开发”，而是特定工具暴露路径的缺口。

## 这篇文章写给谁

默认读者已经知道 LLM 可以调用 Tool，并见过普通 Function Calling 的 `tools`/JSON Schema；但**不要求会 Rust，也不要求读过 Codex 源码**。如果你主要写 Python 或 TypeScript，可以把后面的 Rust iterator 链暂时理解为“过滤列表 → 转换元素 → 收集结果”。

有两条阅读路线：

- **只想理解架构**：读术语地图、机场图、Tool Search 运行时序、BM25 类比和最后总结；
- **想跟进源码**：继续读伪代码、Rust 对照、完整查询实例和源码索引。

## 先看术语地图

| 术语 | 所属层 | 本文中的意思 |
| --- | --- | --- |
| Tool / Schema | 请求协议 | Tool 是模型可调用的能力；Schema 是它的名称、说明和参数契约 |
| Namespace | 请求协议 | 把一组相关 Tool 包在一个命名空间入口下，例如 `collaboration` |
| Registry | Codex 运行时 | 当前会话已经注册的工具目录；存在于这里不代表模型一定可见 |
| Runtime / Handler | Codex 实现 | Runtime 描述 Tool；Handler 在调用发生时真正执行它 |
| Exposure | 工具规划 | 决定 Tool 是 Direct、Deferred 还是 Hidden |
| Provider | 模型接入层 | 负责把 Codex 的 Tool Spec 转成具体模型请求格式 |
| MCP | 外部工具协议 | Model Context Protocol；Codex 可通过 MCP Server 接入外部 Tool 和资源 |
| `LoadableToolSpec` | 搜索输出 | `tool_search` 命中后返回、可装进后续模型请求的工具定义 |

## Code Mode Only 是什么，需要手动开启吗

这里的 Mode 不是“用户只能写代码”的聊天模式，而是**模型怎样看到和调用 Tool**：

| Tool Mode | 模型看到的工具布局 |
| --- | --- |
| Direct | 多数 Tool 作为独立顶层入口，模型直接调用 |
| Code Mode | 部分 Tool 可直调，部分 Tool 通过 `exec` 里的 `tools.xxx()` 编排 |
| Code Mode Only | 大多数普通 Tool 不再各占一个顶层入口，模型主要通过 `exec` 调用；`wait`、用户控制面等少量入口仍可直调 |

在本文稳定版里，GPT-5.6 Sol 的模型目录已经写入 `"tool_mode": "code_mode_only"`。**选择这个模型后由 Codex 自动采用，不需要在 UI 里再开一个按钮。** 对没有模型内置 Tool Mode 的情况，源码还保留实验 Feature：

```toml
[features]
code_mode_only = true
```

CLI 也可临时传 `codex --enable code_mode_only`。这个 Feature 会自动连带启用 Code Mode，但公开配置把它标成 under development；若模型没有声明支持，Codex 会警告可能降低模型表现。因此它更适合源码验证，不建议对任意模型强行开启。它也不同于 `--code-mode-host`：后者只是在选择 Code Mode 的远程执行 Host。

现在再看分层图。它同时画出“设计中的延迟发现”与“稳定版 Code Mode Only 的首轮实际状态”；虚线和路障表示 `tool_search` 已实现，但在这个特定首轮工具布局中没有暴露给模型。

{{< figure
  src="/images/posts/codex-first-request-tools/first-request-airport-v2-zh.png"
  alt="用机场值机比喻说明 Codex 首轮顶层工具、exec 内嵌工具，以及稳定版 Code Mode Only 中 tool_search 已实现但首轮未暴露"
  caption="这是一张版本化的概念图，不是永久工具清单：实线表示当前可见入口；tool_search 一侧的虚线表示按需发现设计，路障表示 rust-v0.147.0 的 GPT-5.6 Code Mode Only 首轮没有暴露该入口。"
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
- 在 GPT-5.6 Code Mode Only 的稳定版路径，BM25 Handler 即使已经注册，`tool_search` 也**不会进入**模型首轮可调用表；没有暴露 Tool Spec，Agent 就没有一个可发起调用的入口；
- 这正是公开 issue [#32101](https://github.com/openai/codex/issues/32101) 描述的桥接缺口。截至 2026-08-09，`main` 的 commit [`646f7c0`](https://github.com/openai/codex/commit/646f7c0a91b8e327d263335da68ae8ef212895ce) 仍保留该跳过分支。

这一区分很重要：**Registry 里“存在”，不等于首轮请求里“可见”；设计上“应该被搜索”，也不等于当前每种 Tool Mode 都已经接通。**

## Tool Search 在一轮 Agent 循环里怎样发生

先暂时放下上面的 Code Mode Only 桥接缺口，观察一个**已经把 `tool_search` 暴露给模型**的 Direct/Deferred 路径。它不是每轮固定执行的检索器，而是模型工具箱里的一个可选动作。

### 不是每轮自动重搜，而是模型按需决定

Codex 客户端没有一段“如果显式 Tool 都不合适，就自动执行 BM25”的兜底循环。请求采用自动工具选择；只有模型输出结构化的 `tool_search_call`，Router 才把它交给 Handler。模型可以先用已有 Tool，也可以根据任务直接搜索，并不需要先把显式 Tool 逐个试错。

可以把它想成开发者走进五金店：手边货架已经有锤子和螺丝刀，店员同时知道后仓可以查货。拧螺丝时不必每走一步都查一次后仓；遇到“测光纤”这类货架外需求时，才去目录里搜索。搜索加载的 Tool 在仍留于当前会话上下文时，后续轮次可以继续调用，**不必每轮重复搜索同一件工具**。出现新需求、工具目录变化、开启新任务，或旧搜索输出不再处于有效上下文时，才可能需要再次搜索。

官方 API 的 Deferred Loading 仍会在首轮给模型最小发现信息：Namespace/MCP 主要暴露高层名称和说明，单个 Deferred Function 保留名称和说明而延迟大部分参数。Codex 这条客户端 BM25 路径则让模型先看到 `tool_search` 入口及可搜索来源说明，完整 `LoadableToolSpec` 要等命中后才返回。两者共同点都是：**先给目录，不先搬来整个仓库。**

### 显式 Tool 放在系统提示词还是用户提示词里

严格答案是：通常**两者都不是**。Tool 定义是请求协议中的结构化字段，不是拼进自然语言 Prompt 的一段文字。这个稳定版有两种封装：

| 请求路径 | Tool 定义放在哪里 | 基础指令放在哪里 | 属于用户消息吗 |
| --- | --- | --- | --- |
| 普通 Responses | 顶层 `tools` 数组 | 顶层 `instructions` | 否 |
| GPT-5.6 Codex Responses Lite | 输入开头的 `additional_tools` item，角色为 `developer` | 紧随其后的 `developer` Message | 否 |

所以抓包时不要只搜索 system/user 文本。Responses Lite 的线格式更接近：

```text
[developer: additional_tools]
[developer: base instructions]
[此前 conversation items]
[user: 当前问题]
```

这里的 `developer` 是权限和顺序语义，不表示工具 Schema 被改写成一篇开发者提示词。Code Mode Only 又多一层：许多嵌套工具的契约被放进 `exec` 的结构化定义和 JavaScript 使用指南里，模型通过这个总入口调用它们。

### 搜索结果怎样进入上下文，又能用多久

一次客户端执行的完整时序如下：

```text
模型：tool_search_call(query="calendar")
Codex：BM25 Top-K → LoadableToolSpec
上下文尾部：tool_search_output { call_id, status, tools: [...] }
模型：function_call(name="create_event", ...)
后续轮次：仍可调用已加载的 create_event
```

`tool_search_output` 是一种专门的 Responses input item，不是 system 文本、user 文本，也不是回头修改首轮的 `additional_tools`。Codex 把 Call/Output 成对写入 conversation history；下一次请求携带这些历史项时，模型便能把 `tools` 中的完整 Schema 当成已加载候选。官方设计把新加载工具放在上下文尾部，这还能保持前缀稳定，增加 Prompt Cache 命中的机会。

“以后都能用”要加一个边界：它指同一活跃会话里，该输出仍在传给模型的上下文中。它不是进程级永久安装；新会话、上下文压缩策略或工具目录更新，都可能重新触发发现。可以把它想成把后仓取来的说明书夹进本次工单，而不是把机器永久焊在工作台上。

### 为什么稳定版只给 GPT-5.6 选择 Code Mode Only

源码能证明的是配置事实：稳定版模型目录中的 GPT-5.6 Sol、Terra、Luna 都声明 `tool_mode: "code_mode_only"` 和 Responses Lite；紧邻的 GPT-5.5 条目没有。源码把它当作**模型能力元数据和协议兼容契约**，没有一段注释或设计文档说“因为 5.6 更聪明，所以开启”。而且 API 级 `tool_search` 并非 5.6 独占，官方文档列出的支持范围是 GPT-5.4 及更新模型。

下面是明确标注的工程推断，而不是源码原话：Code Mode Only 要求模型在 `exec` 中写正确 JavaScript、遵守 Tool Schema、处理异步与错误、并在一个 cell 内筛选和压缩结果。更强的代码生成、推理和工具调用训练显然是前提；但是否启用还取决于专门后训练、评测门槛、Provider 协议和灰度发布。**“强模型使它可行”是合理解释，“只因为参数更强”则是未经证实的简化。**

## BM25 不是“不要关键词”，而是“给关键词排座次”

常有人问：为什么不用关键词匹配，反而用 BM25？这句话本身有一点误会。**BM25 仍然是词法关键词检索**，它不是 Embedding，也不理解“订会议”和“安排日程”一定是同义词。它与朴素关键词匹配的区别，是后者通常只回答“命中 / 没命中”，BM25 还会回答“谁更应该排第一”。

{{< figure
  src="/images/posts/codex-first-request-tools/bm25-library-v2-zh.png"
  alt="用图书馆理卡比喻比较关键词命中和 BM25 对 Tool metadata 的 Top-K 排序"
  caption="关键词筛选像把所有命中的卡片倒成一堆；BM25 像熟练馆员，按稀有度、重复饱和与描述长度排序。图中的 Top-5 只是为了可读性，Codex 默认 limit 是 8；图也明确提醒 BM25 是英文词法检索，不负责跨语言语义理解。"
>}}

先用一条概念式记住三个力：

```text
score(D, Q) = Σ IDF(t) × TF_saturation(t, D) × length_normalization(D)
```

这不是代码里的完整公式。`bm25` 2.3.2 实际采用的标准形式是：

```text
score(D, Q) = Σ IDF(qᵢ) ×
              f(qᵢ,D) × (k₁ + 1)
              ─────────────────────────────────────────
              f(qᵢ,D) + k₁ × (1 - b + b × |D| / avgdl)
```

其中 `f(qᵢ,D)` 是查询词在这张工具卡里出现的次数，`|D|` 是卡片长度，`avgdl` 是全部卡片的平均长度。Codex 直接调用 `with_documents(...).build()`，没有覆盖参数，因此使用 crate 默认值 `k₁ = 1.2`、`b = 0.75`；建索引时会由整批文档拟合 `avgdl`。换句话说，Codex 负责“把哪些工具卡交给馆员”，crate 负责“分词、统计和按公式排队”。

仍用图书馆来理解：

- **稀有词更值钱（IDF）**：几乎每张工具卡都写着 `get`，它像“本馆藏书”一样没什么区分度；只有少数卡片写着 `calendar`，这个词更能定位目标；
- **重复会饱和**：描述里写三次 `calendar` 可以增强信号，但不会比写一次机械地强三倍，避免关键词堆砌霸榜；
- **长描述要归一**：一本厚说明书天然更容易碰到查询词，BM25 会校正长度，避免“写得最多”自动等于“最相关”；
- **直接产出 Top-K**：`tool_search` 需要的是默认 8 个有序候选，不是一大包无序布尔命中。

源码不是只搜索 Tool 名字。普通 Tool 的索引文本会同时放入原名和把下划线换成空格后的名称，例如 `create_event` 与 `create event`，再拼接 Namespace、描述、参数名和参数描述；MCP Tool 还会加入 canonical/callable name、Server、标题、Connector、Plugin 显示名以及输入 Schema 的属性名。这一步很关键：默认分词器按 Unicode 单词边界切分、转小写、去英文停用词并做英文词干化，而空格版名称保证 `create`、`event` 能成为独立的词法信号。

## Codex 怎样调用 BM25：从 Deferred Tool 到可加载 Schema

公式回答了“怎样打分”，但真正的实现还要回答三个问题：文档从哪里来、BM25 返回的编号怎样找回 Tool、为什么搜索结果能在下一轮变成可调用 Schema。稳定版的答案集中在 `spec_plan.rs`、`tool_search.rs` 和 `codex-tools` 的检索文本构造代码里。

先说最容易误解的一点：**Codex 没有自己手写一遍 BM25 公式。** `codex-rs/Cargo.toml` 依赖 [`bm25 = "2.3.2"`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/Cargo.toml#L294)，分词、文档频率、平均文档长度和评分由这个内存检索库完成；Codex 写的是围绕它的数据准备与结果映射。

不懂 Rust 也可以先把实现读成四行伪代码：

```text
cards = deferred_tools.map(search_text + loadable_schema)
engine = BM25.build(cards.search_text)
ids = engine.search(query, limit = 8)
return merge(cards[id].loadable_schema)
```

下面的 Rust 代码只是这四步的强类型版本；可以把 `.filter()`、`.map()`、`.collect()` 分别当成列表的筛选、转换和收集。

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

{{< figure
  src="/images/posts/codex-first-request-tools/tool-search-data-flow-v1-zh.png"
  alt="Codex tool_search 从 Deferred Tool、ToolSearchInfo、Document usize、bm25 crate 到 tool_search_output 的完整数据流"
  caption="这张源码路线图把边界画开：步骤 1–3 和 5–6 是 Codex 胶水代码，步骤 4 才是外部 bm25 2.3.2 crate。底部的 ID [7, 2, 11] 是明确标注的示意值，不是实测排名或分数。"
>}}

### 一个查询怎样走完全程

把查询设为 `calendar`。索引中的某张卡片可能包含下面这样的文字（为便于阅读做了缩短）：

```text
create_event create event Create a calendar event title start_time end_time
```

默认英文分词器把查询和卡片统一做 Unicode 归一、小写化、停用词过滤和词干化。BM25 若把这张卡排进 Top-K，Handler 就通过文档 ID 找回与它绑定的 `LoadableToolSpec`。这里不要把“文字相似”理解成直接调用：**搜索命中的是卡片编号，编号取回的才是完整 Schema。**

随后 [`ToolSearchOutput::to_response_item()`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/context.rs#L149-L185) 把结果变成一种专门的 Responses 输入项。源码单元测试验证的线格式如下；为了聚焦数据流，下面只保留一个空参数对象：

```json
{
  "type": "tool_search_output",
  "call_id": "search-1",
  "status": "completed",
  "execution": "client",
  "tools": [{
    "type": "function",
    "name": "create_event",
    "description": "",
    "strict": false,
    "defer_loading": true,
    "parameters": {"type": "object", "properties": {}}
  }]
}
```

它不是普通的文本结果，也不是 Codex 临时去改首轮的 `additional_tools` 数组；它作为 `tool_search_output` 进入会话历史，并随下一次 Responses 请求送回 Provider。这样，Provider 和模型能把 `tools` 中的定义当作本次搜索加载出的候选工具。上面的单元测试验证的是“结果怎样封装”，并不假装执行了一次真实 BM25 排名；排名部分由前面的 `SearchEngine::search()` 负责。

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

## BM25 适不适合 Memory 检索

**适合，但更适合做词法召回的一条腿，而不是完整的长期记忆系统。** 还要先澄清一个源码事实：这个稳定版 Codex 的 Memory 搜索并没有复用上面的 BM25。`ext/memories` 暴露的是子串查询，可选择忽略空格或分隔符，并按路径和行号整理匹配结果；它没有计算 BM25 相关度，也没有按语义相似度排序。

为什么 BM25 仍值得用在 Memory？错误码、函数名、文件路径、项目代号、人名和已经写入的决策措辞，都是非常强的词法锚点。用户问“上次 `EADDRINUSE` 怎么处理”，BM25 往往比纯向量更稳定，也比子串匹配更会给结果排序。

但 Memory 比 Tool 卡片更难：同一件事会被换一种说法，旧结论可能被新结论推翻，还要考虑“谁的记忆、哪个项目、多久以前、可信度多高”。BM25 不理解这些关系：

| Memory 需求 | BM25 单独处理的效果 |
| --- | --- |
| 精确名称、路径、错误码、API | 强 |
| 同义改写、跨语言表达 | 弱 |
| 用户 / 项目 / 时间范围 | 需要 metadata filter |
| 新旧结论冲突、可信度和重要性 | 需要额外排序与治理 |

一个更可靠的生产方案是：

```text
用户 / 项目 / 时间等 metadata filter
  → BM25 词法召回  ||  Embedding 语义召回
  → 融合两路候选（例如 RRF）
  → 按新鲜度、重要性、可信度、使用次数加权
  → 轻量 rerank
  → 返回原文片段与出处
```

对于很小、以技术日志为主的本地 Memory，先从 BM25 开始完全合理；它会比当前子串列表多出一层有效排序。随着自然语言转述、跨语言和矛盾记忆增加，再升级为混合检索。这里的结论是通用架构建议，**不是在声称 Codex 当前已经这样实现。**

## 最值得带走的五点

第一，第一次请求不是“把所有 Tool 全塞给模型”，而是一个由 Exposure、Tool Mode、Provider 与 Feature 共同计算出的接口面。

第二，显式 Tool 通常是请求协议里的结构化字段；Responses Lite 使用 developer 角色的 `additional_tools`，但它仍不是 system/user 自然语言。

第三，`tool_search` 是模型按需选择的 Tool，不是每轮自动 fallback；搜索结果以结构化历史项进入上下文，同一会话可以继续调用已加载 Tool。

第四，Code Mode Only 需要更强的代码与工具编排能力，但稳定版为什么只为 GPT-5.6 选择它，源码只给出了模型兼容元数据，没有证明“强”是唯一原因。

第五，BM25 是有排序能力的关键词检索。它很适合 Tool Schema，也适合 Memory 的精确词法召回；完整 Memory 更适合 metadata、BM25、向量召回和重排共同工作。

## 源码索引

- [GPT-5.6 Sol 模型能力与 Tool Mode](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/models-manager/models.json#L4-L22)
- [GPT-5.6 Terra 的 Code Mode Only 配置](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/models-manager/models.json#L119-L137)
- [GPT-5.6 Luna 的 Code Mode Only 配置](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/models-manager/models.json#L232-L250)
- [GPT-5.5 相邻模型条目没有选择 Code Mode Only](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/models-manager/models.json#L341-L359)
- [OpenAI Tool Search 官方指南：Deferred Loading、调用时序与未来轮次复用](https://developers.openai.com/api/docs/guides/tools-tool-search)
- [OpenAI Programmatic Tool Calling 官方指南](https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling)
- [Tool Registry、Exposure 与首轮可见 Spec 规划](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/spec_plan.rs#L319-L486)
- [核心 Tool 的条件化注册](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/spec_plan.rs#L818-L1118)
- [Responses Lite 的 `additional_tools` 请求封装](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/client.rs#L849-L885)
- [`tool_search` 的 BM25 Engine 与 Top-K 返回](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/handlers/tool_search.rs#L76-L169)
- [Tool Search 索引文本如何由名称、描述和 Schema 组成](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/tools/src/tool_search.rs#L23-L150)
- [`tool_search` 结果如何变成下一次请求的专用输入项](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/context.rs#L149-L185)
- [`tool_search_call` / `tool_search_output` 如何保留在会话历史](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/context_manager/history.rs#L350-L386)
- [MCP Tool 的 Direct / Deferred 注册策略](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/mcp_tool_exposure.rs#L17-L89)
- [BM25 crate 版本：2.3.2](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/Cargo.toml#L294)
- [`bm25` 2.3.2 的公式与默认参数](https://github.com/Michael-JB/bm25/blob/8ef726045b41702e148d8996d344f3500844fde1/src/embedder.rs#L146-L205)
- [`bm25` 2.3.2 默认分词器的切词、归一、停用词与词干化](https://github.com/Michael-JB/bm25/blob/8ef726045b41702e148d8996d344f3500844fde1/src/default_tokenizer.rs#L263-L289)
- [Codex Memory Tool 当前的子串查询语义](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/ext/memories/src/tools/search.rs#L28-L62)
- [Codex Memory 本地搜索与结果排序实现](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/ext/memories/src/local/search.rs#L17-L88)

> 源码核对日期：2026-08-09。稳定版固定到 `be6e8eac`，同时核对了当日 `main` 的 `646f7c0a`；BM25 crate 固定到 `v2.3.2` 的 `8ef72604`。Tool Exposure 与模型目录会继续演进，排查具体环境时应以实际请求和对应 commit 为准。

> 配图生成说明：中英文两版共六张技术图，均通过 Codex 内置 `image_gen.imagegen` 生成或编辑；在固定版本源码中，该扩展把 [`IMAGE_MODEL` 写死为 `gpt-image-2`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/ext/image-generation/src/tool.rs#L53-L58)，并用它构造 Images 请求。发布前人工复核了模式状态、Top-K 注记、示意 ID 和中英文标签。
