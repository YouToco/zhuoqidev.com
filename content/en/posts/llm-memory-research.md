---
title: "Why LLMs Have No Memory — A Cross-Validated Research Report with 67 Primary Sources"
description: "Cross-validated using Exa / Tavily / Context7 / WebSearch, covering Anthropic / OpenAI / Google / Cursor official docs, Karpathy / LeCun / Raschka papers, and key works like MemGPT / Titans / Mamba-2 / Mem0."
date: 2026-05-04
lastmod: 2026-07-09
tags: ["AI Agent", "LLM", "Memory", "Research", "Context Engineering"]
categories: ["Research"]
showToc: true
---

This is not pop-science AI writing. This is a cross-validated research sprint backed by **67+ primary sources** — vendor docs, arXiv papers, and researcher interviews — on a question every Agent builder hits: *why don't LLMs remember anything?*

## Why 67 Sources

Because every Agent builder runs into the same walls:

- Why does the AI forget user preferences after 10 turns?
- Why can't Prompt Caching replace Memory?
- Why does every product claim "memory" but none touches model weights?
- Mem0 vs Zep vs Letta vs LangGraph Store — which one?

The answers exist in Anthropic/OpenAI/Google docs, Karpathy interviews, and arXiv papers — scattered across 67 places. This report connects them.

---

## One-Liner

"LLMs have no memory" is not an oversight — it is the equilibrium solution under four stacked constraints: **Transformer O(n²) attention + KV cache VRAM + weight entanglement (catastrophic forgetting) + GDPR compliance**. The "Memory" features in ChatGPT / Claude / Cursor all work by **injecting structured text back into the system prompt** — model weights never change. Prompt Caching is a performance optimization, not memory. The mainstream paradigm for the next 1–3 years is the **"stateless LLM kernel + stateful Agent memory layer"** hybrid architecture.

| Compute Complexity | 100M ctx Cost | Cache Price | Mainstream TTL |
|---|---|---|---|
| **O(n²)** | **638×H100** | **0.1×** | **5min–24h** |

---

## 1. Why LLMs Are Designed to Be Stateless

Four independent constraints stacked together — each individually survivable, but combined they leave "stateless" as the only viable engineering solution. This conclusion is cross-validated across 67 primary sources.

### Architecture: O(n²) Attention

Self-attention scales at `O(n²)` with respect to sequence length n. KV cache VRAM grows linearly with n but with massive coefficients — a single 4096-token sequence needs ~2 GB VRAM; 32 concurrent sessions hit 64 GB, more than the model weights themselves. Llama 3.1 at 100M context requires 638 H100 GPUs (~$5,400/hour) for KV cache alone.

→ Liu et al. "Lost in the Middle" (TACL 2024): long contexts aren't just slower — middle-section utilization follows a U-shaped curve, worse than closed-book.

### Training: Catastrophic Forgetting

LLM knowledge is entangled across billions of weights. No isolated "French module" or "user preference register" exists for independent writes. Every fine-tune reshapes the entire parameter landscape, overwriting old capabilities. Even LoRA suffers from catastrophic forgetting in continual learning scenarios (arXiv 2404.16789).

→ Industry standard: offline retraining at weekly/daily cadence. No one does per-request online weight updates.

### Compliance: Right to Be Forgotten

GDPR Article 17 and PDPA require data controllers to delete personal data "without undue delay." Once personal data is baked into billions of weights, the right to be forgotten becomes nearly impossible to execute precisely — you cannot "subtract" a user's influence from the model. Both Anthropic and OpenAI explicitly state Memory data lives externally, not in weights. This is a legal hard constraint, not a technical preference.

→ RAG / Memory Layer beats fine-tuning because of compliance, not technical superiority.

### Security: Persistent Memory = Persistent Attack Surface

The attack surface of persistent memory extends far beyond prompt injection. Research from 2025–2026 reveals a complete threat hierarchy:

| Attack Type | Method | Typical Success Rate | Source |
|---|---|---|---|
| **Prompt Injection** | Attackers use Google Docs / images to invoke `to=bio` and write malicious instructions | — | Embrace The Red, 2024 |
| **Environmental Injection Poisoning (eTAMP)** | Merely browsing tampered product pages poisons agent memory, effective cross-site | GPT-5-mini 32.5% | arXiv 2604.02623 (preprint) |
| **Sleeper Memory Poisoning** | Manipulating external documents causes agent to store false memories, activatable across multiple subsequent conversations | Write rate 99.8%, trigger rate 60-89% | arXiv 2605.15338 (preprint) |
| **Self-Reinforcing Injection (Zombie)** | Accumulates ~240 payload copies in RAG memory, resistant to truncation and summarization | — | arXiv 2602.15654 (preprint) |

