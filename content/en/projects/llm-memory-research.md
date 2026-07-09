---
title: "Why LLMs Have No Memory — A Cross-Validated Research Report with 67 Primary Sources"
description: "Cross-validated using Exa / Tavily / Context7 / WebSearch, covering Anthropic / OpenAI / Google / Cursor official docs, Karpathy / LeCun / Raschka papers, and key works like MemGPT / Titans / Mamba-2 / Mem0."
date: 2026-05-04
lastmod: 2026-07-09
tags: ["AI Agent", "LLM", "Memory", "Research"]
showToc: true
---

## TL;DR

"LLMs have no memory" is not an oversight — it is the equilibrium of **Transformer O(n²) attention + KV cache VRAM + weight entanglement (catastrophic forgetting) + GDPR compliance**. Every "Memory" feature in ChatGPT / Claude / Cursor is **structured text injected back into the system prompt** — weights never change. Prompt Caching is a performance optimization, not memory. The mainstream for the next 1–3 years is **stateless LLM kernel + stateful Agent memory layer**.

| Compute Complexity | 100M ctx Cost | Cache Price | Typical TTL |
|---|---|---|---|
| **O(n²)** | **638×H100** | **0.1×** | **5min–24h** |

---

## 1. Why LLMs Are Stateless

Four independent constraints — individually manageable, together they leave "stateless" as the only viable engineering solution. This conclusion is cross-validated across 67 primary sources.

### Architecture: O(n²) Attention

Self-attention scales at `O(n²)`. A single 4096-token sequence needs ~2 GB VRAM for KV cache; 32 concurrent sessions hit 64 GB — more than the model weights themselves. Llama 3.1 at 100M context requires 638 H100 GPUs (~$5,400/hour) for KV cache alone.

→ Liu et al. "Lost in the Middle" (TACL 2024): long contexts aren't just slower — middle-section recall follows a U-shaped curve, worse than closed-book.

### Training: Catastrophic Forgetting

LLM knowledge is entangled across billions of weights. No isolated "French module" or "user preference register" exists. Every fine-tune reshapes the entire parameter landscape. Even LoRA suffers from catastrophic forgetting in continual learning scenarios (arXiv 2404.16789).

→ Industry standard: offline retraining at weekly/daily cadence. No one does per-request weight updates.

### Compliance: Right to Be Forgotten

GDPR Article 17 and PDPA require data controllers to delete personal data "without undue delay." Once baked into billions of weights, the right to be forgotten becomes nearly impossible to execute — you can't "subtract" a user from the model. Both Anthropic and OpenAI explicitly state Memory data lives externally, not in weights. This is a legal constraint, not a technical preference.

→ RAG / Memory Layer beats fine-tuning because of compliance, not technical superiority.

### Security: Persistent Memory = Persistent Attack Surface

The attack surface of persistent memory goes far beyond prompt injection. 2025–2026 research reveals a full threat hierarchy:

| Attack Type | Method | Typical Success Rate | Source |
|---|---|---|---|
| **Prompt Injection** | Invoke `to=bio` via Google Docs / images to write malicious persistent instructions | — | Embrace The Red, 2024 |
| **Environment Injection (eTAMP)** | Poison agent memory merely by browsing a tampered product page; cross-site propagation | GPT-5-mini 32.5% | arXiv 2604.02623 (preprint) |
| **Sleeper Poisoning** | Manipulate external documents so agents store fabricated memories; activates across future sessions | Write rate 99.8%, trigger rate 60-89% | arXiv 2605.15338 (preprint) |
| **Self-Reinforcing Injection (Zombie)** | Accumulates ~240 payload copies in RAG memory; survives truncation and summarization | — | arXiv 2602.15654 (preprint) |

This is precisely why Cursor 1.0→1.2 added mandatory user approval, and why Anthropic tested sycophancy/harmful conversation before releasing Memory.

MPBench (arXiv 2606.04329, preprint) identifies 9 structural vulnerabilities: model layer (cannot distinguish trusted/untrusted sources), system prompt layer (bypassable via semantic mimicry), architecture layer (no write-path validation, no source isolation in shared context). SMSR (arXiv 2606.12703, single-author preprint) proposes a claim worth monitoring: **any retrieval-time-only defense without write-time provenance cannot provide meaningful security against adaptive attackers** — security must start at write time.

