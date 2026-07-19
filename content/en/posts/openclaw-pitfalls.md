---
title: "OpenClaw in Production: When the Most Advanced Memory System Meets the Quietest Failure"
description: "A full-chain production battle log: from startup failures and Feishu message silent drops to production stability — compaction safeguard, five-layer debugging, model-harness fit, and memory system comparison."
date: 2026-05-27
tags: ["OpenClaw", "AI Agent", "Feishu", "Memory System", "Compaction", "Debugging"]
categories: ["Agent Engineering"]
series: ["OpenClaw Production Notes"]
series_order: 1
seriesOpened: true
summary: "A full-chain production battle log: from startup failures and Feishu message silent drops to production stability — compaction safeguard, five-layer debugging, model-harness fit, and memory system comparison."
showToc: true
ShowReadingTime: true
---

## Why OpenClaw

> Each paradigm shift in coding agents changes who owns the **verification loop**. The prompt engineering era (Copilot, 2021): humans write prompts, AI completes, humans verify — verification entirely in human hands. The context engineering era (Cursor, 2023): AI generates code blocks, humans review diffs — humans still lead, but AI starts doing lightweight lint/fix self-checks. The harness engineering era (Claude Code / Codex CLI / OpenClaw, 2025): AI writes code, AI runs tests, AI reads errors, AI fixes — the verification loop shifts from human to harness. **Humans no longer review every output line by line; they design and maintain the rules of the verification system.** The entire Outer Loop — everything outside the model: context management, tool invocation, verification, memory consolidation — now matters more for system quality than the model's reasoning ability itself. OpenClaw is the most ambitious on the memory side of this trend, but the least battle-tested on harness stability.
>
> Within the same era, there's a critical fork: **Vibe Coding** (Bolt.new, Lovable, Replit) throws verification at the user — "generate and ship"; **Engineering Rigor** (Claude Code, Aider, OpenClaw) encodes verification into the harness — retry on test failure. The gap between them isn't the model; it's the Outer Loop design philosophy.

Here's a mindmap of OpenClaw's architecture — every pitfall ahead ties back to these components:

{{< mermaid >}}
mindmap
  root((OpenClaw))
    📨 Message Ingress
      Feishu
      WeChat Work
      WebChat
      Telegram
    🔌 Channels Layer
      Message routing allowlist
      Deduplication dedup
      Session binding envelope
    🖥️ Gateway Daemon
      WebSocket Server :18789
      Authentication device pairing
      Scheduled tasks CRON engine
    🔄 Agent Loop
      Message ingestion agent RPC
      Context assembly bootstrap session skills
      Model inference multi-backend fallback
      Tool execution memory shell web
      Reply generation streaming delivery
    🧠 Memory System
      MEMORY.md long-term memory
      Daily logs YYYY-MM-DD.md
      DREAMS.md consolidation
      Vector BM25 hybrid search 7:3
{{< /mermaid >}}


OpenClaw is a harness-era autonomous coding agent, cross-model CLI, supporting DeepSeek / Anthropic / OpenAI backends. What drew me in was its **memory system** — the most ambitious among all production-available coding agents:

- **PPO cognitive weight adaptation**: the only production tool that uses reinforcement learning to adjust memory retrieval weights. Five-dimensional retrieval signal weighting (recency 0.35 + frequency 0.25 + semantic 0.25 + saliency 0.15 + procedural on demand), with time-based decay
- **Triple sleep consolidation**: Light Sleep (Jaccard dedup, zero LLM cost) → REM Sleep (confidence scoring) → Deep Sleep (three-condition promotion gate: score≥0.80 + merge≥3 + recall≥3), automatically hardening short-term experiences into long-term memory
- **Vector + BM25 hybrid search** (7:3): more robust than pure vector retrieval

But after three weeks of production, my conclusion is: **the more advanced the memory system, the deeper the pitfalls**. Here's a timeline of everything that actually broke.

## Pitfall 1: Startup Failure Trilogy

First time launching OpenClaw Gateway on a VPS, three consecutive errors, each with a different root cause.