This is precisely why Cursor 1.0→1.2 added mandatory user approval for Memories, and why Anthropic specifically tested sycophancy / harmful conversation before releasing Memory.

MPBench (arXiv 2606.04329, preprint) identifies 9 structural vulnerability points: model layer (cannot distinguish trusted/untrusted sources), system prompt layer (bypassable via semantic imitation), architecture layer (no validation on write paths, no isolation for shared multi-source context). SMSR (arXiv 2606.12703, single-author preprint) proposes a claim worth monitoring but pending verification: **defenses that operate only at retrieval time, without write-time provenance, cannot provide effective security guarantees against adaptive attackers** — security must begin at write time.

{{< alert icon="circle-question" >}}

**Karpathy's canonical analogy**: **Weights = ROM** (static, burned in at training); **context window = RAM** (directly addressable during inference); **KV cache = working memory** (formed at test-time); **external vector / KG store = disk** (persistent, requires retrieval). "Knowledge in the weights is a hazy recollection of training-time internet documents; content in the context window is directly accessible" — Andrej Karpathy, Dwarkesh Patel Interview (2025-10).

{{< /alert >}}

---

## 2. Product Memory Strategies Compared (with Cache vs Memory Disambiguation)

14 mainstream products, **not a single one actually modifies model weights**. This section simultaneously disambiguates three commonly conflated concepts:

- **Cache** (KV / Prompt Caching): Caches K, V projection tensors from attention layers; prefix byte-level match → skip prefill. Lifetime: 5min–24h. Fundamentally a compute optimization, not "remembering" anything.
- **Memory** (Product Layer): Text stored in external databases / vector stores / markdown files, prepended to the system prompt on each call. User-controlled.
- **True Model Memory** (In-Weights): Changing model weights themselves. Hit by catastrophic forgetting + GDPR right-to-be-forgotten + interpretability. Industry-wide avoidance.

### 14-Product Comparison

| Product | Strategy | Type | Weight Δ? |
|---|---|---|---|
| **ChatGPT Memory** | 4-layer: metadata + bio + ~40 summaries + sliding window | Memory | No |
| _OpenAI Prompt Caching_ | ≥1024 tokens auto KV cache, 5min–24h TTL | Cache | No |
| _Anthropic Prompt Caching_ | Explicit `cache_control` ≤4 breakpoints, byte-level match | Cache | No |
| _Gemini Context Caching_ | Implicit 90% discount + Explicit 60min TTL | Cache | No |
| **Claude.ai Projects** | Project instructions + files + history, full prompt injection | Memory | No |
| **Claude Memory** (2025-10) | Project-isolated, 24h synthesis, visible/editable/exportable | Memory | No |
| **Claude Code** | CLAUDE.md + model-written MEMORY.md (200 lines) | Memory | No |
| **Cursor Rules / AGENTS.md** | Static markdown, 4 trigger modes, Team > Project > User | Memory | No |
| **Cursor Memories** (1.0+) | AI generates candidates → user approves → writes | Memory | No |
| _Cursor Codebase Index_ | Merkle tree + encryption + Turbopuffer vector DB | RAG | No |
| **Windsurf Cascade** | global + workspace rules + auto Memories + RAG | Memory | No |
| **Devin Knowledge** | Human-written + AI suggestions + DeepWiki + VM Snapshots | Memory+RAG | No |
| _Replit Checkpoints_ | VM snapshot = files + DB + chat + Agent memory | Snapshot | No |

> *Italic* = Cache/RAG/Snapshot; **Bold** = Memory. No product modifies weights.

{{< alert icon="bomb" >}}