{{< alert icon="circle-question" >}}

**Karpathy's canonical analogy**: **Weights = ROM** (static, burned in at training); **context window = RAM** (directly addressable during inference); **KV cache = working memory** (formed at test-time); **external vector / KG store = disk** (persistent, requires retrieval). "Knowledge in the weights is a hazy recollection of training-time internet documents; content in the context window is directly accessible" — Andrej Karpathy, Dwarkesh Patel Interview (2025-10).

{{< /alert >}}

---

## 2. Product Landscape: Cache vs Memory vs True Memory

14 products, **zero weight modifications**. This section also disentangles three commonly conflated concepts:

- **Cache** (KV/Prompt Caching): Caches K,V projection tensors; prefix byte-level match → skip prefill. 5min–24h lifetime. Compute optimization, not "remembering."
- **Memory** (Product Layer): Text in external databases/vector stores/markdown, injected into system prompt on each call. User-controlled.
- **True Model Memory** (In-Weights): Changing weights themselves. Hit by catastrophic forgetting + GDPR + interpretability.

### Comparison Table

| Product | Strategy | Type | Weight Δ? |
|---|---|---|---|
| **ChatGPT Memory** | 4-layer: metadata + bio + ~40 summaries + window | Memory | No |
| _OpenAI Prompt Caching_ | ≥1024 tokens auto KV cache, 5min–24h TTL | Cache | No |
| _Anthropic Prompt Caching_ | Explicit `cache_control` ≤4 breakpoints, byte-level match | Cache | No |
| _Gemini Context Caching_ | Implicit 90% discount + Explicit 60min TTL | Cache | No |
| **Claude.ai Projects** | Instructions + files + history, full prompt injection | Memory | No |
| **Claude Memory** (2025-10) | Project-isolated, 24h synthesis, editable | Memory | No |
| **Claude Code** | CLAUDE.md + model-written MEMORY.md (200 lines) | Memory | No |
| **Cursor Rules / AGENTS.md** | Static markdown, 4 trigger modes, Team > Project > User | Memory | No |
| **Cursor Memories** (1.0+) | AI generates candidates → user approves → writes | Memory | No |
| _Cursor Codebase Index_ | Merkle tree + encryption + Turbopuffer vector DB | RAG | No |
| **Windsurf Cascade** | global + workspace rules + auto Memories + RAG | Memory | No |
| **Devin Knowledge** | Human-written + AI suggestions + DeepWiki + VM Snapshots | Memory+RAG | No |
| _Replit Checkpoints_ | VM snapshot = files + DB + chat + Agent memory | Snapshot | No |

> *Italic* = Cache/RAG/Snapshot; **Bold** = Memory. No product modifies weights.

{{< alert icon="bomb" >}}

**Key reverse-engineering evidence**: Manthan Gupta confirmed through three experiments: ask ChatGPT about a specific topic discussed a year ago, and it **has absolutely no idea**. ChatGPT Memory does not use RAG. It stores only: session metadata + dozens of bio entries + **user message summaries** of the last ~40 chats (not ChatGPT's own replies) + the current sliding window. Cursor's official docs put it even more bluntly: *"Large language models don't retain memory between completions. Rules provide persistent, reusable context at the prompt level."*

{{< /alert >}}

### Storage Selection: Vector DB vs Knowledge Graph vs RDBMS vs Files

Behind the "Type" column lies storage architecture trade-offs that determine the capability ceiling of any memory system:

| Storage | Strengths | Ceiling | Best For |
|---|---|---|---|
| **Vector DB** (Pinecone / Qdrant / Chroma) | Zero cold-start, sub-ms semantic search, universal content types | No relation model, no temporal model, top-k degrades after ~50K entries (Oxagen) | Prototypes, personal assistants, < 50K memories |
| **Knowledge Graph** (Neo4j / Graphiti-Zep) | Native multi-hop reasoning, entity disambiguation, temporal correctness (+18.5%, Zep paper) | High cold-start cost, expensive LLM extraction | Entity-heavy domains, audit trails needed |
| **RDBMS** | Exact queries, transactional consistency | No semantic search, no graph traversal | Config values, user profiles |
| **Markdown files** | Human-readable, diffable, version-controlled | No entity resolution, no multi-hop, no temporal reasoning | Project rules, small-scale preferences (< hundreds) |

**Production consensus is hybrid**: start with vector → add graph at bottleneck → go hybrid at scale. Letta's "Is a Filesystem All You Need?" experiment showed plain agent file-based approach scored 74.0% (above Mem0-Graph's 68.5%), but file approaches hit their ceiling once memory volume, entity relations, or temporal reasoning is needed.