**`gateway token missing`** — easiest to overlook. OpenClaw's Gateway mode requires a separate `OPENCLAW_GATEWAY_TOKEN` environment variable, not the Feishu App Secret. Miss one `Environment=` line in the systemd unit file and you get 401.

**`No credentials for provider`** — the `keyRef` in `auth-profiles.json` must match the environment variable name exactly. One character off and you get this error, with no indication of which keyRef failed to match. You have to eyeball it.

**`400 InvalidParameter` / model not found** — Omniroute model names must follow the `<provider>/<model>` format. Writing `gpt-5.5` returns 400; you must write `codex/gpt-5.5`. Add OpenClaw's own provider prefix, and it becomes `omniroute/codex/gpt-5.5`. Three layers of prefix nesting — miss one and nothing works.

```bash
# These three steps save the most time when debugging
systemctl cat openclaw-gateway.service | grep Environment  # check env vars
python3 -c "import json; json.load(open('/home/openclaw/.openclaw/openclaw.json'))"  # JSON syntax
journalctl -u openclaw-gateway.service -n 50 --no-pager | grep -iE "error|unauth"  # check errors
```

## Pitfall 2: Where Are the Logs

OpenClaw runtime logs go **entirely to journald**, not to files. `/tmp/openclaw/openclaw-*.log` only has a few lines from startup; all runtime errors live in journald. This cost me half an hour — tailing file logs and seeing nothing, before realizing:

```bash
# This is the correct way to view logs
journalctl -u openclaw-gateway.service -f
```

## Pitfall 3 (The Worst): Compaction Silently Swallows Replies

This was the most severe incident in three weeks. Before diving into the timeline, here's a flowchart of compaction's position in the Agent Loop and its failure path:

{{< mermaid >}}
flowchart TB
    MSG["👤 User message arrives"]
    LOOP["🔄 Agent Loop processing<br/>Assemble context → Reason → Generate reply"]
    CHECK{"📏 Context ≤ model limit?"}
    DELIVER["✅ Reply delivered to Feishu"]
    COMPACT["🧹 Auto-Compaction triggered<br/>Compress old messages into summary"]
    OVERFLOW{"⚠️ Compaction prompt also over limit?"}
    EMPTY["💀 Model outputs empty string<br/>Conversation is empty"]
    LOST["❌ Reply silently discarded<br/>User perception: bot unresponsive"]
    SAFEGUARD["🛡️ safeguard mode<br/>reserveTokens + fallback<br/>Compaction complete → normal delivery"]

    MSG --> LOOP --> CHECK
    CHECK -->|"✅ Under limit"| DELIVER
    CHECK -->|"❌ Overflow 209K > 200K"| COMPACT --> OVERFLOW
    OVERFLOW -->|"❌ No protection"| EMPTY --> LOST
    OVERFLOW -->|"🛡️ Fixed"| SAFEGUARD --> DELIVER

    style EMPTY fill:#ff6b6b,color:#fff
    style LOST fill:#ff6b6b,color:#fff
    style SAFEGUARD fill:#51cf66,color:#fff
    style DELIVER fill:#51cf66,color:#fff
{{< /mermaid >}}

A normal user message — the Agent generated a complete reply — but the **user received nothing**. The bot appeared dead silent.

### Timeline

- `01:43:40` User in Feishu news group: "失败请求占用到我们账户的请求资源的，麻烦方便的时候检修下程序中错误的请求参数"
- `01:43:57` Agent generated a full text reply (session trajectory shows `message` event with assistant response)
- `01:44:00` Auto-compaction triggered: session context had reached 209K tokens, exceeding the primary model's 200K limit
- `01:44:00` **Reply vanished**: compaction output an empty summary `"Conversation is empty"`, session ended, reply never delivered to Feishu
- User side: complete perception of "bot not responding"

### Root Cause

Compaction is an **implicit middleware layer**. Normally it compresses context; but when the context itself already exceeds the model limit (209K > 200K), and the compaction prompt can't hold the full context either, **the model outputs an empty string**. OpenClaw has no protection against this by default — no error, no degradation, no notification, just silently discarding the already-generated reply.

