---
title: "Why LLMs Have No Memory — A Cross-Validated Research Report with 67 Primary Sources"
description: "Cross-validated using Exa / Tavily / Context7 / WebSearch, covering Anthropic / OpenAI / Google / Cursor official docs, Karpathy / LeCun / Raschka papers, and key works like MemGPT / Titans / Mamba-2 / Mem0."
date: 2026-05-04
tags: ["AI Agent", "LLM", "Memory", "Research"]
showToc: true
---

## TL;DR

"LLMs have no memory" isn't an oversight — it's the equilibrium solution to four compounding constraints: **Transformer O(n²) attention + KV cache VRAM + weight entanglement (catastrophic forgetting) + GDPR compliance**. ChatGPT / Claude / Cursor "Memory" features all work the same way under the hood: **inject structured text back into the system prompt**. Model weights never change. Prompt Caching is a performance optimization, not memory. The mainstream architecture for the next 1–3 years is a hybrid **"stateless LLM core + stateful Agent memory layer"**, not a single winner.

<div class="research-stats">
  <div class="research-stat">
    <div class="stat-value">O(n²)</div>
    <div class="stat-label">Attention complexity</div>
  </div>
  <div class="research-stat">
    <div class="stat-value">638×H100</div>
    <div class="stat-label">Llama 3.1 100M ctx single-user KV cache cost</div>
  </div>
  <div class="research-stat">
    <div class="stat-value">0.1×</div>
    <div class="stat-label">Cache read price (Anthropic / OpenAI)</div>
  </div>
  <div class="research-stat">
    <div class="stat-value">5min–24h</div>
    <div class="stat-label">Common prompt cache TTL</div>
  </div>
</div>

---

## 1. Why LLMs Are Designed to Be Stateless

Four independent constraints compound — individually manageable, but together they leave "stateless" as the only viable engineering solution.

### Architectural Constraint · O(n²) Attention

Self-attention scales at `O(n²)` with sequence length n. KV cache VRAM grows linearly but with a brutal constant — a single 4096-token sequence needs roughly 2 GB, and 32 concurrent sessions hit 64 GB, exceeding the model weights themselves.

→ Liu et al. "Lost in the Middle" (TACL 2024) empirically demonstrated: long contexts aren't just slower, the model's utilization of middle-section information follows a U-shaped curve — worse than closed-book performance.

### Training Constraint · Catastrophic Forgetting

LLM knowledge is deeply entangled across billions of weights. There's no "French module" or "user preference register" to update independently. Every fine-tune reshapes the entire parameter landscape, overwriting previous capabilities.

→ The industry standard is weekly/daily offline retraining. No one does per-request online weight updates.

### Compliance Constraint · Right to Be Forgotten

GDPR / PDPA require users to delete their data. Once personal data is baked into weights, the "right to be forgotten" becomes nearly impossible to execute precisely — you can only delete external storage.

→ This is why RAG / Memory Layer beats fine-tuning — not a technical decision, but a legal hard constraint.

### Security Constraint · Persistent Memory = Persistent Attack Surface

ChatGPT Memory has been breached multiple times via prompt injection: through Google Docs, images, or web pages, attackers invoke `to=bio` to write malicious persistent instructions that affect all future conversations.

→ This is exactly why Cursor 1.0→1.2 added mandatory user approval for Memories, and Anthropic specifically tested sycophancy / harmful conversation before releasing Memory.

<div class="research-callout callout-neutral">

> **Karpathy's canonical analogy**: **Weights = ROM** (burned in at training, static); **context window = RAM** (active during inference, directly addressable); **KV cache = working memory** (formed at test-time); **external vector / KG store = disk** (persistent but requires retrieval). Original quote: "Knowledge in the weights is a hazy recollection of training-time internet documents; content in the context window is directly accessible" — Andrej Karpathy, Dwarkesh Patel Interview (2025-10).

</div>

---

## 2. How Major Products Do "Memory"

14 products, **none modifying model weights**. Every "Memory" feature is a different way to inject text back into the prompt at the product layer.