→ Oxagen — Memory Architectures for AI Agents · Atlan — Vector Database vs Knowledge Graph · arXiv 2501.13956 (Zep paper)

---

## 3. The Four-Layer Future Stack

Bottom-up: base layer forever stateless. The three above are different abstractions for "giving it memory." L4 is the short-term mainstream; L2 is the highest-value research leap.

### L4 · Agent Memory Layer

{{< badge >}}Most Mature{{< /badge >}}

Treats the LLM as a stateless CPU; memory lives in external databases + Agent runtime. Representatives: `Letta` (MemGPT) · `Mem0` · `Zep + Graphiti` · `LangGraph Store` · `AutoGen Memory`.

- ✅ Auditable · Deletable · Model-agnostic
- ⚠️ Retrieval quality ceiling · Write contamination accumulates
- Mem0 scores 26% above OpenAI Memory on LoCoMo; 91% lower p95 latency; 90% fewer tokens

#### Memory Type Taxonomy (CoALA Framework)

Agent memory is not a single bucket — **CoALA** (Sumers, Yao, Narasimhan, Griffiths, 2023), drawing on Tulving's cognitive science classification, defines four minimally complete memory types. A 2026 survey (arXiv 2602.06052) further expands to five atomic cognitive memory systems.

| Type | Definition | Storage Strategy | Retrieval Strategy | Representative |
|---|---|---|---|---|
| **Working** | Temporary scratchpad for current task (reasoning traces, intermediate results); lost on context refresh | The prompt itself (in-context) | Implicit — model reads prompt | LangGraph State, Letta core blocks |
| **Episodic** | Time-indexed past events/interactions, "what happened" | Append-only, vector DB + temporal index | Recency × Importance × Relevance weighted scoring | Letta recall memory, Generative Agents memory stream |
| **Semantic** | Distilled factual knowledge decoupled from events, "how the world is" | KV store / vector DB / knowledge graph, with distillation gate | Key-based lookup or vector similarity | Mem0 facts, CLAUDE.md, Letta archival |
| **Procedural** | Reusable skills, action sequences, and strategies, "how to do things" | Separate index; key = task description embedding, value = successful code/prompt | Retrieve top-K by description embedding on new task arrival | Voyager skill library, Claude Code Skills |

**The most common design mistake is serving four different needs with one infrastructure** — this is the root cause of "my agent forgot" complaints, even when the data technically exists in context.

**Procedural memory is the most underserved layer in production**. Most "memory" products only have episodic + semantic, lacking procedural. Voyager's skill library in Minecraft proved the compounding effect: 3.3× more unique items unlocked, 15.3× faster milestones — procedural memory compounds; semantic memory does not.

→ CoALA (arXiv 2309.02427) · Generative Agents (arXiv 2304.03442, UIST 2023) · MemGPT (arXiv 2310.08560, ICLR 2024) · Voyager (arXiv 2305.16291) · Foundation Agent Memory Survey (arXiv 2602.06052, preprint)

#### Write Strategies & Conflict Resolution

Memory isn't just about reads — **when to write and how to handle conflicts** are the most error-prone engineering decisions in Agent memory systems.

**5 orthogonal dimensions of write decisions** (Jatin Bansal): (a) whether to write (admission control) → (b) write form (raw episode vs distilled fact) → (c) target tier → (d) timing (synchronous / session-end / background async) → (e) conflict handling. Core metaphor: **WAL + Checkpoint** — journaling preserves full history, checkpointing generates merged snapshots, mature systems use both.

**Three conflict resolution strategies**:

| Strategy | Representative | Mechanism | Best For |
|---|---|---|---|
| **ADD-only + retrieval ranking** | Mem0 v3 | Keep all contradictory memories; capture transitions at extraction ("User changed from A to B"); resolve at retrieval via recency + relevance | Small-scale / personal assistants |
| **Bi-temporal edge invalidation** | Zep / Graphiti | Each edge carries 4 timestamps (valid_at / invalid_at / created_at / expired_at); old edges marked expired on contradiction; supports point-in-time queries | Enterprise / complex interactions |
| **Memory evolution** | A-MEM (arXiv 2502.12110, preprint) | New memory triggers keyword/tag updates on neighboring old memories, simulating "new knowledge reshaping old understanding"; ~1.2K tokens (vs MemGPT ~17K) | Self-organizing knowledge networks |

{{< alert icon="bomb" >}}

**Mem0 v2→v3 lesson**: v2 used "Latest Truth Wins" — LLM would judge conflicts and execute UPDATE to overwrite old values. In practice, **LLMs hallucinate during UPDATE**, replacing new values back to old ones (Mem0 PR #4903). v3 switched entirely to ADD-only; temporal reasoning improved +29.6% on LoCoMo.

{{< /alert >}}

→ Jatin Bansal — Memory Write Policies · Mem0 v2→v3 Migration Docs · Zep — Beyond Static Graphs · A-MEM (arXiv 2502.12110)

#### Memory Lifecycle Management

The ⚠️ "write contamination accumulates" warning requires a complete decay → compaction → GC pipeline.

**Decay**: Most production systems converge on exponential decay `S(t) = S₀ × e^(-λt)`, with half-lives tiered by memory type — conversation context 7–14 days, factual knowledge 60–90 days, identity information 6–12 months. Each successful retrieval resets `last_read_at`, exempting frequently-used memories (analogous to OS LRU policy).

**Compaction**: TypeGraph's three-step flow — (1) HDBSCAN clustering detects fragment memories → (2) LLM generates merged summaries (resolves contradictions, removes redundancy) → (3) originals archived (not deleted, preserving audit capability), merged memory inserted. Generative Agents' "reflection" mechanism is essentially episodic → semantic distillation-style compaction.

**Garbage Collection**: Decay threshold eviction (score < 0.01), TTL expiration, supersede chains (new fact replaces old → old demoted to weight 0.1).

**Sleep-time Compute**: Moves all of the above from test-time to background execution. Lin et al. (arXiv 2504.13171) show sleep-time reduces test-time compute needed for equivalent accuracy by ~**5×**. Letta implements a primary + sleep-time dual-agent architecture — primary handles user interaction (read-only on shared memory), sleep-time agent runs background consolidation / pre-compute / GC (exclusive write on shared memory), triggered every N steps. Claude Code's auto-dream activates after 24h activity + 5 new sessions with a four-stage consolidation cycle.

→ Sleep-time Compute (arXiv 2504.13171) · Letta Sleep-time Docs · TypeGraph — Agent Memory Decay & Consolidation

#### Retrieval Quality Engineering

"Retrieval quality determines the ceiling" — but how to raise it concretely? Nearly all production systems converge on a **three-signal weighted scoring formula**:

```
composite_score = w_semantic × similarity + w_recency × recency + w_importance × importance
```

Default weights vary by scenario — customer service: importance 0.4; research agent: relevance 0.6; personal assistant: recency 0.4. **Normalization is critical**: cosine similarity clusters in the 0.5–0.8 band; without per-batch min-max normalization, the signal with the largest dynamic range drowns the others.

**Four levers to improve retrieval quality**:

1. **Contextual Retrieval** (Anthropic 2024.9) — prepend LLM-generated 50-100 token context to each chunk before embedding; retrieval failure rate drops up to **49%**, 67% with reranking
2. **Hybrid Search** (Dense + Sparse) — parallel embedding ANN + BM25 lexical search, merged via Reciprocal Rank Fusion
3. **Cross-encoder Reranking** — first recall top-50 via ANN (fast, coarse), then rerank to top-10 (accurate, slow)
4. **Late Chunking** (Jina AI, arXiv 2409.04701) — embed full document first then split, each chunk retains document-level context

→ Anthropic — Contextual Retrieval · ChangeGamer — RAG Retrieval for Agents · Jatin Bansal — Memory Retrieval Policies

### L3 · Ultra-Long Context

{{< badge >}}Commercialized{{< /badge >}}

Stuffs memory into ultra-long context windows. Representatives: Gemini 2M (>99% needle recall) · Magic LTM-2-Mini 100M tokens.

- ✅ Best in-session carrier
- ⚠️ Lost-in-the-middle unsolved · 100M ctx single user = 638×H100

**L3 and L4 are complementary, not competitive**: ultra-long context handles within-session associations; Agent memory layer handles cross-session / cross-year persistence. Combining both is the current engineering optimum.

### L2 · In-Architecture Memory

{{< badge >}}Highest Research Value{{< /badge >}}

Embeds "persistent memory" as a differentiable module in the network — potentially the real paradigm shift. Representatives: Google `Titans` · `Infini-attention` · `Mamba-2` · `RWKV-7 Goose`.

- ✅ Constant VRAM · Linear time
- ⚠️ Not yet validated at scale (needs ≥70B params / ≥10T tokens)

### L1 · Bare LLM (frozen weights)

{{< badge >}}Forever Stateless{{< /badge >}}

GPT / Claude / Gemini / Llama core. Each inference is a fresh process. Continual learning won't become a per-user memory path short-term. LoRA is for domain/role specialization, not per-user.

### Multi-Agent Shared Memory

The four-layer stack above is entirely single-agent. When multiple agents collaborate, **memory sharing** becomes a day-1 problem — consistency models, permission isolation, and memory ownership all require independent design.

**Current framework approaches**:

| Framework | Sharing Mechanism | Consistency Model | Maturity |
|---|---|---|---|
| **LangGraph** | Shared State + Store (namespace-based) | Optimistic Concurrency (versioned checkpoints, retry on conflict) | High |
| **AutoGen** | GroupChat broadcast + Context Variables | No explicit consistency (RFC #7748 proposes eventual consistency) | Low-Med |
| **CrewAI** | Task output passing + Flows state | No native pub-sub | Low-Med |
| **Mem0** | Framework-agnostic 4D scoping (user_id / agent_id / run_id / app_id) | Eventual consistency | Medium |

**Frontier research (all 2026 preprints, not yet peer-reviewed)**:

- **StateFuse** (arXiv 2607.05844): CRDT-based conflict-preserving memory contract. Experiments show conflict-preserving surfaces yield 0% false-confident actions (vs 40% for collapsed surfaces)
- **MemClaw** (arXiv 2606.24535): Formalizes multi-agent memory as a governed distributed-systems problem; identifies four failure modes — unauthorized leakage, stale propagation, contradiction persistence, provenance collapse

**Maturity assessment**: This space remains in early exploration. AutoGen's cross-agent shared memory is still at RFC stage (GitHub #7748); StateFuse / MemClaw just published. Mem0 calls this the birth of **"memory engineering"** — a discipline parallel to prompt engineering and context engineering. Single-agent memory is largely solved; multi-agent sharing is the next hard problem.

→ Mem0 — Multi-Agent Memory Systems · LangGraph Stores Docs · AutoGen RFC #7748

---

## 4. Memory Evaluation: Beyond LoCoMo

Mem0 scores 26% above OpenAI Memory on LoCoMo — but LoCoMo is just the tip of the iceberg. 2024–2026 saw a proliferation of evaluation benchmarks covering different dimensions:

| Benchmark | Scale | Focus | Key Finding |
|---|---|---|---|
| **LoCoMo** (ACL 2024) | 10 conversations, ~9K tok | 5 QA types (single-hop / multi-hop / temporal / commonsense / adversarial) | Backboard 90.0% > human ceiling 87.9% |
| **LoCoMo-Refined** (2026) | 1,382 questions | Stricter LLM judge (86% agreement vs original 44%) | All systems drop 15-22 pp |
| **LoCoMo-Plus** (ACL 2026) | — | **Cognitive memory** (cue-trigger semantic disconnect) | All methods drop significantly; cognitive memory remains open |
| **LongMemEval V1** (ICLR 2025) | 500 questions, 115K-1.5M tok | Extraction / multi-session reasoning / temporal / abstention | Commercial systems only 30-70%; Zep 71.2% vs GPT-4o 60.2% |
| **LongMemEval V2** (2026) | 451 questions, 115M tok | Web Agent memory, introduces LAFS (Latency-Accuracy Frontier Score) | Best RAG 48.5%, AgentRunbook 74.9% |
| **MemBench** (ACL 2025 Findings) | 100K+ tok | Factual + reflective, dual-scenario (participatory / observational) | 4D metrics: accuracy / recall / capacity / latency |
| **MemoryAgentBench** (2025) | 2,071 questions, 103K-1.44M | Exact retrieval / test-time learning / long-range understanding / **selective forgetting** | Incremental multi-turn (vs one-shot full context) |

→ LoCoMo (github.com/snap-research/locomo) · LongMemEval (github.com/xiaowu0162/LongMemEval) · MemBench (github.com/import-myself/Membench) · MemoryAgentBench (arXiv 2507.05257)

---

## 5. Memory Economics: Why Cache TTL Is a Hidden Pricing Dial

This is the most underappreciated thread in the entire landscape.

In 2026-03, Anthropic **silently dropped cache TTL from 1h to 5min**, causing Claude Code users to pay 17–26% more. No announcement. No SLA commitment. This exposed a brutal truth: **cache TTL directly impacts per-user cost but appears on zero SLAs**.

| Metric | Value |
|---|---|
| Cost increase after Anthropic TTL change | **17–26%** |
| Cache cost transparency | **0% (fully hidden)** |
| 100M ctx hardware cost (single user) | **~$5.4k/hr** |
| SLA commitments on cache TTL | **0** |

Extrapolate this logic and the future "memory economics" increasingly resemble cloud storage — **tiered** (5min/1h/24h/permanent), **pricable** (micro-adjusting TTL is reverse-pricing by traffic), and **lock-in** (migration cost once agent workflows depend on specific cache strategies).

---

## 6. Three-Year Paradigm Roadmap

Based on Anthropic, Letta, Karpathy, LeCun sources. 2026 has high confidence; 2027–2028 are inferential with explicit uncertainty.

| Year | Mainstream | Potential Dark Horse | What Architects Should Do |
|---|---|---|---|
| **2026** | Bare LLM + Agent Memory (Mem0/Zep/Letta) + long-context caching | Titans-style architectures begin small-scale commercial use; Sleep-time Compute becomes agent standard | Build pluggable memory layer with StorageAdapter pattern; bake in provenance metadata from day-1; separate storage for all four memory types |
| **2027** | Reflection / Sleep-time / TTT enter mainstream Agent framework primitives | A 7B SSM/Hybrid surpasses Transformer on long-context benchmarks | Reserve sleep-time compute integration points; memory API supports batch consolidation |
| **2028** | Top models may integrate in-arch memory (high-risk prediction); otherwise Memory Layer remains standard | LeCun H-JEPA + LLM hybrid prototype (early signal for 5–10 year bet) | Ensure remember / recall / forget interfaces can route to model-internal APIs |

**Pluggable architecture references**: PlugMem (arXiv 2603.03296, preprint) proposes knowledge units (propositions and procedures) rather than raw text as the fundamental memory unit, with swappable storage backends. MemFactory (arXiv 2603.29493, preprint) designs a four-layer decoupled architecture (Module → Agent → Environment → Trainer), each independently replaceable. Core interface abstraction: `remember()` / `recall()` / `forget()` — when L2 models natively support memory, route calls to model internals instead of external storage.

{{< alert icon="circle-info" >}}

**2028 caveat**: In-architecture memory requires ≥70B params and ≥10T token training for validation — currently arXiv-only. The more likely 2028 scenario is coexistence, not replacement.

{{< /alert >}}

---

## 7. Nine Practical Takeaways

1. **Cache and Memory: conceptually orthogonal, practically coupled**: Cache skips prefill; Memory decides what goes into the prompt — conceptually orthogonal. But in practice they're tightly coupled: any memory content change can cause prompt prefix mismatch → cache miss → full prefill → cost spike. This is why Claude Code emphasizes "cache-safe forking."

2. **Writing memory = writing system prompt**: Any convention expressible in markdown (Cursor Rules / `CLAUDE.md` / AGENTS.md) beats "letting the AI remember" — diffable, version-controlled, deterministic. But markdown hits its ceiling when memory volume exceeds hundreds of entries or entity relations / temporal reasoning are needed — then structured storage (vector DB / knowledge graph) is required.

3. **Prefix order: static → dynamic**: Tool definitions, system prompt, project rules first; user input last. Top-level advice from OpenAI, Anthropic, and Google docs.

4. **Compaction must be cache-safe**: Don't open a new system prompt for summarization — forces full uncached recomputation. Claude Code calls this "cache-safe forking."

5. **TTL is a product decision**: The Anthropic 1h→5min incident proves it. Expose TTL as user-configurable, or users will find your hidden pricing in their bills.

6. **Autonomous agents need automated write gating and conflict resolution**: For human-in-the-loop products (Cursor, Devin), "AI writes + human approves" is the steadiest pattern. For autonomous agents, you need automated admission control (lightweight model for triage) + conflict resolution (ADD-only / bi-temporal / memory evolution). Core principle: **every write is a tax on all future reads** — store fewer high-quality facts, not more low-value noise.

7. **Visible, editable, exportable = trust**: Anthropic's natural language synthesis vs ChatGPT's opaque synthesis — two sides of the same coin.

8. **Privacy mode conflicts with Cache**: OpenAI Extended cache loses ZDR; Cursor privacy mode stores no plaintext. Offer "performance vs. privacy" as two modes.

9. **Context engineering is the moat — but it needs methodology**: Deterministic, version-controlled, human-readable state. Curation cost is one-time; benefit compounds. Concrete methodology: **Explicit token budget allocation** (output reserve 10% → system prompt 15% → conversation history 30% → retrieved content 45%, adjusted by scenario) + **four-strategy management** (Write to scratchpad / Select via composite scoring / Compress at threshold / Isolate into sub-agent windows).

→ Anthropic — Effective Context Engineering · Lance Martin — Agent Context Engineering

---

## 8. Key References

All primary sources from 2024–2026. 50+ curated entries covering vendor docs, arXiv papers, and researcher essays.

### A. Vendor Sources

**OpenAI**: [Prompt Caching guide](https://developers.openai.com/docs/guides/prompt-caching) · [Caching 201 cookbook](https://developers.openai.com/cookbook/examples/prompt_caching_201/) · [Manthan Gupta · Reverse Engineered ChatGPT Memory](https://manthanguptaa.in/posts/chatgpt_memory/) · [Embrace The Red · Hacking Memories](https://embracethered.com/blog/posts/2024/chatgpt-hacking-memories/)

**Anthropic**: [Prompt Caching docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) · [Lessons from Claude Code](https://claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything) · [Claude Code Memory](https://docs.anthropic.com/en/docs/claude-code/memory) · [How Claude's memory works](https://support.anthropic.com/en/articles/11817273-how-does-claude-s-memory-work) · [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

**Google**: [Gemini Context Caching](https://ai.google.dev/gemini-api/docs/caching) · [Vertex AI caching overview](https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview)

**Cursor / Windsurf / Devin / Replit**: [Cursor Rules](https://cursor.com/docs/context/memories) · [Codebase Indexing](https://cursor.com/docs/context/codebase-indexing) · [Cursor 1.0](https://www.cursor.com/changelog/1-0) + [1.2](https://cursor.com/en/changelog/1-2) changelogs · [Windsurf Memories](https://docs.windsurf.com/windsurf/cascade/memories) · [Devin Knowledge](https://cognitionai.mintlify.app/product-guides/knowledge) · [Replit Checkpoints](https://docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks)

### B. Key Papers (Published / High Authority)

**Architecture**: [Lost in the Middle (TACL 2024)](https://arxiv.org/abs/2307.03172) · [Gemini 1.5](https://arxiv.org/abs/2403.05530) · [Magic LTM-2-Mini](https://magic.dev/blog/100m-token-context-windows) · [Titans](https://arxiv.org/abs/2501.00663) · [Infini-attention](https://arxiv.org/abs/2404.07143) · [Mamba-2 (ICML 2024)](https://proceedings.mlr.press/v235/dao24a.html) · [RWKV-7](https://arxiv.org/abs/2503.14456) · [KV-Direct](https://www.arxiv.org/pdf/2603.19664)

**Memory Layer (High Authority)**: [CoALA (arXiv 2309.02427)](https://arxiv.org/abs/2309.02427) · [Generative Agents (UIST 2023)](https://arxiv.org/abs/2304.03442) · [MemGPT (ICLR 2024)](https://arxiv.org/abs/2310.08560) · [Voyager](https://arxiv.org/abs/2305.16291) · [Mem0](https://arxiv.org/abs/2504.19413) · [Zep + Graphiti](https://arxiv.org/abs/2501.13956) · [Sleep-time Compute](https://arxiv.org/abs/2504.13171)

**Continual Learning**: [CL Survey](https://arxiv.org/abs/2404.16789) · [TTT (ICML 2025)](https://proceedings.mlr.press/v267/akyurek25a.html) · [Memory Taxonomy](https://arxiv.org/abs/2505.00675)

**Evaluation Benchmarks**: [LoCoMo (ACL 2024)](https://github.com/snap-research/locomo) · [LongMemEval (ICLR 2025)](https://github.com/xiaowu0162/LongMemEval) · [MemBench (ACL 2025 Findings)](https://github.com/import-myself/Membench) · [MemoryAgentBench](https://arxiv.org/abs/2507.05257)

### C. Preprints / Frontier (Not Peer-Reviewed)

All papers below are 2026 preprints. Cite with "preprint, not peer-reviewed" caveat.

[A-MEM](https://arxiv.org/abs/2502.12110) · [Foundation Agent Memory Survey](https://arxiv.org/abs/2602.06052) · [MPBench](https://arxiv.org/abs/2606.04329) · [eTAMP](https://arxiv.org/abs/2604.02623) · [Sleeper Memory](https://arxiv.org/abs/2605.15338) · [Zombie Agents](https://arxiv.org/abs/2602.15654) · [SMSR](https://arxiv.org/abs/2606.12703) · [StateFuse](https://arxiv.org/abs/2607.05844) · [MemClaw](https://arxiv.org/abs/2606.24535) · [PlugMem](https://arxiv.org/abs/2603.03296) · [MemFactory](https://arxiv.org/abs/2603.29493)

### D. Researchers (Karpathy / LeCun / Raschka)

- [Karpathy · Dwarkesh Patel Interview (2025-10)](https://www.dwarkeshpatel.com/p/andrej-karpathy) · [Intro to LLMs](https://www.youtube.com/watch?v=zjkBMFhNj_g)
- [LeCun · Path Towards AMI](https://openreview.net/pdf?id=BZ5a1r-kVsf) · [NVIDIA GTC 2025](https://www.endofmiles.net/lecun-says-hes-not-so-interested-in-llms-anymore)
- [Raschka · Coding the KV Cache](https://sebastianraschka.com/blog/2025/coding-the-kv-cache-in-llms.html)

### E. Frameworks / Engineering Practice

- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence) · [AutoGen Memory](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/memory.html) · [Letta Research](https://www.letta.com/research) + [Sleep-time Docs](https://docs.letta.com/guides/agents/architectures/sleeptime/)
- [Don't Break the Cache](https://arxiv.org/abs/2601.06007v2) · [ctx.ist](https://ctx.ist/thesis/)
- [Jatin Bansal — Write Policies](https://jatinbansal.com/ai-engineering/memory-write-policies/) + [Retrieval Policies](https://jatinbansal.com/ai-engineering/memory-retrieval-policies/)
- [Lance Martin — Agent Context Engineering](https://rlancemartin.github.io/2025/06/23/context_engineering/)
- [Oxagen — Memory Architectures](https://www.oxagen.ai/blog/memory-architectures-for-ai-agents) · [Mem0 — Multi-Agent Memory](https://mem0.ai/blog/multi-agent-memory-systems) · [Microsoft — Agent Memory Safety](https://learn.microsoft.com/en-us/security/zero-trust/sfi/manage-agentic-memory-safety)

---

*Research method: Three parallel sub-agents (technical principles + product API design + future paradigms), cross-validated across four sources (Exa, Tavily, Context7, WebSearch). 67+ primary URLs, 2024-Q1 to 2026-Q2. July 2026 update: added memory type taxonomy, write/conflict strategies, multi-agent sharing, lifecycle management, retrieval quality engineering, storage selection, evaluation benchmark panorama, security threat model, and context engineering methodology, based on 6-way Exa deep research.*