This is a textbook case of `middleware-semantic-leak`: the middleware layer, under extreme conditions, flipped from "compressing context" to "discarding replies" — a complete semantic inversion with zero signal.

Looking at the source code reveals the full silent-failure chain. OpenClaw's `compaction.ts` defines an innocuous-looking constant:

```typescript
// src/agents/compaction.ts
const DEFAULT_SUMMARY_FALLBACK = "No prior history.";
```

When `summarizeChunks()` receives an empty message list, it returns this string directly — no error thrown, no warning, no fallback path.

And here's the actual compaction prompt sent to the model — the system prompt has zero defensive instructions:

```text
// packages/agent-core/src/harness/compaction/compaction.ts
SUMMARIZATION_SYSTEM_PROMPT:
"You are a context summarization assistant. Your task is to read a conversation
between a user and an AI coding assistant, then produce a structured summary
following the exact format specified.

Do NOT continue the conversation. Do NOT respond to any questions in the
conversation. ONLY output the structured summary."
```

The user prompt template:

```text
// packages/agent-core/src/harness/compaction/compaction.ts
SUMMARIZATION_PROMPT:
"<conversation>
[The full conversation history is inserted here — at 209K tokens,
 that's tens of thousands of words of raw messages]
</conversation>

The messages above are a conversation to summarize. Create a structured context
checkpoint summary that another LLM will use to continue the work."
```

The critical design flaw lies in the `<conversation>` tags: **the instructions ("summarize the conversation") come AFTER the conversation history**. When the history exceeds the model's context window, the model doesn't see "a bunch of conversation" + "please summarize". It sees a truncated `<conversation>` opening, followed by nothing — no closing `</conversation>` tag, no summarization instructions. The system prompt only says "you're a summarization assistant, output only structured summaries" — it never tells the model what to do if the conversation content is truncated.

So the model faces: a truncated XML fragment + a system prompt that only says "output a summary". For most models' default behavior, this means an extremely short empty output — exactly the "Conversation is empty" seen in the trajectory.

Even more fatal is `summarizeWithFallback()`'s final fallback path: when full summarization and partial summarization both fail (chunk overflow, model 5xx, token overflow), it falls back to:

```typescript
// src/agents/compaction.ts — summarizeWithFallback final fallback
return (
  `Context contained ${messages.length} messages ` +
  `(${oversizedNotes.length} oversized). ` +
  `Summary unavailable due to size limits.`
);
```

That line is the source of the "Conversation is empty" you see in the session trajectory — **the compaction pipeline assumes "after summary failure, the original context is still usable"**, but the 209K > 200K edge case precisely breaks this assumption: the original context won't fit in the prompt, the summary model returns empty, and the only output is a natural language notification saying "summary unavailable" — which OpenClaw treats as a normal compaction result and continues execution, silently discarding the already-generated reply.

Two compounding constants are worth noting:

```typescript
// src/agents/compaction.ts
const SAFETY_MARGIN = 1.2;       // 20% buffer for estimateTokens inaccuracy
const SUMMARIZATION_OVERHEAD_TOKENS = 4096;  // prompt/system prompt overhead
```

`SAFETY_MARGIN` is a 20% buffer for token estimation — `estimateTokens()` uses `chars/4` heuristic, which systematically underestimates multi-byte characters, special tokens, and code tokens. This means "looks like 10K headroom" can actually already be hitting the wall. `SUMMARIZATION_OVERHEAD_TOKENS` is the fixed overhead for compaction prompt + system prompt + serialization wrappers — but it does NOT include the previous summary's size. **When the session has been refined through multiple rounds and the previous summary alone is tens of KB, this 4096 fixed reserve is insufficient**.

And the confirmation that this is default behavior, not a misconfiguration, lies in the type definition:

```typescript
// src/config/types.agent-defaults.ts
export type AgentCompactionConfig = {
  mode?: AgentCompactionMode;  // optional field — if unset, no safeguard
  reserveTokens?: number;
  keepRecentTokens?: number;
  // ...
};
```

