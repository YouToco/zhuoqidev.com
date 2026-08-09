---
title: "Why Codex Does Not Give the Model Every Tool: tool_search, BM25, and Model Replacement"
description: "A plain-language, source-grounded explanation of why Codex loads tools on demand, how BM25 ranks the best few, and how the same design transfers to Python, Go, and other models."
date: 2026-08-08
lastmod: 2026-08-09
audience_profile: "agent-engineer-source-transition"
tags: ["Codex", "OpenAI", "Tool Calling", "Tool Search", "BM25", "MCP", "Code Mode", "AI Agent"]
categories: ["AI Agent Engineering"]
series: ["Agent Architecture Deep Dives"]
series_order: 3
seriesOpened: true
showToc: true
ShowReadingTime: true
---

{{< lead >}}
Think of the model as an engineer with a small desk. If hundreds of tool manuals cover it, every request becomes expensive and the right manual is harder to find. Codex instead provides a short catalog and retrieves only the most relevant manuals. This article explains that design, BM25 ranking, reuse in Python or Go, and model replacement.
{{< /lead >}}

This article is pinned to stable [`rust-v0.147.0`](https://github.com/openai/codex/releases/tag/rust-v0.147.0), released on August 7, 2026, at commit [`be6e8eac`](https://github.com/openai/codex/commit/be6e8eac029b183056b7e4402879f15d2c85f61b). I also rechecked `main` at commit [`646f7c0a`](https://github.com/openai/codex/commit/646f7c0a91b8e327d263335da68ae8ef212895ce) on August 9. Two conclusions matter up front:

1. **The tools visible on the first request are not a permanent list.** They change with the model, connection, runtime environment, and feature settings.
2. **`tool_search` and its BM25 ranking code are implemented, and ordinary direct mode can use them. The stable GPT-5.6 `exec`-centered path simply misses the search entrance.** The feature exists; one wire is not connected.

## Who This Article Is For

The reader only needs to know that an LLM can call an outside tool. **Rust and prior Codex source reading are not prerequisites.** Read Rust iterator chains as “filter a list → transform each item → collect the result.”

Two reading routes are available:

- **Architecture route:** read the first principles, airport diagram, Tool Search runtime sequence, cross-language transfer, and model replacement.
- **Source route:** continue through pseudocode, Rust correspondence, the end-to-end query, and the source index.

## Start With Four Plain Statements

Erase the Rust function names, OpenAI protocol names, and GPT-5.6 model labels for a moment. A tool-using Agent still cannot escape four facts:

1. **A model can use only tools it can see.** Working execution code is useless to the model until its tool manual enters the request.
2. **The model's desk is finite, and every word costs time and money.** More manuals also create more chances to choose the wrong one.
3. **Search first reduces the choice.** Ranking a few relevant tools out of hundreds is easier than reading every manual at once.
4. **The Agent shell and model can be separated.** If both sides agree on requests, tool calls, and returned results, the language, search method, and model can change.

The minimum architecture in this article is therefore one chain:

```text
limited desk space
  → every tool manual cannot stay open
  → keep a few common tools and a catalog
  → retrieve the best few complete manuals
  → model calls a tool
  → the program executes it and returns the result
```

Once that chain is clear, it becomes easy to decide what must stay and what can be removed:

| What appears in the source | Must understand? | Why |
| --- | --- | --- |
| Whether a tool is visible now, visible after search, or never visible | Yes | It determines what the model can choose |
| `searchable words → ranked IDs → complete manual` | Yes | This design transfers to any Agent |
| How the model connection sends data and what it supports | Yes | It determines whether model replacement is safe |
| Rust iterators, concrete type names, and paths | Not initially | They are project implementation, not architectural law |
| The `bm25` crate and array-index trick | Replaceable | Python, Go, or a search service can implement the same interface |
| The current GPT-5.6 Tool list | Version snapshot only | Model, environment, and Feature changes recompute it |

## Only Four Things Need Names

| Plain name | Meaning | Source name when needed |
| --- | --- | --- |
| Tool manual | A tool's name, purpose, and required parameters | Schema / Tool Spec |
| Tool catalog | Every tool the program currently knows, not necessarily every tool shown to the model | Registry |
| Execution code | The program that does the work after the model names a tool | Runtime / Handler |
| Model connection | The adapter that sends Codex requests in a format the model service understands | Provider |

The source names appear later only for verification. They are not vocabulary the reader must memorize.

## Why Does Codex Put Many Tools Behind `exec`?

This Mode does not mean the user can only write code. It controls **how the model sees and calls Tools**:

| Tool Mode | Tool layout visible to the model |
| --- | --- |
| Direct | Most Tools are independent top-level entrypoints |
| Code Mode | Some Tools remain direct while others are orchestrated as `tools.xxx()` inside `exec` |
| Code Mode Only | Most ordinary Tools stop occupying separate top-level slots; the model primarily uses `exec`, while `wait` and a small control surface remain direct |

In the pinned release, the GPT-5.6 Sol model catalog already contains `"tool_mode": "code_mode_only"`. **Codex selects it automatically with that model; there is no additional UI switch to turn on.** For models without a built-in selector, the source also retains an experimental feature override:

```toml
[features]
code_mode_only = true
```

The CLI equivalent is `codex --enable code_mode_only`. This also enables Code Mode as a dependency, but public configuration marks the feature as under development. Codex warns that forcing it on a model that does not advertise support may degrade performance, so the override is better suited to source testing than arbitrary production use. It is also unrelated to `--code-mode-host`, which only selects a remote execution host for Code Mode.

The diagram can now be read without treating an internal selector as a familiar product switch. It shows both the deferred-discovery design and the stable Code Mode Only first-turn state. The dashed path and barrier mean that `tool_search` is implemented but not exposed to the model in this specific first-turn layout.

{{< figure
  src="/images/posts/codex-first-request-tools/first-request-airport-v2-en.png"
  alt="Airport metaphor for Codex top-level and exec-nested tools, with tool_search implemented but not first-turn exposed in stable Code Mode Only"
  caption="This is a versioned conceptual diagram, not a timeless tool list. Solid paths are visible entrypoints; the dashed tool_search path is the on-demand design, while the barrier marks its missing first-turn exposure in rust-v0.147.0 GPT-5.6 Code Mode Only."
>}}

## What Can the Model See at First? Separate the Public API from Codex's Internal Framing

First, correct the misleading shorthand: **when an application calls the [public OpenAI Responses API](https://developers.openai.com/api/docs/guides/tools) directly, tools still belong in the top-level `tools` field, including with GPT-5.6. Seeing `additional_tools` in Codex source is not a reason to rewrite a public API request.**

Two different questions were being mixed together:

1. **Which tools can the model use?** That depends on the tool definitions the service ultimately presents to the model.
2. **How do those definitions travel over the network?** That depends on the request contract agreed upon by the client and service.

The model does not inspect an HTTP packet and reason about JSON key spelling. The service first turns the request into a callable interface for the model. `tools` and `additional_tools` are therefore better understood as **two envelope formats** that can carry the same tool manual. The distinction affects client–server compatibility, not the model's underlying reasoning ability.

### Comparison One: Calling the Public Responses API Directly

This is a complete minimal request. It uses one `weather` namespace so every piece can be compared with the second request:

```bash
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.6",
    "instructions": "Call a tool for live weather; do not guess.",
    "input": [
      {
        "role": "user",
        "content": "What is the temperature in Paris now?"
      }
    ],
    "tools": [
      {
        "type": "namespace",
        "name": "weather",
        "description": "Look up live weather.",
        "tools": [
          {
            "type": "function",
            "name": "get_current_weather",
            "description": "Get the current temperature for a city.",
            "parameters": {
              "type": "object",
              "properties": {
                "city": { "type": "string" }
              },
              "required": ["city"],
              "additionalProperties": false
            },
            "strict": true
          }
        ]
      }
    ],
    "tool_choice": "auto"
  }'
```

There are three sibling inputs: `instructions` states how to behave, `input` carries the user's request, and `tools` declares what is callable. The tool is neither a prose list hidden in a system prompt nor part of the user message.

### Comparison Two: The Request Codex Sends After Selecting Responses Lite

The stable Codex model catalog selects `use_responses_lite` for GPT-5.6 Sol. Codex still builds a Responses-shaped body, but moves two things: top-level `tools` becomes the first `input` item, and top-level `instructions` becomes the second item. The following deliberately reuses the illustrative `weather` namespace so the fields can be compared one by one. Field positions and fixed values come from source; values in angle brackets are generated by Codex for each turn:

```http
POST <the Responses endpoint configured by the active Codex provider>
Authorization: Bearer <the active login or API credential>
Content-Type: application/json
x-openai-internal-codex-responses-lite: true

{
  "model": "gpt-5.6-sol",
  "input": [
    {
      "type": "additional_tools",
      "role": "developer",
      "tools": [
        {
          "type": "namespace",
          "name": "weather",
          "description": "Look up live weather.",
          "tools": [
            {
              "type": "function",
              "name": "get_current_weather",
              "description": "Get the current temperature for a city.",
              "parameters": {
                "type": "object",
                "properties": {
                  "city": { "type": "string" }
                },
                "required": ["city"],
                "additionalProperties": false
              },
              "strict": true
            }
          ]
        }
      ]
    },
    {
      "type": "message",
      "role": "developer",
      "content": [
        {
          "type": "input_text",
          "text": "Call a tool for live weather; do not guess."
        }
      ]
    },
    {
      "type": "message",
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "What is the temperature in Paris now?"
        }
      ]
    }
  ],
  "tool_choice": "auto",
  "parallel_tool_calls": false,
  "reasoning": { "effort": "low", "context": "all_turns" },
  "store": false,
  "stream": true,
  "include": ["reasoning.encrypted_content"],
  "prompt_cache_key": "<generated from the Codex session>",
  "text": { "verbosity": "low" },
  "client_metadata": {
    "x-codex-turn-metadata": "<JSON string generated by Codex>"
  }
}
```

The most revealing detail is not merely another field name. The header literally says **`internal-codex-responses-lite`**. [Codex's source test](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/tests/suite/responses_lite.rs#L28-L139) also asserts that top-level `tools` and `instructions` are absent, that `input[0]` is `additional_tools`, and that a developer instruction follows it. This is an internal transport contract between Codex and a provider that supports it, not a new public Responses API format that ordinary developers should adopt.

| Exact comparison | Public Responses API | Codex Responses Lite |
| --- | --- | --- |
| Intended caller | Ordinary API applications | Codex and providers that explicitly support Lite |
| Tool location | Top-level `tools` | `input[0].tools` in an item whose type is `additional_tools` |
| Instruction location | Top-level `instructions` | The following developer message |
| Top-level `tools` present? | Yes | No; source sets it to `None` and serialization omits it |
| Public and portable? | Yes | No; the request header explicitly marks it Codex internal |
| Can the model ultimately see the tools? | Yes | Only when the service supports this internal contract |

The precise earlier distinction should therefore have been: **one Codex client has two request encodings, and model metadata selects the internal Lite encoding for some models**—not “GPT-5.6 replaced the public API format.” In the Lite path, first-turn visibility still has two layers: entrypoints such as `exec` and `wait` are directly callable, while tools documented inside the `exec` guide are invoked as `tools.xxx(...)`.

Think of the public API and Lite as boarding passes printed by two airlines, not two different airports. `exec` is then a connecting pass that already lists the counters available beyond its gate.

## What GPT-5.6 Sol/Terra Can Call Directly at First

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

Code that can execute a tool may already exist in the repository without that tool appearing on every first request. Codex still has to **add it to the catalog → decide whether to show it now, after search, or never → decide whether it belongs inside `exec` → serialize the final request**. Missing environments, disabled features, provider limitations, plan gates, and name collisions can remove a tool along the way.

## Is `tool_search` on the First Request?

By design, `tool_search` is registered only when both conditions hold:

- The model advertises `supports_search_tool` and the provider supports namespace tools.
- The registry contains at least one Deferred Tool with `search_info`.

In `rust-v0.147.0`, MCP tools are registered into the runtime but receive Deferred exposure whenever search is available. Their full schemas do not have to occupy the first-turn context. A `tool_search` call returns matching `LoadableToolSpec` entries for the next model call, with a default limit of eight.

There is, however, an important detail in the latest stable source: **the GPT-5.6 `code_mode_only` path does not currently convert `ToolSpec::ToolSearch` into an `exec`-nested definition**. `register_code_mode_executors()` explicitly continues past `ToolSearch`, while Code Mode Only hides ordinary direct tools other than `exec` and `wait`. The practical result is:

- In Direct mode, `tool_search` can be a first-turn top-level tool whenever deferred tools exist.
- In the stable GPT-5.6 Code Mode Only path, `tool_search` **does not enter** the callable first-turn surface even if its BM25 handler has been registered. Without an exposed Tool Spec, the Agent has no invocation entrypoint.
- Public issue [#32101](https://github.com/openai/codex/issues/32101) documents this bridge gap. As of August 9, 2026, commit [`646f7c0`](https://github.com/openai/codex/commit/646f7c0a91b8e327d263335da68ae8ef212895ce) on `main` still contains the skip branch.

That distinction matters: **present in the registry is not the same as visible in the request, and intended to be discoverable is not the same as wired through every Tool Mode today.**

## What One Tool Search Actually Looks Like

Set aside the Code Mode Only bridge gap for a moment and examine a Direct/Deferred path in which `tool_search` **is exposed to the model**. It is not a retrieval job that automatically runs every turn. It is one optional action in the model's toolbox.

### It Is Model-Chosen, Not an Automatic Per-Turn Fallback

The Codex client contains no fallback loop that says, “if none of the explicit Tools fit, run BM25.” Tool choice is automatic; only after the model emits a structured `tool_search_call` does the Router dispatch it to the handler. The model may use an already-visible Tool first or search immediately from the task—it does not have to fail against each explicit Tool before searching.

Imagine a developer entering a hardware store. A hammer and screwdriver are already on the shelf, and the clerk can search the stockroom. The clerk does not search the stockroom after every step of tightening a screw. A request such as “measure fiber loss,” however, justifies a catalog lookup. Once a searched Tool is loaded and remains in the active conversation context, later turns can call it **without searching for the same Tool again**. A new need, a changed catalog, a new task, or loss of the earlier search output from active context can require another search.

The official API's Deferred Loading still gives the model minimal discovery information on turn one: Namespaces and MCP servers expose high-level names and descriptions, while an individually deferred Function retains its name and description but defers most parameters. In Codex's client-side BM25 path, the model first sees the `tool_search` entry and its searchable-source guidance; the complete `LoadableToolSpec` arrives only after a hit. Both designs follow the same principle: **show the catalog before moving the warehouse.**

### Should a New Agent Use This Difference?

Start from first principles. An Agent only needs four links to work: **the tools you own → the definitions the model receives → the format in which the model requests a call → the code that executes it and returns a result**. `tools` versus `additional_tools` is only transport packaging for the second link. It should not leak into business tool implementations.

| Your situation | What to do | What not to do |
| --- | --- | --- |
| Calling the public OpenAI Responses API | Keep using top-level `tools`; add `tool_search` and deferred tools there when needed | Do not construct `additional_tools` yourself |
| Only a small tool set | Send complete definitions directly and keep the design simple | Do not add search merely to imitate Codex |
| Hundreds of tools, all known when creating the request | Use hosted `tool_search` so the OpenAI service searches and loads them | You do not need to copy Codex's local BM25 first |
| Tools vary by tenant, project, or permission | Use client-executed `tool_search`; let the model request discovery, run BM25/vector/hybrid retrieval in your application, and return `tool_search_output` | Do not send every tenant's entire inventory |
| Forking Codex with a provider that explicitly supports Responses Lite | Preserve the Codex provider adapter and let it produce `additional_tools` plus the internal header | Do not couple business code directly to this internal format |
| Connecting DeepSeek, GLM, Kimi, or a local model | Keep one internal tool representation and write a thin adapter for each model protocol | Do not assume another provider understands OpenAI's internal `additional_tools` item |

For a new large-tool Agent that calls the public Responses API, this official pattern—not the Lite body—is the part you can use directly:

```python
from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-5.6",
    input="List open orders for customer CUST-12345.",
    tools=[
        {
            "type": "namespace",
            "name": "crm",
            "description": "Customer profile and order tools.",
            "tools": [
                {
                    "type": "function",
                    "name": "list_open_orders",
                    "description": "List open orders by customer ID.",
                    "defer_loading": True,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "customer_id": {"type": "string"}
                        },
                        "required": ["customer_id"],
                        "additionalProperties": False,
                    },
                    "strict": True,
                }
            ],
        },
        {"type": "tool_search"},
    ],
    parallel_tool_calls=False,
)
```

This is the reusable design: show the model the `crm` catalog first, then load the full `list_open_orders` parameters only when needed. Whether the outer transport uses top-level `tools`, a Lite input item, or another model vendor's format belongs in the provider adapter at the edge.

### Where Results Appear and How Long They Remain Usable

A client-executed search has this sequence:

```text
model: tool_search_call(query="calendar")
Codex: BM25 Top-K → LoadableToolSpec
context tail: tool_search_output { call_id, status, tools: [...] }
model: function_call(name="create_event", ...)
later turns: create_event remains callable
```

`tool_search_output` is a dedicated Responses input item—not system text, user text, or a retroactive edit of the initial `additional_tools`. Codex records the Call/Output pair in conversation history. When the next request carries those history items, the model can treat the complete schemas in `tools` as loaded candidates. The official design injects loaded tools at the end of model context, which also preserves a stable prefix and improves the opportunity for Prompt Cache hits.

“Callable in future turns” needs a boundary: it means within the same active conversation while that output remains in the context sent to the model. It is not a process-wide permanent installation. A new conversation, context-compaction policy, or catalog update can require discovery again. Think of placing a stockroom manual into this work order, not welding the machine permanently onto the bench.

### Why Does the Stable Catalog Select Code Mode Only for GPT-5.6?

The source proves a configuration fact: GPT-5.6 Sol, Terra, and Luna in the stable model catalog all declare `tool_mode: "code_mode_only"` and Responses Lite; the adjacent GPT-5.5 entry does not. The code treats this as **model capability metadata and a protocol compatibility contract**. There is no comment or design document saying, “5.6 is smarter, therefore enable it.” API-level `tool_search` is not exclusive to 5.6 either: the official guide lists support for GPT-5.4 and later.

The following is an explicitly labeled engineering inference, not a source quotation. Code Mode Only asks the model to write valid JavaScript inside `exec`, follow Tool Schemas, manage asynchronous work and failures, and filter or compress results within one cell. Stronger coding, reasoning, and tool-use training are clearly enabling conditions. Activation also depends on targeted post-training, evaluation thresholds, provider protocol support, and rollout policy. **“A stronger model makes this viable” is reasonable; “raw strength is the only reason” is not established.**

## What Shrinking Hundreds of Manuals to a Few Actually Saves

Suppose an Agent connects N Tools and each complete Schema averages S tokens. Sending everything directly makes the tool portion of one request approximately:

```text
Full cost ≈ N × S
```

Deferred loading keeps only a search entrance and short catalog resident, then loads K hits:

```text
Deferred cost ≈ catalog_summary + search_tool + K × S
```

When `K ≪ N`, the saving is not only tokens. The model sees fewer similar names and parameter combinations, making final Tool selection easier. Strictly speaking, `tool_search` does not increase intelligence inside the model weights. It improves effective Agent intelligence by **reducing noise, presenting the right information, and splitting one large decision into two smaller decisions.**

This is not free in every case. Search adds a Model → Tool → Model round trip and can miss a relevant Tool. If the Agent has a dozen Tools and uses most of them every turn, direct exposure may be faster. If it has hundreds or thousands and needs only a few per task, Deferred + Top-K becomes much more attractive. That design judgment transfers without Codex or Rust.

## BM25 Does Not Abandon Keywords; It Ranks Them

“Why BM25 instead of keyword matching?” contains a small misconception. **BM25 is still lexical keyword retrieval.** It is not an embedding model, and it does not inherently know that “book a meeting” and “create a calendar event” are synonyms. The difference is that a crude matcher usually answers only hit or miss; BM25 also answers which hit deserves first place.

{{< figure
  src="/images/posts/codex-first-request-tools/bm25-library-v2-en.png"
  alt="Library-card metaphor comparing boolean keyword matching with BM25 Top-K ranking over tool metadata"
  caption="A keyword filter dumps every matching card into a pile. BM25 ranks by term rarity, frequency saturation, and description length. Top-5 is illustrative for readability; Codex defaults to a limit of eight. The footer also makes the lexical—not semantic—boundary explicit."
>}}

First, keep this conceptual shorthand in mind:

```text
score(D, Q) = Σ IDF(t) × TF_saturation(t, D) × length_normalization(D)
```

That is not the full equation executed by the library. `bm25` 2.3.2 uses the standard form:

```text
score(D, Q) = Σ IDF(qᵢ) ×
              f(qᵢ,D) × (k₁ + 1)
              ─────────────────────────────────────────
              f(qᵢ,D) + k₁ × (1 - b + b × |D| / avgdl)
```

Here `f(qᵢ,D)` is the term frequency in one tool card, `|D|` is that card's length, and `avgdl` is the corpus-wide average length. Codex calls `with_documents(...).build()` without overriding parameters, so the crate defaults apply: `k₁ = 1.2` and `b = 0.75`; fitting the document batch establishes `avgdl`. Codex decides which cards reach the librarian, while the crate tokenizes, counts, scores, and ranks them.

In library terms:

- **Rare terms weigh more (IDF).** Almost every card may contain `get`, so it has little discriminating power. If only a few contain `calendar`, that term is much more useful.
- **Repetition saturates.** Writing `calendar` three times can strengthen the signal, but it does not mechanically make the card three times better. Keyword stuffing cannot dominate indefinitely.
- **Length is normalized.** A long description has more chances to contain query words. BM25 corrects for that so “wrote the most” does not automatically mean “most relevant.”
- **The output is already Top-K.** `tool_search` wants eight ordered candidates by default, not a bag of unordered boolean hits.

The source does not index only tool names. For ordinary tools, search text includes both the raw name and an underscore-to-space form—`create_event` and `create event`—plus namespace metadata, descriptions, parameter names, and parameter descriptions. MCP tools add canonical and callable names, server, title, connector, plugin display names, and input-schema property names. This matters because the default tokenizer splits on Unicode word boundaries, lowercases, removes English stop words, and applies English stemming; the space-separated form makes `create` and `event` independent lexical signals.

## Source Deep Dive (Optional): How Codex Connects BM25

The formula explains how documents are scored, but an implementation must still answer three questions: where the documents come from, how a BM25 document ID leads back to a tool, and how a search hit becomes a callable schema on the next turn. In the stable release, that path runs through `spec_plan.rs`, the `ToolSearchHandler`, and the search-text builders in `codex-tools`.

The first important clarification is that **Codex does not reimplement the BM25 equation itself**. `codex-rs/Cargo.toml` depends on [`bm25 = "2.3.2"`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/Cargo.toml#L294). That in-memory library handles tokenization, document frequency, average document length, and scoring; Codex supplies the corpus and maps ranked results back into its tool types.

You can understand the implementation without Rust by reading it as four lines of pseudocode:

```text
cards = deferred_tools.map(search_text + loadable_schema)
engine = BM25.build(cards.search_text)
ids = engine.search(query, limit = 8)
return merge(cards[id].loadable_schema)
```

The Rust below is the strongly typed form of those four operations. Read `.filter()`, `.map()`, and `.collect()` as ordinary list filtering, transformation, and collection.

### Step 1: Collect only tools that should appear after search

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

### Step 2: Give every card a numeric retrieval number

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

### Step 3: Rank the IDs and recover complete tool manuals

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

{{< figure
  src="/images/posts/codex-first-request-tools/tool-search-data-flow-v1-en.png"
  alt="Complete Codex tool_search data flow from Deferred Tool through ToolSearchInfo, Document usize, the bm25 crate, and tool_search_output"
  caption="The source boundary is explicit: steps 1–3 and 5–6 are Codex glue code; step 4 is the external bm25 2.3.2 crate. The IDs [7, 2, 11] are labeled as illustrative—not measured ranks or scores."
>}}

### One Query, End to End

Suppose the query is `calendar`. One indexed card might contain the following shortened text:

```text
create_event create event Create a calendar event title start_time end_time
```

The default English tokenizer applies Unicode normalization, lowercasing, stop-word removal, and stemming to both query and card. If BM25 places this card in Top-K, the handler uses its document ID to recover the associated `LoadableToolSpec`. “Matching text” is not itself the invocation: **the match yields a card number, and that number retrieves the complete schema.**

Next, [`ToolSearchOutput::to_response_item()`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/context.rs#L149-L185) turns the result into a dedicated Responses input item. The source unit test verifies this wire shape; the example keeps an empty parameter object to make the path easy to see:

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

This is neither ordinary text output nor a late mutation of the first request's `additional_tools` array. It enters conversation history as `tool_search_output` and travels with the next Responses request, allowing the provider and model to treat the entries in `tools` as search-loaded candidates. The unit test proves the output framing, not an actual BM25 ranking; ranking remains the job of `SearchEngine::search()` described above.

There is one final performance detail. [`ToolSearchHandlerCache`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/handlers/tool_search.rs#L34-L74) compares the new `search_infos` and source-listing mode with the cached handler. If the tool world is unchanged, Codex reuses the existing `Arc<ToolSearchHandler>` and in-memory index; it rebuilds only when MCP, plugin, or dynamic-tool metadata changes. In library terms, yesterday's card catalog remains useful until new books arrive.

To follow the exact source path, read [`append_tool_search_executor()`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/spec_plan.rs#L1165-L1185), [`ToolSearchHandler`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/handlers/tool_search.rs#L76-L197), and the [`ToolSearchEntry` / `search_text` builders](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/tools/src/tool_search.rs#L12-L150) in that order.

## Python and Go Can Use the Same Design

The lesson above should not be “Codex has a Rust-specific trick.” It should reveal three language-independent interfaces:

```text
build(cards: [{id, search_text, schema}]) -> index
search(index, query, top_k) -> ranked_ids
load(cards, ranked_ids) -> callable_schemas
```

Codex stores cards in `Vec<ToolSearchInfo>`, ranks them with a Rust `bm25` crate, and recovers schemas by array index. Another language only changes the container and library:

| Environment | Tool cards | BM25 ranking | Load after a hit |
| --- | --- | --- | --- |
| Rust / Codex | `Vec<ToolSearchInfo>` | `bm25` crate | `search_infos[id]` |
| Python Agent | list / dataclass / dict | Any BM25 library or search service | `cards[id]["schema"]` |
| Go Agent | `[]ToolCard` struct | Any Go BM25 implementation or search service | `cards[id].Schema` |
| Multi-service system | Database or Tool Registry | Separate retrieval service | Fetch Schema by Tool ID |

The reusable part is the data contract, not the source syntax:

1. Generate high-quality `search_text` for every Tool, including its name, action, object, parameters, and risk terms.
2. Return ranked Top-K IDs from BM25, not an unordered boolean set of “contains keyword” matches.
3. Resolve IDs into complete, validated schemas and write them into subsequent Agent state.
4. Measure recall, false retrievals, eventual call success, and added round-trip latency before choosing K or adding vector recall.

A business Agent written entirely in Python or Go can therefore reuse this design. The BM25 equation, card inputs, and Top-K output do not change with the programming language; Rust is simply Codex's implementation vehicle.

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

## Can BM25 Search Memory Too?

**Yes, but it fits best as the lexical-recall leg—not as an entire long-term memory system.** First, a source-level correction: this stable Codex release does not reuse the BM25 implementation above for Memory search. `ext/memories` exposes substring queries, optionally normalizes whitespace or separators, and organizes matches by path and line number. It neither computes BM25 relevance nor ranks by semantic similarity.

BM25 is still useful for Memory because error codes, function names, file paths, project codenames, people, and exact decision language are powerful lexical anchors. For “how did we handle `EADDRINUSE` last time?”, BM25 is often more stable than vectors alone and ranks results more usefully than a substring filter.

Memory is harder than a collection of Tool cards, however. The same event may be paraphrased; a newer conclusion may supersede an older one; retrieval must account for whose memory, which project, when it happened, and how trustworthy it is. BM25 does not model those relationships:

| Memory need | BM25 alone |
| --- | --- |
| Exact names, paths, error codes, and APIs | Strong |
| Paraphrases and cross-language expressions | Weak |
| User, project, and time scope | Needs metadata filters |
| Conflicting conclusions, trust, and importance | Needs additional ranking and governance |

A more reliable production pipeline is:

```text
metadata filters for user / project / time
  → BM25 lexical recall  ||  embedding semantic recall
  → fuse both candidate sets (for example, RRF)
  → weight recency, importance, trust, and usage
  → lightweight reranking
  → return source spans and provenance
```

For a small local Memory dominated by technical logs, starting with BM25 is entirely reasonable; it adds meaningful ranking over the current substring list. As paraphrase, multilingual use, and contradictory memories grow, hybrid retrieval becomes more valuable. This is a general architecture recommendation—**not a claim that Codex already implements this pipeline.**

## Open-Source Codex Can Change Models, but It Takes More Than a New Name

The precise claim is not “turn GPT-5.6 into DeepSeek, GLM, or Kimi.” It is: **keep the Codex Agent Runtime and replace the model and Provider behind it.** Core components such as Codex CLI, SDK, and App Server are open source, while model transport is isolated behind the Provider layer. The sandbox, approvals, Tool Registry, MCP, conversation history, and execution loop can therefore remain reusable.

The minimum control loop is independent of a model brand:

```text
user task + conversation state + Tool Schemas
                    ↓
              Model Provider
                    ↓
            Tool Call / Agent Text
                    ↓
       Codex Runtime executes, approves, records
                    └────────────────→ next model request
```

Model replacement is not only a one-line `model = "..."` edit. At least three contracts must align:

| Adaptation layer | What must align | Symptom when it does not |
| --- | --- | --- |
| Transport | `base_url`, authentication, headers, streaming, retries | Connection, 401, or broken-stream failures |
| Wire protocol | Responses input items, Tool Call/Output, stream events, and errors | Text works but the Tool loop breaks |
| Capability | Context size, structured calls, parallel Tools, reasoning fields, Tool Mode, and Search | Requests run but Agent quality or features disappear |

The official configuration supports a custom `model_provider`. If a business gateway already exposes a compatible Responses endpoint, the shortest path looks like:

```toml
model = "your-business-model"
model_provider = "business_gateway"

[model_providers.business_gateway]
name = "Business model gateway"
base_url = "https://llm-gateway.example.com/v1"
env_key = "BUSINESS_LLM_API_KEY"
wire_api = "responses"
```

One pinned-version restriction is essential: the [`WireApi`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/model-provider-info/src/lib.rs#L49-L79) in `rust-v0.147.0` accepts only `responses` and explicitly rejects `wire_api = "chat"`. Therefore, when integrating DeepSeek, GLM, Kimi, or another business model:

- If the server fully supports Responses, streaming events, and Tool Calling, start with a custom Provider configuration.
- If it exposes only a Chat-Completions-style API, use a gateway that translates Responses bidirectionally into the vendor protocol, or modify the open-source Provider/Client adapter.
- “The endpoint returns text” is not proof of Agent compatibility; evaluate real Tool Calls, Tool Outputs, long context, recovery, and parallel calls.

Another subtle source behavior matters: an unknown model slug receives [`fallback model metadata`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/models-manager/src/model_info.rs#L137-L180). Those conservative defaults disable `supports_search_tool`, Responses Lite, Code Mode Only, and parallel Tool Calls. A basic Direct Tool loop may work first, but GPT-5.6-specific optimizations **do not transfer automatically**. Restoring them requires extending model metadata or capability configuration and proving through evals that the replacement model handles those protocol actions reliably.

The fastest low-risk migration order for a business team is:

1. Make the replacement model close a text-plus-small-Direct-Tool loop through a Responses adapter.
2. Validate parameter schemas, Tool Call/Output pairing, stream interruption, and context compaction.
3. Compare success rate, cost, and latency on business tasks—not only chat quality.
4. Enable parallel Tools, Deferred Search, and Code Mode incrementally.

That is the real reuse value of an open-source Agent framework: retain a mature execution and governance foundation, replace model transport and capability boundaries, then add business Tools, policy, Memory, and evals in layers you control.

## Seven Takeaways

First, the initial request does not “send every tool to the model.” Exposure, Tool Mode, provider capabilities, environment state, and feature gates jointly compute the interface.

Second, the public Responses API puts tools in top-level `tools`; only Codex's internal Responses Lite moves them into an `additional_tools` input item. Both are structured data rather than system/user prose.

Third, `tool_search` is a model-chosen action, not an automatic per-turn fallback. Its structured output enters history, so loaded Tools remain callable in the same active conversation.

Fourth, Code Mode Only demands stronger coding and orchestration capabilities, but the stable source only establishes model compatibility metadata; it does not prove that “strength” is the sole reason GPT-5.6 receives it.

Fifth, BM25 is ranked keyword retrieval. It fits Tool Schemas and exact lexical Memory recall; a complete Memory system benefits from metadata, BM25, vector recall, and reranking together.

Sixth, BM25 and the `search_text → ranked IDs → Schema` flow form a language-independent contract that can be reproduced in Rust, Python, Go, or a separate retrieval service.

Seventh, open-source Codex permits Model Provider replacement, but Transport, the Responses wire protocol, and model capabilities must align together. Replacing a model does not automatically inherit GPT-5.6 Tool Search or Code Mode metadata.

## Source Index

- [GPT-5.6 Sol capabilities and Tool Mode](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/models-manager/models.json#L4-L22)
- [GPT-5.6 Terra Code Mode Only metadata](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/models-manager/models.json#L119-L137)
- [GPT-5.6 Luna Code Mode Only metadata](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/models-manager/models.json#L232-L250)
- [The adjacent GPT-5.5 entry does not select Code Mode Only](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/models-manager/models.json#L341-L359)
- [Official OpenAI Tool Search guide: deferred loading, call sequence, and reuse in future turns](https://developers.openai.com/api/docs/guides/tools-tool-search)
- [Official OpenAI Programmatic Tool Calling guide](https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling)
- [Official Codex custom Model Provider configuration](https://learn.chatgpt.com/docs/config-file/config-advanced#custom-model-providers)
- [Codex open-source component boundaries](https://learn.chatgpt.com/docs/open-source)
- [Tool registry, exposure, and model-visible spec planning](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/spec_plan.rs#L319-L486)
- [Conditional registration of core tools](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/spec_plan.rs#L818-L1118)
- [Responses Lite `additional_tools` request framing](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/client.rs#L849-L885)
- [Responses Lite test: internal header, omitted top-level fields, and input-item order](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/tests/suite/responses_lite.rs#L28-L139)
- [`tool_search` BM25 engine and Top-K output](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/handlers/tool_search.rs#L76-L169)
- [How names, descriptions, and schemas become tool-search text](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/tools/src/tool_search.rs#L23-L150)
- [How a `tool_search` result becomes a dedicated input item for the next request](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/tools/context.rs#L149-L185)
- [How `tool_search_call` / `tool_search_output` remain in conversation history](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/context_manager/history.rs#L350-L386)
- [Direct / Deferred registration of MCP tools](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/core/src/mcp_tool_exposure.rs#L17-L89)
- [BM25 crate version: 2.3.2](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/Cargo.toml#L294)
- [`bm25` 2.3.2 equation and default parameters](https://github.com/Michael-JB/bm25/blob/8ef726045b41702e148d8996d344f3500844fde1/src/embedder.rs#L146-L205)
- [`bm25` 2.3.2 tokenizer splitting, normalization, stop words, and stemming](https://github.com/Michael-JB/bm25/blob/8ef726045b41702e148d8996d344f3500844fde1/src/default_tokenizer.rs#L263-L289)
- [Current substring-query semantics of the Codex Memory Tool](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/ext/memories/src/tools/search.rs#L28-L62)
- [Codex Memory local search and result ordering](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/ext/memories/src/local/search.rs#L17-L88)
- [The stable release accepts only the Responses Wire API and rejects old `chat` configuration](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/model-provider-info/src/lib.rs#L49-L79)
- [How an unknown model receives conservative fallback capability metadata](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/models-manager/src/model_info.rs#L137-L180)

> Source checked on August 9, 2026. The stable release is pinned to `be6e8eac`; the same-day `main` check is pinned to `646f7c0a`; the BM25 crate is pinned to `v2.3.2` commit `8ef72604`. Tool exposure and model catalogs continue to evolve; debug a specific environment against its actual request and exact commit.

> Image-generation note: the two language editions contain six technical figures in total, all generated or edited through Codex's built-in `image_gen.imagegen`. In the pinned source, that extension hard-codes [`IMAGE_MODEL` to `gpt-image-2`](https://github.com/openai/codex/blob/be6e8eac029b183056b7e4402879f15d2c85f61b/codex-rs/ext/image-generation/src/tool.rs#L53-L58) and uses it to construct the Images request. Mode state, Top-K annotations, illustrative IDs, and bilingual labels were manually checked before publication.
