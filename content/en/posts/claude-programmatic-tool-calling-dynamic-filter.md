---
title: "Claude's Tool Calling Paradigm Shift: A Deep Dive into Programmatic Tool Calling and Dynamic Filtering"
description: "Anthropic's Programmatic Tool Calling and Dynamic Filtering aren't just feature additions — they represent a paradigm shift in Agent architecture: from natural language orchestration to code-driven orchestration, from full context injection to on-demand filtering. Synthesizing multiple non-AI-written deep-dive articles, this post covers architecture, benchmarks, and production patterns."
date: 2026-06-13
tags: ["Claude", "AI Agent", "Agent Architecture", "Tool Calling", "Context Engineering", "Programmatic Tool Calling", "Dynamic Filtering", "Code Execution"]
categories: ["Agent Engineering"]
series: ["Agent Architecture Deep Dives"]
series_order: 1
seriesOpened: true
showToc: true
ShowReadingTime: true
---

## Background: The Cost Problem in Agent Tool Calling

In traditional agent tool-calling, every tool invocation requires a full cycle of "model inference → tool execution → result return → model re-inference." This seemingly natural loop breaks down at scale in three ways:

1. **Context Pollution**: Every tool result is injected verbatim into the context window. Fetch expense reports for 20 employees, and 2,000+ line items enter context — even though you only need to know "which 3 people exceeded their budget."
2. **Inference Overhead**: Each tool call demands a full model inference pass. Five tools = five inference passes, each costing hundreds of milliseconds to seconds.
3. **Noise Degrades Accuracy**: When the context window is packed with intermediate results, the model must find signal in noise. [Context Rot research](https://arxiv.org/abs/2509) shows LLM performance on complex tasks drops 50-70% as context grows.

As Florian Bruniaux puts it in the [Claude Code Architecture Guide](https://cc.bruniaux.com/guide/architecture/): **"The Outer Loop — everything outside the model: context management, tool invocation, verification, memory consolidation — increasingly determines system quality more than model inference itself."**

Anthropic's suite of tool-use enhancements, released between November 2025 and February 2026, are fundamentally about solving Outer Loop efficiency. Among them, **Programmatic Tool Calling (PTC)** and **Dynamic Filtering** represent the deepest paradigm shift.

---

## Programmatic Tool Calling: Code-Driven Orchestration

### The Core Paradigm Shift

Michael Ridland, writing on the [Team 400 blog](https://team400.ai/blog/2026-03-claude-programmatic-tool-calling-ai-agents), pinpoints the traditional bottleneck:

> "Every time an agent needs to call a tool — query a database, check an API, read a file — it has to do a full round trip back to the model. The model generates a tool call, your code executes it, the result goes back to the model, the model processes it, and maybe generates another tool call. Repeat."

PTC's paradigm shift: **Instead of Claude requesting tools one at a time and having results return to its context, Claude writes Python code that orchestrates all tool calls internally. Only the final `stdout` enters the context window.**

```
Traditional: Prompt → Claude → Tool 1 → Result 1 → Claude → Tool 2 → Result 2 → Claude → Answer
             (3 tools = 3 inference passes, 3× intermediate results in context)

PTC:         Prompt → Claude → writes Python → code calls Tool 1, 2, 3 → stdout → Claude → Answer
             (3 tools = 1 inference pass, only final output in context)
```

The concept is simple, but its implications are profound — **it moves orchestration logic from the model's "reasoning chain" into a "code execution environment."** Loops, conditionals, data transformations, and error handling all become explicit code rather than implicit model reasoning. Masaki Hirokawa of Claude Lab, in his [production guide](https://claudelab.net/en/articles/api-sdk/claude-api-programmatic-tool-calling-production-guide), summarizes:

> "Claude excels at writing code. By letting it express orchestration logic in Python rather than through natural language tool invocations, you get more reliable, precise control flow."

### How It Works: Container-Based Orchestration

PTC relies on the Code Execution tool (sandboxed container) to run:

1. **Mark tools as callable**: Use the `allowed_callers` field to specify which tools can be invoked from code
2. **Claude generates orchestration code**: Claude writes a Python script containing multi-step tool calls, data processing, and control flow
3. **Container executes and pauses**: When code calls a tool, the container pauses and the API returns a `tool_use` block
4. **You provide tool results**: Results go back to the code (not the model context), and execution continues
5. **Only final output reaches Claude**: All intermediate results are filtered; Claude only sees the final `stdout`

```json
{
  "tools": [
    {"type": "code_execution_20260120", "name": "code_execution"},
    {
      "name": "query_database",
      "description": "Execute SQL. Returns rows as JSON: id (str), name (str), revenue (float).",
      "input_schema": {...},
      "allowed_callers": ["code_execution_20260120"]
    }
  ]
}
```

The critical field is `allowed_callers`, which has three possible values:

| `allowed_callers` Value | Meaning |
|---|---|
| Omitted / `["direct"]` | Traditional calling only |
| `["code_execution_20260120"]` | Callable from sandbox code only |
| `["direct", "code_execution_20260120"]` | Both modes (**not recommended** — confuses Claude) |

Bruniaux's architecture guide highlights an important safety note: **`allowed_callers` is not a hard security boundary.** It's a strong guidance (Claude is trained to respect it), but your client should still be prepared to handle a direct `tool_use` for any tool it defines.

### Container Lifecycle

Containers have a 4.5-minute idle timeout and a 30-day maximum lifetime. Always check the `expires_at` field on every response. If the container expires, Claude treats the tool call as timed out and retries.

### Real Performance Data

Claude Lab provides detailed benchmark comparisons:

```
Benchmark: 10-URL web research task

Traditional Tool Use:
  Round trips: 10 (1 search + 9 page fetches)
  Inference passes: 11
  Average latency: 45 seconds
  Token consumption: ~120,000 tokens

PTC:
  Round trips: 2 (1 code generation + 1 result return)
  Inference passes: 2
  Average latency: 8 seconds (parallel fetching)
  Token consumption: ~25,000 tokens
```

Anthropic's official data validates this:

- Average input token reduction of **37%** on complex research tasks (43,588 → 27,297 tokens)
- BrowseComp accuracy jumped from 42% to **71%** (PTC was the key unlock)
- On a 75-tool project-management agent benchmark, billed tokens dropped ~**38%** with no accuracy loss

Community analyst Shayan Tabe's independent analysis confirms the ~37% overall token reduction, though this number has not been officially endorsed by Anthropic.

### Production Patterns: Four PTC Programming Paradigms

PTC's real power lies in four concrete programming patterns, all achievable in a single inference pass:

#### 1. Batch Processing

```python
regions = ["West", "East", "Central", "North", "South"]
results = {}
for region in regions:
    data = await query_database(f"SELECT * FROM sales WHERE region = '{region}'")
    results[region] = sum(row["revenue"] for row in data)
top_region = max(results.items(), key=lambda x: x[1])
print(f"Top region: {top_region[0]} with ${top_region[1]:,}")
```

#### 2. Early Termination

```python
for endpoint in ["us-east", "eu-west", "apac"]:
    status = await check_health(endpoint)
    if status == "healthy":
        print(f"Found healthy endpoint: {endpoint}")
        break  # Don't check remaining endpoints
```

#### 3. Conditional Tool Selection

```python
file_info = await get_file_info(path)
if file_info["size"] < 10000:
    content = await read_full_file(path)
else:
    content = await read_file_summary(path)
print(content)
```

#### 4. Data Filtering

```python
logs = await fetch_logs(server_id)
errors = [log for log in logs if "ERROR" in log]
print(f"Found {len(errors)} errors")
for error in errors[-10:]:  # Return only last 10
    print(error)
```

Team 400's Michael Ridland captures the key insight:

> "If 20 database queries return 5,000 rows total but only 3 employees are over budget, the model only sees those 3 employees. That's potentially a 100x reduction in tokens."

### When to Use PTC (and When Not To)

The combined wisdom from Claude Lab and Anthropic's docs yields a clear decision matrix:

**Strong fit:**
- Processing large datasets where you only need aggregates or summaries
- Multi-step workflows with 3+ dependent tool calls
- Filtering, sorting, or transforming results before Claude sees them
- Tasks where intermediate data shouldn't influence Claude's reasoning
- Parallel operations across many items (checking 50 endpoints)

**Weak fit:**
- Strictly sequential workflows where each step depends on Claude reasoning over the previous result
- A small number of tool calls with small responses
- Tools requiring immediate user feedback between calls

Anthropic's internal evaluation on τ²-bench reveals PTC's blind spot: in airline/retail/telecom domains where each turn makes only 1-2 sequential tool calls, PTC left scores unchanged and cost ~8% more. **Sequential single-call workflows do not benefit.**

### Constraints and Pitfalls

PTC is not a silver bullet. Key constraints to consider during architecture:

| Constraint | Detail |
|---|---|
| **No ZDR support** | Cannot be used where Zero Data Retention compliance is required |
| **No MCP tools** | Tools provided by MCP connectors cannot be called programmatically |
| **No `strict: true`** | Structured outputs with `strict: true` are incompatible with PTC |
| **No forced tool choice** | Cannot use `tool_choice` to force programmatic calling of a specific tool |
| **Container timeout** | Slow tool execution may cause container timeout and retry loops |
| **Debugging complexity** | Logic lives in generated code — inspect code execution output to understand failures |

Michael Ridland specifically warns about debugging:

> "When something goes wrong in a traditional tool-calling flow, you can trace each step. With PTC, the logic lives in generated code. You need to inspect the code execution output to understand what happened. Build in logging."

---

## Dynamic Filtering: Context Slimming for Web Search

### The Problem

Web search is the most token-intensive task. The traditional flow: initiate query → get search results → fetch full HTML from multiple websites → reason over everything in context. But the context pulled in from search is often mostly irrelevant — navigation bars, ads, footers, recommendations...

Anthropic's [official blog post](https://claude.com/blog/improved-web-search-with-dynamic-filtering) describes the solution:

> "Claude's web search and web fetch tools now automatically write and execute code to post-process query results. Instead of reasoning over full HTML files, Claude can dynamically filter the search results before loading them into context, keeping only what's relevant and discarding the rest."

### How It Works

Dynamic Filtering is essentially PTC principles applied natively to web search — let Claude write Python to pre-process search results:

```
Traditional: Query → Search API → 10 raw HTML pages → all enter context → Claude reasons

Dynamic Filtering: Query → Search API → 10 raw HTML pages → Claude writes code to extract key data → filtered summary enters context → Claude reasons
```

### Benchmark Results

Anthropic evaluated Dynamic Filtering on two rigorous benchmarks:

**BrowseComp Dataset:**

| Model | Without Filtering | With Filtering | Improvement |
|---|---|---|---|
| Sonnet 4.6 | 33.3% | 46.6% | **+13.3 pp** |
| Opus 4.6 | 45.3% | 61.6% | **+16.3 pp** |

**DeepSearchQA:** Tests whether an agent can systematically plan and execute multi-step searches without missing answers.

| Model | Without Filtering | With Filtering | Improvement |
|---|---|---|---|
| Sonnet 4.6 (F1) | 52.6% | 59.4% | +6.8 pp |
| Opus 4.6 (F1) | 69.8% | 77.3% | +7.5 pp |

Overall, Dynamic Filtering improved accuracy by an average of **11%** while using **24% fewer input tokens**.

Poe by Quora's internal team validated these findings:

> "Opus 4.6 with dynamic filtering achieved the highest accuracy on our internal evals when tested against other frontier models." — Gareth Jones, Product and Research Lead
>
> "The model behaves like an actual researcher, writing Python to parse, filter, and cross-reference results rather than reasoning over raw HTML in context."

### Configuration

```json
{
  "model": "claude-opus-4-6",
  "max_tokens": 4096,
  "tools": [
    {"type": "web_search_20260209", "name": "web_search"},
    {"type": "web_fetch_20260209", "name": "web_fetch"}
  ],
  "messages": [
    {
      "role": "user",
      "content": "Search for the current prices of AAPL and GOOGL, then calculate which has a better P/E ratio."
    }
  ]
}
```

Note: With `web_search_20260209` / `web_fetch_20260209`, Dynamic Filtering is **enabled by default** on Sonnet 4.6 and Opus 4.6. To disable it (e.g., for ZDR compliance), use `"allowed_callers": ["direct"]`.

**Important:** The basic `web_search_20250305` version qualifies for ZDR, but the Dynamic Filtering version does not by default because it relies on internal code execution.

---

## The Trinity: PTC + Tool Search + Tool Use Examples

Anthropic's Advanced Tool Use is actually three complementary features:

| Feature | Problem Solved | When to Use |
|---|---|---|
| **Tool Search Tool** | Tool definitions bloating context | 50+ MCP tools |
| **Programmatic Tool Calling** | Intermediate results polluting context | 3+ step tool workflows |
| **Tool Use Examples** | Schema alone can't express usage patterns | Complex nested parameter tools |

Bruniaux's architecture guide offers clear prioritization:

> "Address your biggest bottleneck first: context bloated by tool definitions? → Tool Search. Large intermediate results? → PTC. Parameter errors? → Tool Use Examples."

### Tool Search: On-Demand Discovery

A real-world example: connecting 5 MCP servers (GitHub 35 tools + Slack 11 tools + Sentry 5 tools + Grafana 5 tools + Splunk 2 tools) requires preloading 58 tool definitions into context, consuming ~**55K tokens**. With Tool Search enabled, only ~500 tokens of search tool stay resident, and 3-5 matched tools (~3K tokens) load on demand. **85% token overhead eliminated.**

Internal benchmarks:
- Opus 4 tool selection accuracy: 49% → **74%**
- Opus 4.5: 79.5% → **88.1%**

### Tool Use Examples: Teaching Claude Your Tool Conventions

JSON Schema defines structure, but not: when to include optional parameters, which combinations make sense, or what conventions your API expects.

```json
{
  "name": "create_ticket",
  "input_schema": { /* ... */ },
  "input_examples": [
    {
      "title": "Login page returns 500 error",
      "priority": "critical",
      "labels": ["bug", "authentication", "production"],
      "reporter": {
        "id": "USR-12345",
        "name": "Jane Smith",
        "contact": {"email": "jane@acme.com", "phone": "+1-555-0123"}
      },
      "due_date": "2026-06-13"
    },
    {
      "title": "Add dark mode support",
      "labels": ["feature-request", "ui"],
      "reporter": {"id": "USR-67890", "name": "Alex Chen"}
    },
    {
      "title": "Update API documentation"
    }
  ]
}
```

Three examples teach Claude:
- Dates use YYYY-MM-DD, user IDs follow USR-XXXXX, labels use kebab-case
- Critical bugs require full contact info + escalation; feature requests have reporter but no escalation; internal tasks need only title

Internal testing: complex parameter handling accuracy improved from **72% to 90%**.

---

## Architecture Decisions: When to Deploy, When to Bypass

### Understanding the Outer Loop

Bruniaux's architecture guide presents a core philosophy — **"Less scaffolding, more model."** This is embodied in Claude Code:

> "No intent classifier. No task router. No RAG pipeline. No DAG orchestrator. No planner/executor split. The model itself decides when to call tools, which tools to call, and when it's done."

PTC and Dynamic Filtering extend this philosophy — they don't add new abstraction layers, they **remove unnecessary ones**: no need to pass intermediate results to the model and wait for it to "think" about the next step; just orchestrate directly in code.

### Model Compatibility

PTC requires `code_execution_20260120`, currently supported on:
- Claude Opus 4.5+
- Claude Sonnet 4.5+
- Claude Fable 5 / Mythos 5

Dynamic Filtering requires `web_search_20260209`, enabled by default on Opus 4.6 / Sonnet 4.6.

### Deployment Checklist

Team 400 provides a practical four-step adoption path:

1. Enable the code execution tool in your API calls
2. Add `allowed_callers` to tools that should be callable from code
3. Test with prompts that require multiple tool invocations
4. Compare latency, token usage, and output quality against your traditional approach

Bruniaux emphasizes one easy-to-miss pitfall: **never set `["direct", "code_execution_20260120"]` on the same tool.** Pick one — this gives Claude clearer guidance on the optimal usage pattern.

---

## Summary

Programmatic Tool Calling and Dynamic Filtering represent a significant paradigm shift in Agent architecture: **from "everything goes through model inference" to "code-driven orchestration + on-demand filtering."**

This isn't a concept Anthropic invented from scratch — it's the systematic productization of a principle validated repeatedly in practice: **let the model do what it does best (reasoning and decision-making), and let code do what code does best (loops, filtering, parallel execution).**

| Dimension | Traditional Tool Calling | PTC / Dynamic Filtering |
|---|---|---|
| Orchestration logic location | Model's reasoning chain | Python code |
| Intermediate results | All enter context | Filtered in code, never hit context |
| Inference passes for N tools | N+1 | 1~2 |
| Token consumption | Linear growth with tool count | Major reduction (37%~80%) |
| Debugging approach | Step through each turn | Inspect code execution output logs |
| Best for | Simple lookups, human-in-the-loop decisions | Batch processing, data aggregation, multi-step research |

This article synthesizes the following sources (all human-authored, not AI-generated):

- [Anthropic Engineering: Introducing advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use) (Official blog, Nov 2025)
- [Claude Blog: Improved Web Search with Dynamic Filtering](https://claude.com/blog/improved-web-search-with-dynamic-filtering) (Official blog, Feb 2026)
- [Claude API Docs: Programmatic tool calling](https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling) (Official documentation)
- [How Claude Code Works: Architecture & Internals](https://cc.bruniaux.com/guide/architecture/) (Florian Bruniaux technical analysis, Feb 2026)
- [Claude Lab: PTC Production Guide](https://claudelab.net/en/articles/api-sdk/claude-api-programmatic-tool-calling-production-guide) (Masaki Hirokawa, Mar 2026)
- [Team 400: Why PTC Matters for AI Agent Performance](https://team400.ai/blog/2026-03-claude-programmatic-tool-calling-ai-agents) (Michael Ridland, Mar 2026)