`mode` is optional. Without explicitly configuring `"safeguard"`, neither `reserveTokens` nor `maxHistoryShare` protection is active. Production default behavior: compaction runs naked.

### Fix

Two steps, both required:

```json
// openclaw.json
"compaction": {
  "mode": "safeguard",
  "reserveTokens": 20000,
  "keepRecentTokens": 16000
},
"model": {
  "fallbacks": ["deepseek/deepseek-v4-flash"]
}
```

The `safeguard` mode reserves a token budget for the post-compaction summary, preventing it from filling the context window. And the fallback to `deepseek-v4-flash` (1M context window) ensures the compaction task itself never overflows, even if the primary model's window is full.

### General Lesson

This isn't OpenClaw-specific. Any agent system with automatic context compression faces the same risk: **compaction's failure mode is silent**. If your agent suddenly stops replying, the third thing to check is compaction — look in the session trajectory for compaction events with empty content.

## Feishu Message Non-Response: The Five-Layer Debugging Method

After this incident, I developed a debugging chain from outside-in, ordered by probability. Next time the bot doesn't respond, follow this:

| Layer | Checkpoint | How to check |
|---|---|---|
| L1 Feishu App Layer | Did the bot receive the message | `lark-cli im +chat-list --as bot` confirm group in allowlist |
| L2 Event Ingestion Layer | Did the message reach Gateway | Check dedup records for recent entries |
| **L3 Session Layer** | Did the Agent process the message | **Check the last event in session trajectory** — this is the most critical step |
| L4 Model Invocation Layer | Did the model respond normally | journalctl grep 429/401/500/timeout |
| L5 Delivery Layer | Did Feishu send succeed | Send a test message directly via CLI to verify permissions |

When facing non-response, follow this decision tree — check the last 10 lines of the trajectory first. Eighty percent of issues are resolved at step three:

{{< mermaid >}}
flowchart TD
    PROBLEM["❓ Feishu group bot not responding"]
    L1["L1: Group permissions<br/>lark-cli im +chat-list --as bot"]
    L1_OK{"Group in allowlist?<br/>Bot in group?"}
    L1_FIX["Fix permissions / add group to allowlist"]

    L2["L2: Message arrival<br/>Check dedup records"]
    L2_OK{"Dedup has recent entries?"}
    L2_FIX["Check Feishu event subscription URL<br/>OPENCLAW_GATEWAY_TOKEN"]

    L3["🔑 L3: Session Trajectory<br/>cat session/*.jsonl last 10 events"]
    L3_MSG{"What's the last event?"}
    L4["L4: Model invocation<br/>journalctl grep 429/500/timeout"]
    L5["L5: Delivery<br/>lark-cli im +send-message test"]

    L3_CTX["💀 compaction empty<br/>→ context overflow<br/>→ this incident, add safeguard immediately"]
    L3_MESSAGE["Reply was generated<br/>→ issue in delivery layer<br/>→ go to L5"]
    L3_ERROR["Has error event<br/>→ go to L4 check model"]

    PROBLEM --> L1
    L1 --> L1_OK
    L1_OK -->|"✓ OK"| L2
    L1_OK -->|"✗ Issue"| L1_FIX
    L2 --> L2_OK
    L2_OK -->|"✓ Has records"| L3
    L2_OK -->|"✗ No records"| L2_FIX
    L3 --> L3_MSG
    L3_MSG -->|"compaction empty"| L3_CTX
    L3_MSG -->|"assistant text"| L3_MESSAGE
    L3_MSG -->|"error"| L3_ERROR
    L3_ERROR --> L4
    L3_MESSAGE --> L5

    style L3 fill:#ffd43b,color:#333
    style L3_CTX fill:#ff6b6b,color:#fff
    style L3_MESSAGE fill:#51cf66,color:#fff
    style L3_ERROR fill:#ff922b,color:#fff
{{< /mermaid >}}

## Outer Loop: Why the Framework Matters More Than the Model