**Key reverse-engineering evidence**: Manthan Gupta confirmed through three experiments: ask ChatGPT about a specific topic discussed a year ago, and it **has absolutely no idea**. ChatGPT Memory does not use RAG. It stores only: session metadata + dozens of bio entries + **user message summaries** of the last ~40 chats (not ChatGPT's own replies) + the current sliding window. Cursor's official docs are even more blunt: *"Large language models don't retain memory between completions. Rules provide persistent, reusable context at the prompt level."*

{{< /alert >}}

### Storage Selection: Vector DB vs Knowledge Graph vs Relational DB vs Files

Behind the "Type" column in the table above lies an architectural tradeoff in storage selection. Different storage backends determine the capability ceiling of a memory system:

| Storage | Strengths | Ceiling | Best For |
|---|---|---|---|
| **Vector DB** (Pinecone / Qdrant / Chroma) | Zero cold-start, sub-ms semantic retrieval, universal content types | No relational reasoning, no temporal model, top-k quality degrades beyond ~50K entries (Oxagen) | Early prototypes, personal assistants, memory count < 50K |
| **Knowledge Graph** (Neo4j / Graphiti-Zep) | Native multi-hop reasoning, entity disambiguation, temporal correctness (+18.5%, Zep paper) | High cold-start cost, large LLM extraction overhead | Entity-relationship-dense domains, audit trail required |
| **Relational DB** | Precise queries, transactional consistency, structured state | No semantic retrieval, no relational traversal | Precise transactional queries (config items, profiles) |
| **Markdown Files** | Human-readable, diffable, version-controllable | No entity resolution, no multi-hop reasoning, no temporal reasoning | Project rules, small-scale preferences (< hundreds of entries) |

**Production consensus is hybrid**: start with vector DB → add graph at bottleneck → scale with hybrid (vector + graph + relational, linked via normalized IDs). In Letta's "Is a Filesystem All You Need?" experiment, the plain agent file approach scored 74.0% (higher than Mem0-Graph at 68.5%), but once memory volume exceeds small scale, the domain grows complex, or entity relationships become necessary, the file approach hits its ceiling.

→ Oxagen — Memory Architectures for AI Agents · Atlan — Vector Database vs Knowledge Graph · arXiv 2501.13956 (Zep paper)

---

## 3. Future Paradigm: The Four-Layer Hybrid Stack

Bottom-up: the base layer is forever stateless; the three layers above are different abstractions for "giving it memory." L4 (Agent memory layer) is the short-term mainstream; L2 (in-architecture memory) is the highest-value research leap worth betting on.

### L4 · Agent Memory Layer

{{< badge >}}Most Commercially Mature{{< /badge >}}

Treats the LLM as a stateless CPU; "memory" lives in external databases + Agent runtime, with retrieval results concatenated back into the prompt on each inference. Representatives: `Letta` (MemGPT) · `Mem0` · `Zep + Graphiti` · `LangGraph Store` · `AutoGen Memory`.

- ✅ Auditable · Deletable · Model-agnostic
- ⚠️ Retrieval quality determines the ceiling · Write contamination accumulates
- Mem0 scores 26% above OpenAI Memory on LoCoMo; 91% lower p95 latency; 90% fewer tokens

#### Memory Type Taxonomy (CoALA Framework)

Agent memory is not a single bucket — the **CoALA paper** (Sumers, Yao, Narasimhan, Griffiths, 2023), grounded in Tulving's cognitive science taxonomy, divides Agent memory into four minimally complete types. A 2026 survey (arXiv 2602.06052) further extends this to five atomic cognitive memory systems.

| Type | Definition | Storage Strategy | Retrieval Strategy | Representative Implementation |
|---|---|---|---|---|
| **Working** | Temporary scratchpad for current task (reasoning traces, intermediate results); vanishes on context refresh | The prompt itself (in-context) | Implicit — model reads the prompt | LangGraph State, Letta core blocks |
| **Episodic** | Temporally indexed records of past events/interactions — "what happened" | Append-only, vector DB + temporal index | Recency × Importance × Relevance three-signal weighted | Letta recall memory, Generative Agents memory stream |
| **Semantic** | Factual knowledge distilled from experience, decoupled from specific events — "how the world is" | KV store / vector DB / knowledge graph, with distillation gate controlling writes | Key-based fast lookup or vector similarity | Mem0 facts, CLAUDE.md, Letta archival |
| **Procedural** | Reusable skills, action sequences, and execution strategies — "how to do something" | Independent index, key=task description embedding, value=successfully executed code/prompt | Retrieve top-K by description embedding when new task arrives | Voyager skill library, Claude Code Skills |

**The most common design mistake is serving four different needs with a single piece of infrastructure** — this is the root cause of "my agent forgot" complaints, even when the data technically still exists somewhere in the context.

**Procedural memory is the most under-implemented layer in production**. Most "memory" products only have episodic + semantic, lacking procedural. Voyager's skill library in Minecraft demonstrated the compounding effect of procedural memory: 3.3× more unique items unlocked, 15.3× faster milestone completion — procedural memory compounds, semantic memory does not.

→ CoALA (arXiv 2309.02427) · Generative Agents (arXiv 2304.03442, UIST 2023) · MemGPT (arXiv 2310.08560, ICLR 2024) · Voyager (arXiv 2305.16291) · Foundation Agent Memory Survey (arXiv 2602.06052, preprint)

#### Write Policies and Conflict Resolution

Memory is not just a "read" problem — **when to write and how to handle conflicts** are the engineering decisions most prone to pitfalls in Agent memory systems.

**5 orthogonal dimensions of write decisions** (Jatin Bansal): (a) whether to write (admission control gating) → (b) write form (raw episode vs distilled fact) → (c) which tier to write to → (d) write timing (synchronous / end-of-session / background async) → (e) how to handle conflicts. The core metaphor is **WAL + Checkpoint**: log-style writes preserve complete history, checkpoint-style writes produce merged snapshots — mature systems use both.

**Three conflict resolution approaches**:

| Approach | Representative | Mechanism | Best For |
|---|---|---|---|
| **ADD-only + retrieval ranking** | Mem0 v3 | Contradictory memories are all preserved; extraction captures transitions ("User changed from A to B"); conflicts are resolved at retrieval time via recency + relevance ranking | Small-scale / personal assistants |
| **Bi-temporal edge invalidation** | Zep / Graphiti | Each edge carries 4 timestamps (valid_at / invalid_at / created_at / expired_at); contradictions mark old edges as expired; supports point-in-time queries | Enterprise / complex interactions |
| **Memory evolution** | A-MEM (arXiv 2502.12110, preprint) | New memory triggers keywords/tags updates on neighboring old memories, simulating "new knowledge reshaping old understanding"; token cost only ~1.2K (vs MemGPT ~17K) | Self-organizing knowledge networks |

{{< alert icon="bomb" >}}

**Mem0 v2→v3 lesson**: v2 used "Latest Truth Wins" — LLM judges conflicts then executes UPDATE to overwrite old values. But in practice, **LLMs hallucinate during UPDATE**, substituting new values back to old ones (Mem0 PR #4903). v3 completely pivoted to ADD-only architecture; temporal reasoning improved +29.6% on LoCoMo.

{{< /alert >}}

→ Jatin Bansal — Memory Write Policies · Mem0 v2→v3 migration docs · Zep — Beyond Static Graphs · A-MEM (arXiv 2502.12110)

#### Memory Lifecycle Management

The ⚠️ "write contamination accumulates" warning in L4 cannot be solved with a single warning — production systems need a complete decay → compaction → GC pipeline.

**Decay**: Nearly all production systems converge on exponential decay `S(t) = S₀ × e^(-λt)`, with half-lives tiered by memory type — conversation context 7–14 days, factual knowledge 60–90 days, identity information 6–12 months. Each successful retrieval resets `last_read_at`, exempting frequently-used memories from decay (analogous to OS LRU policy).

**Compaction**: TypeGraph provides a three-step process — (1) HDBSCAN clustering detects fragmented memories → (2) LLM generates merged summaries (resolving contradictions, removing redundancy) → (3) original fragments are archived (not deleted, preserving audit capability), merged memory inserted. The "reflection" mechanism in Generative Agents is essentially episodic → semantic distillation-style compaction.

**Garbage Collection (GC)**: Decay threshold eviction (score < 0.01), TTL expiry, supersede chains (when new facts replace old facts, old memories are demoted to weight 0.1).

**Sleep-time Compute**: Moves the above processes from test-time to background execution. Lin et al. (arXiv 2504.13171) demonstrate that sleep-time can reduce the test-time computation needed to reach the same accuracy by approximately **5×**. Letta implements a primary + sleep-time dual-agent architecture — primary handles user interactions (read-only on shared memory), sleep-time agent performs consolidation / pre-compute / GC in the background (exclusive write access to shared memory), triggered every N steps. Claude Code's auto-dream triggers a four-stage consolidation cycle after 24h of activity + 5 new sessions.

→ Sleep-time Compute (arXiv 2504.13171) · Letta Sleep-time docs · TypeGraph — Agent Memory Decay & Consolidation

#### Retrieval Quality Engineering

"Retrieval quality determines the ceiling" — how exactly do you raise it? Nearly all production systems converge on a **three-signal weighted scoring formula**:

```
composite_score = w_semantic × similarity + w_recency × recency + w_importance × importance
```

Default weights vary by scenario — customer service agent: importance 0.4; research agent: relevance 0.6; personal assistant: recency 0.4. **Normalization is critical**: cosine similarity typically clusters in a narrow 0.5–0.8 band; without per-batch min-max normalization, the signal with the largest dynamic range drowns out the others.

**Four levers for improving retrieval quality**:

1. **Contextual Retrieval** (Anthropic 2024.9) — Prepend an LLM-generated 50-100 token contextual summary to each chunk before embedding; retrieval failure rate reduced by up to **49%**, reaching 67% when combined with reranking
2. **Hybrid Search** (Dense + Sparse) — Parallel embedding ANN + BM25 lexical search, merged via Reciprocal Rank Fusion
3. **Cross-encoder Reranking** — First ANN recall top-50 (fast but coarse), then precision-rank to top-10 (accurate but slow)
4. **Late Chunking** (Jina AI, arXiv 2409.04701) — Embed the full document first then split, so each chunk retains document-level context

→ Anthropic — Contextual Retrieval · ChangeGamer — RAG Retrieval for Agents · Jatin Bansal — Memory Retrieval Policies

### L3 · Ultra-Long Context

{{< badge >}}Commercialized{{< /badge >}}

Stuffs memory into ultra-long context windows. Representatives: Gemini 2M (needle recall >99%) · Magic LTM-2-Mini 100M tokens.

- ✅ Best in-session carrier
- ⚠️ Lost-in-the-middle still unsolved · 100M ctx single user = 638×H100

**L3 and L4 are complementary, not competitive**: ultra-long context handles within-session immediate associations; Agent memory layer handles cross-session / cross-year persistent memory. Combining both is the current engineering optimum.

### L2 · In-Architecture Memory

{{< badge >}}Highest Research Value{{< /badge >}}

Embeds "persistent memory" as a differentiable module in the network — potentially the real paradigm shift. Representatives: Google `Titans` (short-term attention + long-term neural memory) · `Infini-attention` · `Mamba-2` · `RWKV-7 Goose`.

- ✅ Constant VRAM · Linear time
- ⚠️ Not yet validated at scale (needs ≥70B params / ≥10T tokens to prove viability)

### L1 · Bare LLM (frozen weights)

{{< badge >}}Forever Stateless{{< /badge >}}

GPT / Claude / Gemini / Llama core. Each inference is a fresh process; weights unchanged. Continual learning won't become a per-user memory path short-term. LoRA is for domain/role specialization, not per-user.

### Multi-Agent Shared Memory

The four-layer stack above is entirely from a single-Agent perspective. When multiple Agents collaborate, **memory sharing** becomes a day-1 problem — consistency models, permission isolation, and memory ownership all require independent design.

**Current framework sharing mechanisms**:

| Framework | Sharing Mechanism | Consistency Model | Maturity |
|---|---|---|---|
| **LangGraph** | Shared State + Store (namespace-based) | Optimistic Concurrency (versioned checkpoints, retry on conflict) | High |
| **AutoGen** | GroupChat message broadcast + Context Variables | No explicit consistency (RFC #7748 proposes eventual consistency) | Low-Medium |
| **CrewAI** | Task output passing + Flows state | No native pub-sub | Low-Medium |
| **Mem0** | Framework-agnostic four-dimensional scoping (user_id / agent_id / run_id / app_id) | Eventual consistency | Medium |

**Frontier research (all 2026 preprints, not yet peer-reviewed)**:

- **StateFuse** (arXiv 2607.05844): CRDT-based conflict-preserving memory contract. Experiments show conflict-preserving surfaces produce 0% false-confident actions (vs 40% for collapsed surfaces)
- **MemClaw** (arXiv 2606.24535): Formalizes multi-Agent memory as a governed distributed-systems problem, identifying four failure modes — unauthorized leakage, stale propagation, contradiction persistence, provenance collapse

**Maturity assessment**: This field remains in early exploration. AutoGen's cross-Agent shared memory is still at RFC stage (GitHub #7748); StateFuse / MemClaw were just published. Mem0 calls this phase the birth of **"memory engineering"** — a new engineering discipline alongside prompt engineering and context engineering. Single-Agent memory is largely solved; multi-Agent sharing is the next hard problem.

→ Mem0 — Multi-Agent Memory Systems · LangGraph Stores docs · AutoGen RFC #7748

---

## 4. Memory Evaluation: Beyond LoCoMo

Mem0 scores 26% above OpenAI Memory on LoCoMo — but LoCoMo is just the tip of the iceberg. 2024–2026 has seen multiple evaluation benchmarks emerge, covering different dimensions:

| Benchmark | Scale | Focus Dimensions | Key Findings |
|---|---|---|---|
| **LoCoMo** (ACL 2024) | 10 conversations, ~9K tok | 5 QA types (single-hop / multi-hop / temporal / commonsense / adversarial) | Backboard 90.0% > human 87.9% |
| **LoCoMo-Refined** (2026) | 1,382 questions | Stricter LLM judge (agreement rate 86% vs original 44%) | All systems dropped 15-22 pp |
| **LoCoMo-Plus** (ACL 2026) | — | **Cognitive memory** (cue-trigger semantic disconnect) | All methods dropped dramatically; cognitive memory remains an open problem |
| **LongMemEval V1** (ICLR 2025) | 500 questions, 115K-1.5M tok | Information extraction / multi-session reasoning / temporal / abstention | Commercial systems only 30-70%; Zep 71.2% vs GPT-4o 60.2% |
| **LongMemEval V2** (2026) | 451 questions, 115M tok | Web Agent memory; introduces LAFS (Latency-Accuracy Frontier Score) | Best RAG 48.5%, AgentRunbook 74.9% |
| **MemBench** (ACL 2025 Findings) | 100K+ tok | Factuality + reflectivity, dual scenarios (participant / observer) | 4 metrics: accuracy / recall / capacity / latency |
| **MemoryAgentBench** (2025) | 2,071 questions, 103K-1.44M | Precise retrieval / test-time learning / long-range understanding / **selective forgetting** | Incremental multi-turn interaction (vs one-shot full context) |

**Evaluation dimension coverage matrix**: Factual recall (LoCoMo, LME) · Multi-hop reasoning (LoCoMo, LME) · Temporal reasoning (LoCoMo, LME) · Knowledge update (LME, MAB) · Abstention capability (LME, LoCoMo-Plus) · Cognitive memory (LoCoMo-Plus) · Capacity ceiling (MemBench) · Read/write latency (MemBench, LME-V2) · End-to-end task completion rate (LME-V2).

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

Extrapolate this logic and the future "memory economics" increasingly resemble cloud storage — **tiered** (5min/1h/24h/permanent), **pricable** (micro-adjusting TTL is reverse-pricing), and **lock-in** (migration cost skyrockets once agent workflows depend on specific cache strategies).

---

## 6. Three-Year Paradigm Roadmap

Based on Anthropic, Letta, Karpathy, LeCun sources. 2026 mainstream configuration has high confidence; 2027–2028 are inferential with explicit uncertainty.

| Year | Mainstream Configuration | Potential Dark Horse | Architect Action |
|---|---|---|---|
| **2026** | Bare LLM + Agent Memory Layer (Mem0/Zep/Letta) + long-context caching | Titans-style architectures begin small-scale commercial use; Sleep-time Compute becomes agent standard | Build pluggable memory layer on StorageAdapter pattern; build-in provenance metadata from day-1; store four memory types separately |
| **2027** | Reflection / Sleep-time / TTT enter mainstream Agent framework primitives | A 7B SSM/Hybrid surpasses Transformer on long-context benchmarks | Reserve sleep-time compute integration points; memory API supports batch consolidation |
| **2028** | Top models may integrate in-arch memory module (high-risk prediction); otherwise Memory Layer remains standard | LeCun H-JEPA + LLM hybrid prototype (early signal for 5–10 year bet) | Ensure remember / recall / forget interfaces can route to model-internal APIs |

**Pluggable architecture references**: PlugMem (arXiv 2603.03296, preprint) proposes using knowledge units (propositions and procedures) rather than raw text as the basic unit of memory, with swappable underlying storage. MemFactory (arXiv 2603.29493, preprint) designs a four-layer decoupled architecture (Module → Agent → Environment → Trainer), each independently replaceable. Core interface abstraction: `remember()` / `recall()` / `forget()` — three semantic operations. When L2 models natively support memory, route these calls to the model's internal API instead of external storage.

{{< alert icon="circle-info" >}}

**2028 caveat**: In-architecture memory (e.g., Titans) requires ≥70B params and ≥10T token training for validation — currently arXiv-only. The more likely 2028 scenario is coexistence of Agent memory layer and in-architecture memory, not the latter replacing the former.

{{< /alert >}}

---

## 7. Nine Practical Takeaways for Engineers

1. **Cache and Memory are conceptually orthogonal but tightly coupled in implementation**: Cache is a compute optimization (skip prefill); Memory is a product-layer decision about what to inject into the prompt — conceptually completely orthogonal. But in engineering they are tightly coupled: any change to memory content can cause prompt prefix mismatch → cache miss → full prefill → cost spike. This is exactly why Claude Code emphasizes "cache-safe forking."

2. **Writing memory = writing system prompt**: Any project convention expressible in markdown (Cursor Rules / `CLAUDE.md` / AGENTS.md) always beats "letting the AI remember" — more controllable, diffable, version-manageable. But markdown approaches hit their ceiling when memory volume exceeds hundreds of entries, or when entity relationships or temporal reasoning are needed — at that point, structured storage (vector DB / knowledge graph) must be introduced.

3. **Prefix order: static → dynamic**: Tool definitions, system prompt, project rules go first; current user input goes last. Consistent top-level advice from OpenAI, Anthropic, and Google docs.

4. **Compaction must be cache-safe**: Don't open a new system prompt for summarization — forces the full conversation to recompute at uncached full price. Claude Code calls this "cache-safe forking."

5. **TTL is a product decision, not just an engineering parameter**: The lesson from the Anthropic 1h→5min TTL incident. Expose TTL as a configurable option to users, or they will discover your hidden pricing in their bills.

6. **Autonomous Agents need automated write gating and conflict resolution**: For products with humans in the loop (Cursor, Devin), "AI writes + human approves" is the steadiest pattern. But for autonomous Agents, you need automated admission control (lightweight model for triage classification) + conflict resolution (ADD-only / bi-temporal / memory evolution). Core principle: **every write is a tax on all future reads** — better to store fewer high-quality facts than flood with low-value noise.

7. **Visible, editable, exportable = trust**: Anthropic's "natural language synthesis" differentiation vs ChatGPT's opaque synthesis — two sides proving the same point.

8. **Privacy mode conflicts with Cache**: OpenAI Extended cache loses ZDR eligibility; Cursor privacy mode stores no plaintext. Offer "performance vs. privacy" as two user-selectable modes.

9. **Context engineering is the moat — but it needs methodology**: Make memory deterministic, version-controlled, and human-readable state; curation cost is one-time, benefit is compounding. Specific methodology: **Explicit token budget allocation** (reserve 10% for output → 15% system prompt → 30% conversation history → 45% retrieved content, adjust by scenario) + **Four-strategy management** (Write to scratchpad / Select via composite scoring / Compress with threshold-triggered summarization / Isolate by splitting to sub-Agent independent windows).

→ Anthropic — Effective Context Engineering · Lance Martin — Agent Context Engineering Four Strategies

---

## 8. Key References

All primary sources from 2024–2026. 50+ curated entries covering vendor docs, arXiv papers, and researcher essays.

### A. Vendor Sources

**OpenAI**
- [OpenAI Prompt Caching guide](https://developers.openai.com/docs/guides/prompt-caching) — KV cache mechanics + TTL + retention policy
- [OpenAI Prompt Caching 201 cookbook](https://developers.openai.com/cookbook/examples/prompt_caching_201/) — Extended cache and ZDR relationship
- [Manthan Gupta · I Reverse Engineered ChatGPT's Memory](https://manthanguptaa.in/posts/chatgpt_memory/) — 4-layer structure reverse engineering
- [Embrace The Red · ChatGPT Hacking Memories](https://embracethered.com/blog/posts/2024/chatgpt-hacking-memories/) — bio tool and prompt injection attack surface

**Anthropic**
- [Anthropic Prompt Caching docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — cache_control / 5min vs 1h / 4 breakpoints
- [Lessons from building Claude Code](https://claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything) — cache-safe forking in practice
- [Claude Code Memory docs](https://docs.anthropic.com/en/docs/claude-code/memory) — CLAUDE.md vs auto memory
- [How does Claude's memory work](https://support.anthropic.com/en/articles/11817273-how-does-claude-s-memory-work) — RAG tool calls + 24h synthesis + project isolation
- [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — context engineering methodology

**Google**
- [Gemini API Context Caching](https://ai.google.dev/gemini-api/docs/caching) — implicit vs explicit, TTL, storage billing
- [Vertex AI Context caching overview](https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview) — 90% discount + cross-tenant isolation

**Cursor / Windsurf / Devin / Replit**
- [Cursor Rules](https://cursor.com/docs/context/memories) + [Codebase Indexing](https://cursor.com/docs/context/codebase-indexing) + [1.0 changelog](https://www.cursor.com/changelog/1-0) + [1.2 changelog](https://cursor.com/en/changelog/1-2)
- [Windsurf Cascade Memories](https://docs.windsurf.com/windsurf/cascade/memories) — 5-layer context assembly
- [Devin Knowledge](https://cognitionai.mintlify.app/product-guides/knowledge) — human-written + AI + DeepWiki + VM Snapshots
- [Replit Checkpoints](https://docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks) — VM + DB + AI chat snapshot

### B. Key Papers (Published / High Authority)

**Architecture / Long Context**
- [Lost in the Middle (TACL 2024)](https://arxiv.org/abs/2307.03172) — U-shaped curve empirical evidence
- [Gemini 1.5 Technical Report](https://arxiv.org/abs/2403.05530) — 1M-10M token benchmark
- [Magic LTM-2-Mini](https://magic.dev/blog/100m-token-context-windows) — 100M tokens, 1000× less FLOPs than attention
- [Titans: Learning to Memorize at Test Time](https://arxiv.org/abs/2501.00663) — Google neural memory module
- [Infini-attention](https://arxiv.org/abs/2404.07143) — Compressive memory, 1B model 5K → 1M passkey
- [Mamba-2 / SSD (ICML 2024)](https://proceedings.mlr.press/v235/dao24a.html) + [RWKV-7 Goose](https://arxiv.org/abs/2503.14456) + [KV-Direct](https://www.arxiv.org/pdf/2603.19664)

**Memory Layer / Agent Memory (High Authority)**
- [CoALA (arXiv 2309.02427)](https://arxiv.org/abs/2309.02427) — Agent memory four-type taxonomy, Griffiths h-index 99
- [Generative Agents (UIST 2023)](https://arxiv.org/abs/2304.03442) — Memory stream + reflection + three-signal retrieval
- [MemGPT (ICLR 2024)](https://arxiv.org/abs/2310.08560) — OS virtual memory tiered model
- [Voyager](https://arxiv.org/abs/2305.16291) — Procedural memory (skill library) benchmark
- [Mem0](https://arxiv.org/abs/2504.19413) · [Zep + Graphiti](https://arxiv.org/abs/2501.13956) — Commercial memory layers
- [Sleep-time Compute](https://arxiv.org/abs/2504.13171) — Stoica h-index 134, test-time reduction 5×

**Continual Learning**
- [Continual Learning of LLMs Survey](https://arxiv.org/abs/2404.16789) · [TTT (ICML 2025)](https://proceedings.mlr.press/v267/akyurek25a.html) · [Memory Survey](https://arxiv.org/abs/2505.00675)

**Evaluation Benchmarks**
- [LoCoMo (ACL 2024)](https://github.com/snap-research/locomo) — 5-type QA memory evaluation
- [LongMemEval (ICLR 2025)](https://github.com/xiaowu0162/LongMemEval) — 5 core capabilities + extensible history
- [MemBench (ACL 2025 Findings)](https://github.com/import-myself/Membench) — Factuality + reflectivity dual scenarios
- [MemoryAgentBench](https://arxiv.org/abs/2507.05257) — Incremental multi-turn interaction evaluation

### C. Preprints / Frontier Exploration (Not Peer-Reviewed)

The following papers are all 2026 preprints. Please note "not peer-reviewed" when citing.

- [A-MEM](https://arxiv.org/abs/2502.12110) — Zettelkasten-style memory evolution
- [Foundation Agent Memory Survey](https://arxiv.org/abs/2602.06052) — Five atomic cognitive memory types survey (60 authors)
- [MPBench](https://arxiv.org/abs/2606.04329) — Systematic study of 9 memory poisoning vulnerability points
- [eTAMP](https://arxiv.org/abs/2604.02623) — Environmental injection memory poisoning
- [Sleeper Memory](https://arxiv.org/abs/2605.15338) — Sleeper-style memory poisoning
- [Zombie Agents](https://arxiv.org/abs/2602.15654) — Self-reinforcing injection
- [SMSR](https://arxiv.org/abs/2606.12703) — Certified defense against memory poisoning (single author)
- [StateFuse](https://arxiv.org/abs/2607.05844) — CRDT conflict-preserving memory
- [MemClaw](https://arxiv.org/abs/2606.24535) — Governed shared memory
- [PlugMem](https://arxiv.org/abs/2603.03296) — Pluggable memory module
- [MemFactory](https://arxiv.org/abs/2603.29493) — Unified memory training-inference framework

### D. Paradigm Judgment (Karpathy / LeCun / Raschka)

- [Andrej Karpathy · Dwarkesh Patel Interview (2025-10)](https://www.dwarkeshpatel.com/p/andrej-karpathy)
- [Karpathy · Intro to LLMs](https://www.youtube.com/watch?v=zjkBMFhNj_g)
- [Yann LeCun · A Path Towards AMI](https://openreview.net/pdf?id=BZ5a1r-kVsf)
- [LeCun at NVIDIA GTC 2025](https://www.endofmiles.net/lecun-says-hes-not-so-interested-in-llms-anymore)
- [Sebastian Raschka · Coding the KV Cache](https://sebastianraschka.com/blog/2025/coding-the-kv-cache-in-llms.html)

### E. Industry Frameworks / Engineering Practice

- [LangGraph Persistence & Memory](https://docs.langchain.com/oss/python/langgraph/persistence)
- [AutoGen Memory & RAG](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/memory.html)
- [Letta Research](https://www.letta.com/research) + [Sleep-time docs](https://docs.letta.com/guides/agents/architectures/sleeptime/)
- [Don't Break the Cache (arXiv 2601.06007)](https://arxiv.org/abs/2601.06007v2)
- [ctx.ist · Context Determinism Thesis](https://ctx.ist/thesis/)
- [Jatin Bansal — Memory Write Policies](https://jatinbansal.com/ai-engineering/memory-write-policies/) + [Retrieval Policies](https://jatinbansal.com/ai-engineering/memory-retrieval-policies/)
- [Lance Martin — Agent Context Engineering](https://rlancemartin.github.io/2025/06/23/context_engineering/)
- [Oxagen — Memory Architectures for AI Agents](https://www.oxagen.ai/blog/memory-architectures-for-ai-agents)
- [Mem0 — Multi-Agent Memory Systems](https://mem0.ai/blog/multi-agent-memory-systems)
- [Microsoft — Agent Memory Safety Guide](https://learn.microsoft.com/en-us/security/zero-trust/sfi/manage-agentic-memory-safety)

---

*Research method: Three parallel sub-agents (technical principles + product API design + future paradigms), cross-validated across four sources (Exa, Tavily, Context7, WebSearch). 67+ primary URLs, 2024-Q1 to 2026-Q2. 2026-07 update: Added memory type taxonomy, write/conflict strategies, multi-Agent sharing, lifecycle management, retrieval quality engineering, storage selection, evaluation benchmark landscape, security threat model, and context engineering methodology, based on 6-way Exa deep research.*