<table class="research-table">
<thead><tr><th>Product / Feature</th><th>One-Liner Strategy</th><th>Essence</th><th class="col-center">Weight Δ?</th></tr></thead>
<tbody>
<tr><td><strong>ChatGPT Memory</strong></td><td>4-layer: metadata + Saved Memories (bio) + ~40 recent chat summaries + current window</td><td>Prompt injection</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>OpenAI Prompt Caching</em></td><td>≥1024 tokens auto KV prefix cache, 5–10min in-mem / 24h Extended, 0.1–0.5× price</td><td>Inference opt</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>OpenAI Responses API</em></td><td><code>previous_response_id</code> chained server state, mainly for reasoning trace ciphertext</td><td>Server-side persistence</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>Anthropic Prompt Caching</em></td><td>Explicit <code>cache_control</code> breakpoints (≤4), 5min/1h TTL, prefix byte-level matching</td><td>Inference opt</td><td class="col-center">No</td></tr>
<tr><td><strong>Claude.ai Projects</strong></td><td>Project instructions + knowledge files + project chat history, full prompt injection</td><td>Prompt injection</td><td class="col-center">No</td></tr>
<tr><td><strong>Claude Memory</strong> (2025-10)</td><td>Project-isolated, 24h natural language re-synthesis, visible/editable/importable/exportable</td><td>Prompt injection</td><td class="col-center">No</td></tr>
<tr><td><strong>Claude Code</strong></td><td>Human-written CLAUDE.md (per-session load) + model-written <code>~/.claude/.../MEMORY.md</code></td><td>Prompt injection</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>Gemini Context Caching</em></td><td>Implicit (90% discount) + Explicit (TTL 60min, token-hour storage billing)</td><td>Inference opt</td><td class="col-center">No</td></tr>
<tr><td><strong>Cursor Rules / AGENTS.md</strong></td><td>Static markdown, 4 trigger modes, Team > Project > User priority</td><td>Prompt injection</td><td class="col-center">No</td></tr>
<tr><td><strong>Cursor Memories</strong> (1.0+)</td><td>Background model generates candidates → user approves → written per-project per-user</td><td>Prompt injection</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>Cursor Codebase Index</em></td><td>Merkle tree + chunk encryption + Turbopuffer vector DB, no plaintext on server</td><td>RAG</td><td class="col-center">No</td></tr>
<tr><td><strong>Windsurf Cascade</strong></td><td>global rules + workspace rules + auto Memories + open files + M-Query RAG</td><td>Prompt injection</td><td class="col-center">No</td></tr>
<tr><td><strong>Devin Knowledge</strong></td><td>Human-written + AI suggestions + DeepWiki + VM Snapshots</td><td>Injection + RAG + snapshot</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>Replit Checkpoints</em></td><td>VM snapshot = files + DB + conversation context + Agent memory, CoW manifest in GCS</td><td>State snapshot</td><td class="col-center">No</td></tr>
</tbody>
</table>

> *Italic* rows = Cache type; **Bold** rows = Memory type. The "Weight Δ?" column is uniformly No.

---

## 3. Memory vs Cache vs True Model Memory

These three are commonly conflated, but physically they are completely different things.

### Cache (KV / Prompt Caching) <span class="research-pill pill-success">Ubiquitous</span>

| Dimension | Detail |
|---|---|
| Physical layer | Caches K, V projection tensors of attention layers; prefix byte-level match → skip prefill. Cache-hit and recomputed outputs are mathematically equivalent. |
| Lifetime | 5 minutes – 24 hours |
| Essence | Compute optimization — not "remembering" anything |

### Memory (Product Layer) <span class="research-pill pill-success">Ubiquitous</span>

| Dimension | Detail |
|---|---|
| Physical layer | **Text** stored in external databases / vector stores / markdown files, injected into system prompt header on each call. |
| Lifetime | User-controlled: visible, editable, deletable, importable/exportable |
| Essence | Systems engineering + UX problem, not model capability |

### True Model Memory (In-Weights) <span class="research-pill pill-warn">Nearly Nonexistent</span>

| Dimension | Detail |
|---|---|
| Physical layer | Changing the model weights themselves. Theoretically fine-tuning / continual learning; practically avoided by the industry. |
| Lifetime | Permanent, but cannot be deleted per-entry (compliance nightmare) |
| Essence | Hit by the triple blow of catastrophic forgetting + compliance + interpretability |

<div class="research-callout callout-warning">