[SWE-bench Pro](https://www.swebench.com/), the most credible enterprise-grade coding benchmark (maintained by Princeton, independently audited), provides compelling evidence: **the exact same model, Claude Opus 4.5, scores anywhere from 45.9% to 55.4% depending on the harness** — SEAL standardized scaffold 45.9%, Cursor 50.2%, Auggie 51.8%, Claude Code 55.4%. Same model, different harness: a 9.5-percentage-point gap. Anthropic's November 2025 engineering blog *Effective harnesses for long-running agents* confirms the same pattern: splitting "doing" from "evaluating" across separate agents with hard pass/fail gates allowed a three-agent harness to run for 6 hours and produce a complete working application, where a single agent crashed after 20 minutes. OpenClaw doesn't appear on any mainstream benchmark leaderboard — not because of model capability, but because its harness quality isn't yet sufficient for benchmark-level reliability.

This isn't random. A converging industry insight in 2025: **"Structure around the model matters more than cleverness inside the model."** The model only does generation, and generation is cheap — what truly determines system quality are three things in the Outer Loop:

| Outer Loop Component | What it does | What happens when it fails |
|---|---|---|
| **Verification** | Compiler, test suite, linter check output | AI-generated wrong code goes undetected |
| **Context Engineering** | Compaction, pruning, memory flush | This article's incident — silent reply loss |
| **Tool Definitions (ACI)** | Tool schema, parameter constraints, guardrails | Wrong parameters, wrong file paths, silent retries |

These three layers are all **outside the model** — they're systems you deploy and maintain. The root cause of the compaction incident isn't that the model wasn't smart enough; it's that nobody told the harness "when compaction fails, don't discard the reply — raise an error."

This also explains why Anthropic observed that "the most successful agent implementations rarely use complex frameworks" — a framework is someone else's Outer Loop, and you can't control its failure modes. OpenClaw's multi-backend support looks like an advantage, but each model has a different context window, reasoning profile, and API behavior — **every additional model adds another combination of compaction boundary conditions**, making the Outer Loop test matrix grow exponentially.

This leads to a more fundamental structural question — the divergent paths in memory system design.

## OpenClaw vs Claude Code: Divergent Memory System Philosophy

OpenClaw's most distinctive memory mechanism is **background Dreaming consolidation** — not just "write it down", but a three-stage automated pipeline:

{{< mermaid >}}
flowchart LR
    subgraph Short["📝 Short-term Memory"]
        SESSION["Session conversations"]
        RECALL["recall traces"]
    end
    subgraph LIGHT["💡 Light Sleep — Zero LLM"]
        SORT["Jaccard semantic dedup + sorting"]
    end
    subgraph REM["🌙 REM Sleep — Pattern Discovery"]
        REFLECT["Pattern recognition + reflection<br/>Does NOT write MEMORY.md"]
    end
    subgraph DEEP["🧠 Deep Sleep — Three-condition promotion"]
        RANK["score ≥ 0.80"]
        MERGE["merge ≥ 3"]
        RECALL_THRESH["recall days ≥ 3"]
    end
    subgraph Long["📦 Long-term Memory"]
        MEM["MEMORY.md"]
    end

    Short --> LIGHT --> REM --> DEEP
    DEEP -->|"✓ All passed"| MEM
    DEEP -->|"✗ Not met"| LIGHT

    style DEEP fill:#b197fc,color:#fff
    style MEM fill:#51cf66,color:#fff
{{< /mermaid >}}

After running both systems for a while, here's a side-by-side comparison:

| Dimension | OpenClaw | Claude Code |
|---|---|---|
| Retrieval mechanism | Vector+BM25 hybrid (7:3) | LLM semantic judgment (Sonnet) |
| Weight evolution | **PPO adaptive** | Manual fixed classification |
| Consolidation | Triple sleep | Three-gate four-stage AutoDream |
| Model lock-in | Multi-model | Claude only |
| Memory classification | By time (long-term distill / short-term daily) | By type (user/feedback/project/reference) |
| Production maturity | Early stage | Validated by millions of agents |

OpenClaw's memory architecture is more "academically correct" — PPO adaptive weights, triple sleep, hybrid retrieval, each layer close to the frontier of memory systems research. Claude Code looks "cruder": memory is four categories of Markdown files (user/feedback/project/reference), retrieval relies on Sonnet's semantic judgment, no PPO, no BM25.

But here's a genuinely counterintuitive structural fact: **file-based memory > vector memory**. Not a quantitative "a bit better" — a qualitative difference. The industry, from Claude Code to Codex CLI to Cursor, has converged on Markdown files as the primary memory medium, with vectors as a secondary index. Why? Because in programming contexts, **determinism > probabilistic retrieval** — you can't let PPO weights decide "whether to remember that an API key leaked".

The bigger problem: **the sophistication of the memory system and the stability of the Outer Loop are multiplicative, not additive**. No matter how precise your memory retrieval algorithm is, if the compaction middleware quietly drops replies, the user doesn't perceive "memory isn't good enough" — they perceive "the bot is dead". OpenClaw invested 80% of its innovation budget on the memory side (PPO, Dreaming, hybrid retrieval), but underinvested in Outer Loop defense (compaction safeguard, failure signals, degradation paths). Claude Code is the reverse — conservative on memory, but its harness has been validated by millions of agent sessions.

This is the trap to watch for in tool selection: **benchmarks measure the ceiling of model+memory capability, but production systems live at the floor of the Outer Loop**.

## Compaction Design: Structural Differences Between the Prompts

We've seen from OpenClaw's source code why its compaction prompt silently fails on overflow — `<conversation>` tags come first, instructions come after, so the model never sees the instructions when context overflows. What does a better design look like?

In March 2026, Anthropic's npm `.map` file accidentally leaked Claude Code's complete system prompt. [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) extracted and organized all prompts from the compiled JS. Comparing the two compaction prompts, the gap isn't in the model — both use similar LLMs for summarization — but in **prompt-level structural defenses**:

**Summary format: 9 sections vs 5.** Claude Code requires 9 structured sections:

1. Primary Request and Intent — the user's core ask
2. Key Technical Concepts — technologies and frameworks
3. Files and Code Sections — file paths + full code snippets + why each matters
4. Errors and fixes — all errors + how fixed + user feedback on each
5. Problem Solving — solved and ongoing troubleshooting
6. **All user messages** — every user message (non-tool-result)
7. Pending Tasks — outstanding work
8. Current Work — precisely what's being worked on right now (with filenames + code)
9. Optional Next Step — the next action + **verbatim quotes from the conversation**

OpenClaw only has 5 (Decisions / TODOs / Constraints / Asks / Identifiers). The missing ones are exactly what's most fatal in a compaction incident: error fix history, complete preservation of user messages, precise description of current work.

**Security constraints preserved verbatim.** Claude Code's prompt explicitly states: *"Note any security-relevant instructions or constraints the user stated... These MUST be preserved verbatim in the summary so they continue to apply after compaction."* This means directives like "don't read .env files", "don't commit keys", "must use HTTPS not HTTP" remain in effect after compaction. OpenClaw only does identifier preservation (identifier policy), not security instruction preservation.

**User feedback doesn't get compressed away.** Section 6 requires listing ALL user messages, and Section 4 requires recording user feedback on each error. Together, the effect is: the user said "don't do it that way, do it this way" — this survives compaction. Compare to this article's incident: a user message triggers compaction → the generated reply is silently discarded → the user only sees bot not responding. If the compaction summary forced retention of "what the user said", at minimum you could immediately see the trigger source during debugging.

**Next step must quote verbatim.** Section 9 requires: *"Include direct quotes from the most recent conversation showing exactly what task you were working on and where you left off. This should be verbatim to ensure there's no drift in task interpretation."* This design prevents semantic drift where "the summary model rephrases the task in its own words" — a rephrased task can be understood completely differently by the next generation agent.

**Analysis before output.** Claude Code's prompt requires first analyzing each message inside `<analysis>` tags, then outputting `<summary>`. This isn't decorative — it embeds reasoning into quality control: if the analysis doesn't mention a particular error fix, the summary won't have it. OpenClaw's prompt has no such built-in completeness check.

**Circuit breaker.** Stops after 3 consecutive auto-compact failures. OpenClaw has no such mechanism — theoretically it could loop indefinitely: compact → fail → compact → fail.

**Partial compaction.** Claude Code supports compacting only the first half while keeping the latter half verbatim. A separate prompt tells the model: "this summary will be placed at the start of a continuing session; newer messages will follow" — the model knows its output is a prefix, and won't pretend to have full context.

**Post-compaction file reference tracking.** After compaction, Claude Code injects a system reminder: "Note: X file was read before the last conversation was summarized, but the contents are too large to include. Use the Read tool if you need to access it." This tells the model what it knew before and might need to re-read.

Here's the comparison in a table:

| Design Dimension | Claude Code | OpenClaw |
|---|---|---|
| Summary format | 9 sections, incl. error fixes + user messages | 5 sections |
| Security instruction retention | Verbatim preservation | Identifier preservation only |
| User feedback protection | ALL user messages + verbatim quotes | None |
| Pre-output analysis | `<analysis>` → `<summary>` two-step | Direct output |
| Circuit breaker | Stop after 3 consecutive failures | None |
| Prompt architecture | Instructions first, conversation after | Conversation first, instructions after |
| Failure signaling | Explicit error message | Silent fallback |
| Partial compaction | Separate prompt, "prefix mindset" | Not supported |
| File reference tracking | Post-compaction reminder to re-read | Post-compaction reads AGENTS.md |

There's a structural observation worth pausing on: **Claude Code's 9-section format isn't "smarter" — it's "harder to lose things"**. Every design decision — verbatim security constraints, listing all user messages, quoting next steps — defends against the same risk: compaction is a natural information loss node, and the prompt's sole job is to minimize that loss. OpenClaw invested noticeably less prompt engineering into compaction — not lacking model capability, but lacking defensive design around "what absolutely must not be lost."

This brings us back to the article's core thesis: **Outer Loop quality doesn't depend on how strong your model is — it depends on whether your prompt leaks under extreme conditions**. The `SAFETY_MARGIN = 1.2`, `SUMMARIZATION_OVERHEAD_TOKENS = 4096`, and `<conversation>`-before-instructions ordering in this incident — none of these are model problems. They're prompt problems that didn't account for overflow scenarios. Claude Code's prompt, even if it overflows, would at least leave error fix records, user messages, and verbatim quotes — the context needed for debugging wouldn't entirely evaporate.

## Conclusion: Three Judgments Deeper Than the Pitfalls

**1. Outer Loop is the new moat, not the model.** After 2025, model capabilities are rapidly converging — Gemini 2.5 Pro has 1M context, DeepSeek-V4 has 1M, GPT-5.5 has 200K. The gaps between models are narrowing, but the gaps in harness quality (compaction safeguard, verification loops, degradation paths, failure signals) are widening. The compaction incident in this article is evidence — it's not a "model not good enough" problem; it's the harness missing one line of config. Claude Code's ARR reaching ~$2B by January 2026 isn't because Claude is smarter than other models; it's because its Outer Loop has been validated by millions of agent sessions.

**2. Determinism beats probability — in memory, in routing, in failure handling.** OpenClaw's PPO adaptive weights and hybrid retrieval are correct on paper, but when compaction silently fails, users don't care about your retrieval recall improvement. At system boundaries (compaction, fallback, error handling), **rule-based deterministic rules are safer than RL-based probabilistic rules**. Claude Code chose "crude" classification not because it can't do PPO, but because manual rules are more predictable when it comes to "not losing things."

**3. The 2025-2026 industry trend is BYOK and harness open-sourcing.** A massive migration is happening from Cursor to Claude Code CLI, Aider, OpenCode — not because these tools have more features, but because BYOK (Bring Your Own Key) lets you **control the Outer Loop**. SaaS tools' compaction strategy, caching strategy, retry strategy are all black boxes — when something breaks, you can only wait for the vendor to fix it. With OpenClaw, every line of `openclaw.json` is visible, editable, and version-controllable. This is OpenClaw's real long-term value — not how advanced the memory system is, but that **the harness is fully transparent**.
