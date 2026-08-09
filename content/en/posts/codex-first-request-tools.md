---
title: "Which Tools Does Codex Expose on the First LLM Request—and Why Does tool_search Use BM25?"
description: "A source-level tour of Codex rust-v0.147.0: GPT-5.6's first-request tool surface, tools nested under exec, deferred loading, and the engineering case for BM25 in tool_search."
date: 2026-08-08
lastmod: 2026-08-09
tags: ["Codex", "OpenAI", "Tool Calling", "Tool Search", "BM25", "MCP", "Code Mode", "AI Agent"]
categories: ["AI Agent Engineering"]
series: ["Agent Architecture Deep Dives"]
series_order: 3
seriesOpened: true
showToc: true
ShowReadingTime: true
---

{{< lead >}}
Think of Codex's first request as airport check-in. The model is not handed every key in the airport. It receives a few direct “boarding passes”; many concrete tools sit behind the `exec` gate, while deferred MCP tools remain in a warehouse that `tool_search` can search on demand. The result is a smaller context without giving up extensibility.
{{< /lead >}}

This article is pinned to the latest stable release as of publication: [`rust-v0.147.0`](https://github.com/openai/codex/releases/tag/rust-v0.147.0), released on August 7, 2026, at commit [`be6e8eac`](https://github.com/openai/codex/commit/be6e8eac029b183056b7e4402879f15d2c85f61b). I also rechecked `main` on August 8. The short answer is that **there is no timeless tool list independent of the model, provider, environment, and feature gates**. For the current GPT-5.6 Sol/Terra Code Mode path, the following layered view is the useful one.

{{< figure
  src="/images/posts/codex-first-request-tools/first-request-airport-en.png"
  alt="Airport metaphor for Codex first-request top-level tools, tools inside exec, tool_search, and the deferred tool library"
  caption="Airport metaphor: top-level tools are boarding passes, exec is the gate to everyday workstations, and tool_search is the searchlight aimed at the deferred tool library."
>}}

## “Exposed” Actually Means Two Different Things

The GPT-5.6 Sol model catalog sets `tool_mode` to `code_mode_only`, `multi_agent_version` to `v2`, and enables `use_responses_lite`. Responses Lite does not use the conventional top-level `tools` request field. Instead, it inserts a developer-role `additional_tools` item at the start of the input. Seeing no `tools` field in a trace therefore does not mean the model has no tools.

There are two kinds of first-turn visibility in this path:

1. **Top-level protocol entrypoints** appear as independent tools or namespaces in `additional_tools`.
2. **Tools nested under `exec`** have their names, descriptions, and parameter definitions embedded in the JavaScript execution guide. The model can read them on the first turn, but invokes them as `tools.xxx(...)` inside a cell.

The airport analogy is precise: there may be only a few boarding passes, but the `EXEC` pass already lists the counters available beyond that gate.

## The First-Turn Top-Level Entrypoints for GPT-5.6 Sol/Terra

With the normal App/CLI defaults, an available execution environment, and no enterprise policy disabling them, the core top-level surface is:

| First-turn entrypoint | Capability | Why it stays top-level |
| --- | --- | --- |
| `exec` | Runs JavaScript that can orchestrate multiple nested tools in one cell and return a compact result | The main Code Mode gateway; it reduces model–tool round trips |
| `wait` | Waits on a long-running `exec` cell that previously yielded | Long work can continue without one blocking tool call |
| `request_user_input` | Asks the user a short question in collaboration modes where it is allowed | Human control flow should not be buried in generated orchestration code |
| `collaboration` | A namespace containing `spawn_agent`, `send_message`, `followup_task`, `wait_agent`, `interrupt_agent`, and `list_agents` | GPT-5.6 Sol/Terra select Multi-Agent V2, whose defaults keep this control surface directly callable outside Code Mode |

`collaboration` is one namespace object but six callable functions. Luna still selects Multi-Agent V1, so its first-turn shape differs. Collaboration can also disappear when an agent depth limit is reached.

## What Lives Inside `exec`?

`exec` is not merely another name for a shell. It is closer to a transit pass for the workstations behind the gate. In source, `add_core_tool_sources()` collects shell tools, MCP resource tools, utilities, and collaboration tools, then the planner adds extension, dynamic, and hosted tools.

| Category | Common tools | Gate |
| --- | --- | --- |
| Command execution | `shell_command` is common on Windows; Unified Exec uses `exec_command` + `write_stdin` | Requires an execution environment; exact shape depends on model and feature selection |
| File changes and inspection | `apply_patch`, `view_image` | The model and environment must support the corresponding tool |
| Work orchestration | `update_plan` | Enabled by default, but configurable |
| MCP resources | `list_mcp_resources`, `list_mcp_resource_templates`, `read_mcp_resource` | At least one MCP server must be connected |
| App extensions | `web.run`, `image_gen.imagegen` | Provider, authentication, modalities, network mode, and feature gates must all pass |
| Plugin installation | `request_plugin_install`, sometimes a candidate-list tool | Apps, Plugins, and ToolSuggest must be enabled and candidates must exist |
| Other extensions | Goal, automation, and App Server dynamic tools | The relevant extension or client registration must exist |

A Handler existing in the repository does not mean it appears on every first request. The actual pipeline is: **register runtime → compute Direct / Deferred / Hidden exposure → apply Code Mode → merge namespaces → serialize the request**. Missing environments, disabled features, provider limitations, plan gates, and name collisions can remove a tool along the way.

## Is `tool_search` on the First Request?

By design, `tool_search` is registered only when both conditions hold:

- The model advertises `supports_search_tool` and the provider supports namespace tools.
- The registry contains at least one Deferred Tool with `search_info`.

In `rust-v0.147.0`, MCP tools are registered into the runtime but receive Deferred exposure whenever search is available. Their full schemas do not have to occupy the first-turn context. A `tool_search` call returns matching `LoadableToolSpec` entries for the next model call, with a default limit of eight.

There is, however, an important detail in the latest stable source: **the GPT-5.6 `code_mode_only` path does not currently convert `ToolSpec::ToolSearch` into an `exec`-nested definition**. `register_code_mode_executors()` explicitly continues past `ToolSearch`, while Code Mode Only hides ordinary direct tools other than `exec` and `wait`. The practical result is:

- In Direct mode, `tool_search` can be a first-turn top-level tool whenever deferred tools exist.
- In the stable GPT-5.6 Code Mode Only path, the BM25 handler may be registered yet still fail to appear in the callable first-turn surface.
- Public issue [#32101](https://github.com/openai/codex/issues/32101) documents this bridge gap. The skip branch was still present on `main` when checked on August 8, 2026.

That distinction matters: **present in the registry is not the same as visible in the request, and intended to be discoverable is not the same as wired through every Tool Mode today.**

## BM25 Does Not Abandon Keywords; It Ranks Them

“Why BM25 instead of keyword matching?” contains a small misconception. **BM25 is still lexical keyword retrieval.** It is not an embedding model, and it does not inherently know that “book a meeting” and “create a calendar event” are synonyms. The difference is that a crude matcher usually answers only hit or miss; BM25 also answers which hit deserves first place.

{{< figure
  src="/images/posts/codex-first-request-tools/bm25-library-en.png"
  alt="Library-card metaphor comparing boolean keyword matching with BM25 Top-K ranking over tool metadata"
  caption="A keyword filter dumps every matching card into a pile. BM25 behaves like an experienced librarian, ranking cards by term rarity, frequency saturation, and description length."
>}}

A simplified view of the score is:

```text
score(D, Q) = Σ IDF(t) × TF_saturation(t, D) × length_normalization(D)
```

In library terms:

- **Rare terms weigh more (IDF).** Almost every card may contain `get`, so it has little discriminating power. If only a few contain `calendar`, that term is much more useful.
- **Repetition saturates.** Writing `calendar` three times can strengthen the signal, but it does not mechanically make the card three times better. Keyword stuffing cannot dominate indefinitely.
- **Length is normalized.** A long description has more chances to contain query words. BM25 corrects for that so “wrote the most” does not automatically mean “most relevant.”
- **The output is already Top-K.** `tool_search` wants eight ordered candidates by default, not a bag of unordered boolean hits.

The source does not index only tool names. For ordinary tools, search text combines namespace name and description, the tool name, a space-separated version of underscore names, tool descriptions, parameter names, and parameter descriptions. MCP tools add canonical and callable names, server, title, connector, plugin display names, and input-schema property names. Each “catalog card” therefore contains several terms the user or model may plausibly use.

## How the Code Runs: From Deferred Tool to Loadable Schema

The formula explains how documents are scored, but an implementation must still answer three questions: where the documents come from, how a BM25 document ID leads back to a tool, and how a search hit becomes a callable schema on the next turn. In the stable release, that path runs through `spec_plan.rs`, the `ToolSearchHandler`, and the search-text builders in `codex-tools`.

The first important clarification is that **Codex does not reimplement the BM25 equation itself**. `codex-rs/Cargo.toml` depends on [`bm25 = "2.3.2"`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/Cargo.toml#L294). That in-memory library handles tokenization, document frequency, average document length, and scoring; Codex supplies the corpus and maps ranked results back into its tool types.

### Step 1: Collect only deferred tools

`append_tool_search_executor()` filters the registry for Deferred Tools and asks each runtime for its `search_info`. This is condensed code with the real types and method names preserved:

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

Each entry binds the text used for retrieval to the definition that should be returned on a hit:

```rust
pub struct ToolSearchEntry {
    pub search_text: String,
    pub output: LoadableToolSpec,
}
```

`search_text` contains the names, descriptions, parameters, namespace metadata, and other fields described above. `output` is the Function or Namespace schema that can be loaded into the next model request. Think of a library card whose front contains searchable terms while its back carries the retrieval slip for the actual book.

### Step 2: Use the array index as the retrieval number

[`ToolSearchHandler::new()`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/handlers/tool_search.rs#L76-L110) enumerates the cards and uses each entry's position in `search_infos` as its BM25 document ID:

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

That `usize` is the bridge back. The BM25 engine only needs to return ranked IDs such as `7, 2, 11`; Codex can then look up `search_infos[7]`, `search_infos[2]`, and `search_infos[11]`. There is no database key or second mapping table—the array position is the retrieval number. The full corpus is indexed in memory with `Language::English`.

### Step 3: Search Top-K and map IDs back to schemas

On invocation, the handler trims the query and rejects both an empty query and `limit = 0`. If the caller omits the limit, `TOOL_SEARCH_DEFAULT_LIMIT` supplies eight. The central retrieval code is short:

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

Two details are easy to miss:

1. Codex does not forward the numeric BM25 score to the model; it uses the order already produced by the retrieval library.
2. `coalesce_loadable_tool_specs()` merges multiple hits from the same Namespace, avoiding several duplicate Namespace wrappers.

The whole pipeline is therefore:

```text
Deferred Runtime
  → ToolSearchInfo(search_text + LoadableToolSpec)
  → BM25 Document<usize>
  → ranked Top-K document IDs
  → recover LoadableToolSpec
  → coalesce Namespaces
  → include in the next model request
```

There is one final performance detail. [`ToolSearchHandlerCache`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/handlers/tool_search.rs#L34-L74) compares the new `search_infos` and source-listing mode with the cached handler. If the tool world is unchanged, Codex reuses the existing `Arc<ToolSearchHandler>` and in-memory index; it rebuilds only when MCP, plugin, or dynamic-tool metadata changes. In library terms, yesterday's card catalog remains useful until new books arrive.

To follow the exact source path, read [`append_tool_search_executor()`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/spec_plan.rs#L1165-L1185), [`ToolSearchHandler`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/handlers/tool_search.rs#L76-L197), and the [`ToolSearchEntry` / `search_text` builders](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/tools/src/tool_search.rs#L12-L150) in that order.

## Why BM25 Is a Sensible Engineering Choice Here

The source establishes what Codex uses; it does not contain a design memo claiming the following exact rationale. As an engineering inference from the corpus and execution path, BM25 fits tool discovery well:

1. **Tool metadata is short, structured, and terminology-heavy.** API names and parameters such as `calendar`, `pull_request`, `spawn_agent`, and `issue_number` are strong lexical signals.
2. **The index is rebuilt locally.** The handler constructs a Rust `bm25` engine with `Language::English`; there is no embedding request and no vector database to operate.
3. **First-turn latency and availability matter.** The tool set changes with MCP servers, plugins, dynamic tools, and policy. BM25 is quick to rebuild, cheap to query, deterministic, and explainable for this small dynamic corpus.
4. **The job is schema reduction, not open-world question answering.** Retrieval narrows dozens or hundreds of cards to Top-K; a capable model still makes the final tool choice.
5. **Exact technical distinctions are safety-relevant.** `delete_issue` and `get_issue` are semantically related but operationally very different. Lexical evidence from names and parameters matters.

A substring filter lacks robust ranking. Embeddings improve paraphrase and cross-language recall, but introduce another model or service dependency, index-update work, and semantic false positives. For short schemas, BM25 is a pragmatic middle ground.

## The Boundaries Are Just as Clear

The current engine uses `Language::English` and does not add vector recall, a synonym layer, an explicit exact-name boost, or a reranker. These queries are therefore outside its sweet spot:

- A Chinese query meaning “schedule a meeting” when the tool only says `create_calendar_event`.
- “Review code” when the tool only uses `pull_request_review`.
- Two tools whose descriptions share boilerplate while the important business distinction is implied rather than named.

That is why tool `name`, `description`, and parameter documentation are operational metadata, not cosmetic copy. BM25 is the librarian, but it can read only what is printed on the cards. If tool scale, multilingual use, or paraphrase diversity grows substantially, a sensible upgrade is **BM25 recall + exact-name boost + lightweight reranking**, not necessarily an immediate jump to pure vector retrieval.

## Three Takeaways

First, the initial request does not “send every tool to the model.” Exposure, Tool Mode, provider capabilities, environment state, and feature gates jointly compute the interface.

Second, Code Mode places many schemas behind `exec`. That saves more than schema tokens: filtering, loops, and parallel orchestration can stay inside one JavaScript cell instead of forcing repeated model–tool round trips.

Third, `tool_search` is valuable not because it magically understands intent, but because a cheap, deterministic, explainable retrieval layer can compress a growing tool warehouse into a handful of cards worth inspecting. BM25 is keyword retrieval—just much smarter than “contains this string.”

## Source Index

- [GPT-5.6 Sol capabilities and Tool Mode](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/models-manager/models.json#L4-L22)
- [Tool registry, exposure, and model-visible spec planning](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/spec_plan.rs#L319-L486)
- [Conditional registration of core tools](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/spec_plan.rs#L818-L1118)
- [Responses Lite `additional_tools` request framing](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/client.rs#L849-L885)
- [`tool_search` BM25 engine and Top-K output](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/handlers/tool_search.rs#L76-L169)
- [How names, descriptions, and schemas become tool-search text](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/tools/src/tool_search.rs#L23-L150)
- [Direct / Deferred registration of MCP tools](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/mcp_tool_exposure.rs#L17-L89)
- [BM25 crate version: 2.3.2](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/Cargo.toml#L294)

> Source checked on August 8, 2026. This article describes the pinned stable implementation above. Tool exposure and model catalogs continue to evolve; debug a specific environment against its actual request and exact commit.