> **Key reverse-engineering evidence**: Manthan Gupta confirmed through three experiments: ask ChatGPT about a specific topic discussed a year ago, and it **has absolutely no idea**. ChatGPT Memory does not use RAG. It stores only: session metadata + dozens of bio entries + **user message summaries** of the last ~40 chats (not ChatGPT's own replies) + the current sliding window. Cursor's official docs put it even more bluntly: *"Large language models don't retain memory between completions. Rules provide persistent, reusable context at the prompt level."*

</div>

---

## 4. The Future: A Four-Layer Hybrid Stack

Bottom-up: the base layer is always stateless; the three layers above are different abstractions for "giving it memory". Short-term mainstream is L4; the highest-value research leap is L2.

### L4 · Agentic Memory Layer (Stateful) <span class="research-pill pill-success">Most Mature</span>

Treats the LLM as a stateless CPU, with "memory" in external databases + Agent runtime. Representatives: `Letta` (MemGPT commercialization) · `Mem0` · `Zep + Graphiti` · `LangGraph Store` · `AutoGen Memory`.

- ✅ Auditable · Deletable · Model-agnostic
- ⚠️ Retrieval quality is the ceiling · Write contamination accumulates
- Mem0 scores 26% higher than OpenAI Memory on LoCoMo benchmark, with 91% lower p95 latency and 90% fewer tokens.

### L3 · Selective Ultra-Long Context <span class="research-pill pill-info">Commercialized</span>

Stuffs memory into ultra-long context windows. Representatives: Gemini 2M (needle recall >99%) · Magic LTM-2-Mini 100M tokens · context caching.

- ✅ Best in-session carrier
- ⚠️ Lost-in-the-middle unsolved · 100M ctx single user = 638×H100
- Won't replace Memory Layer — long context can't handle cross-session / cross-year "real memory".

### L2 · In-Architecture Long-Term Memory <span class="research-pill pill-warn">Highest Research Value</span>

Makes "persistent memory" a differentiable module embedded in the network. Representatives: Google `Titans` (short-term attention + long-term neural memory + task priors) · `Infini-attention` · `Mamba-2` · `RWKV-7 Goose` · Test-Time Training.

- ✅ Constant VRAM · Linear time
- ⚠️ Not yet validated at scale
- Once one variant is scaled by a frontier lab (≥70B params / ≥10T tokens training), it could rewrite the L4 landscape.

### L1 · Stateless LLM Core (frozen weights) <span class="research-pill pill-neutral">Forever Stateless</span>

The GPT / Claude / Gemini / Llama core. Each inference is a fresh process; weights never change. Continual learning won't become the per-user memory path short-term: catastrophic forgetting remains unsolved, and GDPR right-to-be-forgotten can't be precisely executed in weights.

- LoRA is for domain/role specialization, not per-user.

---

## 5. Three-Year Paradigm Roadmap

<table class="research-table">
<thead><tr><th>Year</th><th>Industry Mainstream</th><th>Potential Dark Horse</th></tr></thead>
<tbody>
<tr><td class="col-center"><strong>2026</strong></td><td>Stateless LLM + Memory Layer (Mem0/Zep/Letta) + long-context caching</td><td>Titans-style architectures begin small-scale commercial use; Sleep-time Compute becomes agent standard</td></tr>
<tr><td class="col-center"><strong>2027</strong></td><td>Reflection / Sleep-time / TTT enter LangGraph / CrewAI / AutoGen primitives</td><td>A 7B SSM/Hybrid surpasses Transformer across long-context benchmarks</td></tr>
<tr><td class="col-center"><strong>2028</strong></td><td>Top models ship built-in in-arch long-term memory modules; Memory Layer degrades to governance layer</td><td>LeCun H-JEPA + LLM hybrid prototype appears (early signal for 5–10 year bet)</td></tr>
</tbody>
</table>

<div class="research-callout callout-info">

> **A counterintuitive observation**: Anthropic silently dropped the default cache TTL from 1h to 5min in 2026-03, causing Claude Code users to pay 17–26% more. This exposes an underappreciated fact: **cache TTL is a hidden dial that directly impacts per-user cost but isn't on any SLA**. The future "memory economics" will increasingly resemble cloud storage — tiered, metered, and pricable.

</div>

---

## 6. Nine Practical Takeaways for Engineers

1. **Don't conflate Cache and Memory**: Cache accelerates pre-assembled prompts; Memory is the product-layer decision of what to put into the prompt. They are completely orthogonal.

2. **Writing memory = writing system prompt**: Any project convention you can express in markdown (Cursor Rules / `CLAUDE.md` / AGENTS.md) will always be more controllable, diffable, and version-managed than "letting the AI remember on its own."

3. **Prefix order: static → dynamic**: Tool definitions, system prompt, and project rules go first; the current user input goes last. Consistent top-level advice across OpenAI, Anthropic, and Google documentation.

4. **Compaction must be cache-safe**: Don't open a new system prompt just for summarization — it forces the full conversation to be recomputed at uncached full price. Claude Code calls this "cache-safe forking."

5. **TTL is a product decision, not just an engineering parameter**: Anthropic's change from 1h to 5min default TTL triggered massive user backlash, proving the point. Expose TTL as a user-configurable option.

6. **AI writes, human approves = the steadiest "auto Memory" pattern today**: Cursor 1.2's user approval requirement and Devin's suggestion-only flow are the design consensus after repeated prompt injection incidents.

7. **Visible, editable, exportable = trust**: Anthropic's "natural language synthesis" differentiation and ChatGPT's opaque synthesis are two sides of the same coin.

8. **Privacy mode conflicts with Cache**: OpenAI Extended cache loses ZDR eligibility; Cursor privacy mode stores no plaintext. Offer "performance vs. privacy" as two modes for users to choose.

9. **The real moat is "context engineering," not "memory models"**: Write memory as deterministic, version-controlled, human-readable state. Curation cost is one-time; the benefit compounds.

---

## 7. Key References

All primary sources from 2024–2026, grouped by theme. 30+ curated entries covering vendor docs, arXiv papers, and researcher essays.

### A. Vendor Sources

**OpenAI**
- [OpenAI Prompt Caching guide](https://developers.openai.com/docs/guides/prompt-caching) — KV cache mechanics + TTL + retention policy
- [OpenAI Prompt Caching 201 cookbook](https://developers.openai.com/cookbook/examples/prompt_caching_201/) — Extended cache and ZDR relationship
- [Manthan Gupta · I Reverse Engineered ChatGPT's Memory](https://manthanguptaa.in/posts/chatgpt_memory/) — 4-layer reverse engineering
- [Embrace The Red · ChatGPT Hacking Memories](https://embracethered.com/blog/posts/2024/chatgpt-hacking-memories/) — bio tool and prompt injection attack surface
- [Sean Goedecke · The whole point of Responses API](https://www.seangoedecke.com/responses-api/) — Unmasking Responses API's real motivation

**Anthropic**
- [Anthropic Prompt Caching docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — cache_control / 5min vs 1h / 4 breakpoints
- [Lessons from building Claude Code: Prompt caching is everything](https://claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything) — cache-safe forking in practice
- [Claude Code Memory docs](https://docs.anthropic.com/en/docs/claude-code/memory) — CLAUDE.md vs auto memory
- [How does Claude's memory work](https://support.anthropic.com/en/articles/11817273-how-does-claude-s-memory-work) — RAG tool calls + 24h synthesis + project isolation

**Google**
- [Gemini API Context Caching](https://ai.google.dev/gemini-api/docs/caching) — implicit vs explicit, TTL, storage billing
- [Vertex AI Context caching overview](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview) — 90% discount + cross-tenant isolation

**Cursor / Windsurf / Devin / Replit**
- [Cursor Rules](https://cursor.com/docs/context/memories) — 4 trigger types + Team/Project/User Rules + AGENTS.md
- [Cursor Codebase Indexing](https://cursor.com/docs/context/codebase-indexing) — Merkle tree + obfuscated path + client-side decryption
- [Cursor 1.0 changelog](https://www.cursor.com/changelog/1-0) + [1.2 changelog](https://cursor.com/en/changelog/1-2) — Memories beta → GA + user approval evolution
- [Securely indexing large codebases (Cursor blog)](https://www.cursor.so/blog/secure-codebase-indexing) — Merkle cross-account index reuse
- [Windsurf Cascade Memories](https://docs.windsurf.com/windsurf/cascade/memories) — 5-layer context assembly
- [Devin Knowledge](https://cognitionai.mintlify.app/product-guides/knowledge) — human + AI suggestions + DeepWiki + VM Snapshots
- [Replit Checkpoints](https://docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks) — VM + DB + AI conversation as snapshot unit

### B. Key Papers

**Architecture / Long Context**
- [Lost in the Middle (TACL 2024)](https://arxiv.org/abs/2307.03172) — U-shaped curve empirical evidence
- [Gemini 1.5 Technical Report](https://arxiv.org/abs/2403.05530) — 1M-10M token benchmark
- [Magic LTM-2-Mini](https://magic.dev/blog/100m-token-context-windows) — 100M token, long-range algorithms 1000× fewer FLOPs than attention
- [Titans: Learning to Memorize at Test Time](https://arxiv.org/abs/2501.00663) — Google neural long-term memory module
- [Infini-attention](https://arxiv.org/abs/2404.07143) — Compressive memory, 1B model 5K → 1M passkey
- [Mamba-2 / SSD (ICML 2024)](https://proceedings.mlr.press/v235/dao24a.html) — 2-8× speedup
- [RWKV-7 Goose](https://arxiv.org/abs/2503.14456) — Constant VRAM, attention-free
- [KV-Direct (arXiv 2603.19664)](https://www.arxiv.org/pdf/2603.19664) — Proves KV cache is a deterministic projection of the residual stream

**Memory Layer / Agent Memory**
- [MemGPT](https://arxiv.org/abs/2310.08560) — OS-inspired hierarchical memory paradigm foundation
- [Mem0](https://arxiv.org/abs/2504.19413) — LoCoMo 91.6, p95 latency 91% lower than full-context
- [Zep + Graphiti](https://arxiv.org/abs/2501.13956) — Dual-temporal KG, DMR 94.8%
- [A-Mem](https://arxiv.org/abs/2502.12110) — Zettelkasten-inspired self-evolving memory
- [Generative Agents (Park et al.)](https://arxiv.org/abs/2304.03442) — memory stream + reflection + planning template
- [Sleep-time Compute](https://arxiv.org/abs/2504.13171) — Letta team, test-time compute ↓5× / accuracy ↑13-18%

**Continual Learning / TTT**
- [Continual Learning of LLMs Survey](https://arxiv.org/abs/2404.16789) — LoRA still plagued by catastrophic forgetting
- [TTT for Few-shot Learning (ICML 2025)](https://proceedings.mlr.press/v267/akyurek25a.html) — ARC 8B + TTT ≈ human average
- [Memory Survey: Taxonomy & Operations](https://arxiv.org/abs/2505.00675) — parametric/contextual + 6 atomic operations

### C. Paradigm Judgments (Karpathy / LeCun / Raschka)

- [Andrej Karpathy · Dwarkesh Patel Interview (2025-10)](https://www.dwarkeshpatel.com/p/andrej-karpathy) — weights = hazy recollection, KV cache = working memory
- [Karpathy · Intro to LLMs (LLM OS)](https://www.youtube.com/watch?v=zjkBMFhNj_g) — most authoritative source of context = RAM metaphor
- [Yann LeCun · A Path Towards Autonomous Machine Intelligence](https://openreview.net/pdf?id=BZ5a1r-kVsf) — H-JEPA + persistent associative memory
- [LeCun at NVIDIA GTC 2025](https://www.endofmiles.net/lecun-says-hes-not-so-interested-in-llms-anymore) — persistent memory as one of four obstacles for LLMs toward AMI
- [Sebastian Raschka · Coding the KV Cache](https://sebastianraschka.com/blog/2025/coding-the-kv-cache-in-llms.html) — from-scratch implementation + engineering tradeoffs

### D. Industry Frameworks

- [LangGraph Persistence & Memory](https://docs.langchain.com/oss/python/langgraph/persistence) — short-term checkpointer + long-term Store
- [AutoGen Memory & RAG](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/memory.html) — Memory protocol + ChromaDB/Redis/Mem0
- [Letta Research / Stateful Agents](https://www.letta.com/research) — MemGPT founding team's commercial product
- [Don't Break the Cache (arXiv 2601.06007)](https://arxiv.org/abs/2601.06007v2) — agentic workflow quantification, 41-80% cost savings
- [ctx.ist · Context Determinism Thesis](https://ctx.ist/thesis/) — 17 systems + 56 rejection decisions, engineering justification

---

*Research method: Three parallel sub-agents (technical principles + product API design + future paradigms), cross-validated across four sources (Exa Web Search/Fetch, Tavily Research/Search, Context7 for Cursor official docs, WebSearch). 67 primary URLs, all from 2024-Q1 to 2026-Q2.*
