---
title: "Why LLMs Have No Memory — A Cross-Validated Research Report with 67 Primary Sources"
description: "Cross-validated across four search engines, covering Anthropic / OpenAI / Google / Cursor official docs, Karpathy / LeCun / Raschka papers, and key works like MemGPT / Titans / Mamba-2 / Mem0."
date: 2026-05-04
tags: ["AI Agent", "LLM", "Memory", "Research"]
showToc: true
---

## TL;DR

"LLMs have no memory" isn't an oversight — it's the equilibrium of four compounding constraints: **O(n²) attention + KV cache VRAM + catastrophic forgetting + GDPR compliance**. Every "Memory" feature from ChatGPT / Claude / Cursor works the same way: **inject structured text back into the system prompt**. Weights never change. Prompt Caching is performance optimization, not memory. The mainstream for the next 1–3 years is **"stateless LLM core + stateful Agent memory layer"**.

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

ChatGPT Memory has been breached via prompt injection through Google Docs, images, and web pages — attackers invoke `to=bio` to write malicious persistent instructions affecting all future conversations (Embrace The Red, 2024). This is precisely why Cursor 1.0→1.2 added mandatory user approval, and why Anthropic tested sycophancy/harmful conversation before releasing Memory.

<div class="research-callout callout-neutral">

**Karpathy's canonical analogy**: **Weights = ROM** (static, burned in at training); **context window = RAM** (directly addressable during inference); **KV cache = working memory** (formed at test-time); **external vector / KG store = disk** (persistent, requires retrieval). "Knowledge in the weights is a hazy recollection of training-time internet documents; content in the context window is directly accessible" — Andrej Karpathy, Dwarkesh Patel Interview (2025-10).

</div>

---

## 2. Product Landscape: Cache vs Memory vs True Memory

14 products, **zero weight modifications**. This section also disentangles three commonly conflated concepts.

### Cache (KV / Prompt Caching) <span class="research-pill pill-success">Compute Opt</span>

Caches K, V projection tensors; prefix byte-level match → skip prefill. Cache-hit and recomputed outputs are mathematically equivalent. Lifetime: 5min–24h. Essence: optimization, not "remembering."

### Memory (Product Layer) <span class="research-pill pill-success">Systems Eng</span>

**Text** in external databases / vector stores / markdown files, injected into system prompt on each call. User-controlled: visible, editable, deletable, exportable. Essence: systems engineering + UX, not model capability. Key evidence: Manthan Gupta confirmed ChatGPT has **zero knowledge** of topics discussed a year ago — it only stores summaries of the last ~40 user messages.

### True Model Memory (In-Weights) <span class="research-pill pill-warn">Nearly Nonexistent</span>

Changing the weights themselves — hit by catastrophic forgetting + GDPR + interpretability. LoRA is for domain/role specialization, not per-user.

### Comparison Table

<table class="research-table">
<thead><tr><th>Product</th><th>Strategy</th><th>Type</th><th class="col-center">Weight Δ?</th></tr></thead>
<tbody>
<tr><td><strong>ChatGPT Memory</strong></td><td>4-layer: metadata + bio + ~40 summaries + window</td><td>Memory</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>OpenAI Prompt Caching</em></td><td>≥1024 tokens auto KV cache, 5min–24h TTL</td><td>Cache</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>Anthropic Prompt Caching</em></td><td>Explicit <code>cache_control</code> ≤4 breakpoints, byte-level match</td><td>Cache</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>Gemini Context Caching</em></td><td>Implicit 90% discount + Explicit 60min TTL</td><td>Cache</td><td class="col-center">No</td></tr>
<tr><td><strong>Claude.ai Projects</strong></td><td>Instructions + files + history, full prompt injection</td><td>Memory</td><td class="col-center">No</td></tr>
<tr><td><strong>Claude Memory</strong> (2025-10)</td><td>Project-isolated, 24h synthesis, editable</td><td>Memory</td><td class="col-center">No</td></tr>
<tr><td><strong>Claude Code</strong></td><td>CLAUDE.md + model-written MEMORY.md (200 lines)</td><td>Memory</td><td class="col-center">No</td></tr>
<tr><td><strong>Cursor Rules / AGENTS.md</strong></td><td>Static markdown, 4 trigger modes, Team > Project > User</td><td>Memory</td><td class="col-center">No</td></tr>
<tr><td><strong>Cursor Memories</strong> (1.0+)</td><td>AI generates candidates → user approves → writes</td><td>Memory</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>Cursor Codebase Index</em></td><td>Merkle tree + encryption + Turbopuffer vector DB</td><td>RAG</td><td class="col-center">No</td></tr>
<tr><td><strong>Windsurf Cascade</strong></td><td>global + workspace rules + auto Memories + RAG</td><td>Memory</td><td class="col-center">No</td></tr>
<tr><td><strong>Devin Knowledge</strong></td><td>Human-written + AI suggestions + DeepWiki + VM Snapshots</td><td>Memory + RAG</td><td class="col-center">No</td></tr>
<tr style="background:var(--entry)"><td><em>Replit Checkpoints</em></td><td>VM snapshot = files + DB + chat + Agent memory</td><td>Snapshot</td><td class="col-center">No</td></tr>
</tbody>
</table>

> Light rows = Cache / RAG / Snapshot; bold rows = Memory. No product modifies weights.

---

## 3. The Four-Layer Future Stack

Bottom-up: base layer forever stateless. The three above are different abstractions for "giving it memory." L4 is the short-term mainstream; L2 is the highest-value research leap.

### L4 · Agent Memory Layer <span class="research-pill pill-success">Most Mature</span>

Treats the LLM as a stateless CPU; memory lives in external databases + Agent runtime. Representatives: `Letta` (MemGPT) · `Mem0` · `Zep + Graphiti` · `LangGraph Store` · `AutoGen Memory`.

- ✅ Auditable · Deletable · Model-agnostic
- ⚠️ Retrieval quality ceiling · Write contamination accumulates
- Mem0 scores 26% above OpenAI Memory on LoCoMo; 91% lower p95 latency; 90% fewer tokens

### L3 · Ultra-Long Context <span class="research-pill pill-info">Commercialized</span>

Stuffs memory into ultra-long context windows. Representatives: Gemini 2M (>99% needle recall) · Magic LTM-2-Mini 100M tokens.

- ✅ Best in-session carrier
- ⚠️ Lost-in-the-middle unsolved · 100M ctx single user = 638×H100

**L3 and L4 are complementary, not competitive**: ultra-long context handles within-session associations; Agent memory layer handles cross-session / cross-year persistence. Combining both is the current engineering optimum.

### L2 · In-Architecture Memory <span class="research-pill pill-warn">Highest Research Value</span>

Embeds "persistent memory" as a differentiable module in the network — potentially the real paradigm shift. Representatives: Google `Titans` · `Infini-attention` · `Mamba-2` · `RWKV-7 Goose`.

- ✅ Constant VRAM · Linear time
- ⚠️ Not yet validated at scale (needs ≥70B params / ≥10T tokens)

### L1 · Bare LLM (frozen weights) <span class="research-pill pill-neutral">Forever Stateless</span>

GPT / Claude / Gemini / Llama core. Each inference is a fresh process. Continual learning won't become a per-user memory path short-term. LoRA is for domain/role specialization, not per-user.

---

## 4. Memory Economics: Why Cache TTL Is a Hidden Pricing Dial

This is the most underappreciated thread in the entire landscape.

In 2026-03, Anthropic **silently dropped cache TTL from 1h to 5min**, causing Claude Code users to pay 17–26% more. No announcement. No SLA commitment. This exposed a brutal truth: **cache TTL directly impacts per-user cost but appears on zero SLAs**.

Extrapolate this logic and the future "memory economics" increasingly resemble cloud storage:

- **Tiered**: Ultra-short (5min, free) → Short (1h, nearly free) → Medium (24h, token-hour billing) → Long-term (permanent, per-GB/month)
- **Pricable**: Anthropic proved you can micro-adjust TTL without telling users — effectively reverse-pricing by traffic
- **Lock-in**: Once your agent workflows depend on specific cache strategies, migration cost becomes lock-in cost

<div class="research-stats">
  <div class="research-stat">
    <div class="stat-value">17–26%</div>
    <div class="stat-label">Cost increase after Anthropic TTL change</div>
  </div>
  <div class="research-stat">
    <div class="stat-value">$0.00</div>
    <div class="stat-label">Cache cost savings — hidden from billing breakdown</div>
  </div>
  <div class="research-stat">
    <div class="stat-value">~$5.4k/hr</div>
    <div class="stat-label">100M ctx KV cache hardware cost (single user)</div>
  </div>
  <div class="research-stat">
    <div class="stat-value">0×</div>
    <div class="stat-label">SLA commitments on cache TTL</div>
  </div>
</div>

---

## 5. Three-Year Paradigm Roadmap

Based on Anthropic, Letta, Karpathy, LeCun sources. 2026 has high confidence; 2027–2028 are inferential with explicit uncertainty.

<table class="research-table">
<thead><tr><th>Year</th><th>Mainstream</th><th>Potential Dark Horse</th></tr></thead>
<tbody>
<tr><td class="col-center"><strong>2026</strong></td><td>Bare LLM + Agent Memory (Mem0/Zep/Letta) + long-context caching</td><td>Titans-style architectures begin small-scale commercial use; Sleep-time Compute becomes agent standard</td></tr>
<tr><td class="col-center"><strong>2027</strong></td><td>Reflection / Sleep-time / TTT enter mainstream Agent framework primitives</td><td>A 7B SSM/Hybrid surpasses Transformer on long-context benchmarks</td></tr>
<tr><td class="col-center"><strong>2028</strong></td><td>Top models may integrate in-arch memory (high-risk prediction); otherwise Memory Layer remains standard</td><td>LeCun H-JEPA + LLM hybrid prototype (early signal for 5–10 year bet)</td></tr>
</tbody>
</table>

> **2028 caveat**: In-architecture memory requires ≥70B params and ≥10T token training for validation — currently arXiv-only. The more likely 2028 scenario is coexistence, not replacement.

---

## 6. Nine Practical Takeaways

1. **Never conflate Cache and Memory**: Cache skips prefill; Memory decides what goes into the prompt. Orthogonal.

2. **Writing memory = writing system prompt**: Any convention expressible in markdown (Cursor Rules / `CLAUDE.md` / AGENTS.md) beats "letting the AI remember" — diffable, version-controlled, deterministic.

3. **Prefix order: static → dynamic**: Tool definitions, system prompt, project rules first; user input last. Top-level advice from OpenAI, Anthropic, and Google docs.

4. **Compaction must be cache-safe**: Don't open a new system prompt for summarization — forces full uncached recomputation. Claude Code calls this "cache-safe forking."

5. **TTL is a product decision**: The Anthropic 1h→5min incident proves it. Expose TTL as user-configurable, or users will find your hidden pricing in their bills.

6. **AI writes, human approves = steadiest auto-Memory**: Cursor 1.2's user approval + Devin's suggestion-only flow are the post-prompt-injection consensus.

7. **Visible, editable, exportable = trust**: Anthropic's natural language synthesis vs ChatGPT's opaque synthesis — two sides of the same coin.

8. **Privacy mode conflicts with Cache**: OpenAI Extended cache loses ZDR; Cursor privacy mode stores no plaintext. Offer "performance vs. privacy" as two modes.

9. **The real moat is "context engineering," not "memory models"**: Deterministic, version-controlled, human-readable state. Curation cost is one-time; benefit compounds.

---

## 7. Key References

All primary sources from 2024–2026. 30+ curated entries.

### A. Vendor Sources

**OpenAI**: [Prompt Caching guide](https://developers.openai.com/docs/guides/prompt-caching) · [Caching 201 cookbook](https://developers.openai.com/cookbook/examples/prompt_caching_201/) · [Manthan Gupta · Reverse Engineered ChatGPT Memory](https://manthanguptaa.in/posts/chatgpt_memory/) · [Embrace The Red · Hacking Memories](https://embracethered.com/blog/posts/2024/chatgpt-hacking-memories/)

**Anthropic**: [Prompt Caching docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) · [Lessons from Claude Code](https://claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything) · [Claude Code Memory](https://docs.anthropic.com/en/docs/claude-code/memory) · [How Claude's memory works](https://support.anthropic.com/en/articles/11817273-how-does-claude-s-memory-work)

**Google**: [Gemini Context Caching](https://ai.google.dev/gemini-api/docs/caching) · [Vertex AI caching overview](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview)

**Cursor / Windsurf / Devin / Replit**: [Cursor Rules](https://cursor.com/docs/context/memories) · [Codebase Indexing](https://cursor.com/docs/context/codebase-indexing) · [Cursor 1.0](https://www.cursor.com/changelog/1-0) + [1.2](https://cursor.com/en/changelog/1-2) changelogs · [Windsurf Memories](https://docs.windsurf.com/windsurf/cascade/memories) · [Devin Knowledge](https://cognitionai.mintlify.app/product-guides/knowledge) · [Replit Checkpoints](https://docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks)

### B. Key Papers

**Architecture**: [Lost in the Middle](https://arxiv.org/abs/2307.03172) · [Gemini 1.5](https://arxiv.org/abs/2403.05530) · [Magic LTM-2-Mini](https://magic.dev/blog/100m-token-context-windows) · [Titans](https://arxiv.org/abs/2501.00663) · [Infini-attention](https://arxiv.org/abs/2404.07143) · [Mamba-2](https://proceedings.mlr.press/v235/dao24a.html) · [RWKV-7](https://arxiv.org/abs/2503.14456) · [KV-Direct](https://www.arxiv.org/pdf/2603.19664)

**Memory Layer**: [MemGPT](https://arxiv.org/abs/2310.08560) · [Mem0](https://arxiv.org/abs/2504.19413) · [Zep + Graphiti](https://arxiv.org/abs/2501.13956) · [A-Mem](https://arxiv.org/abs/2502.12110) · [Generative Agents](https://arxiv.org/abs/2304.03442) · [Sleep-time Compute](https://arxiv.org/abs/2504.13171)

**Continual Learning**: [CL Survey](https://arxiv.org/abs/2404.16789) · [TTT (ICML 2025)](https://proceedings.mlr.press/v267/akyurek25a.html) · [Memory Taxonomy](https://arxiv.org/abs/2505.00675)

### C. Researchers (Karpathy / LeCun / Raschka)

- [Karpathy · Dwarkesh Patel Interview (2025-10)](https://www.dwarkeshpatel.com/p/andrej-karpathy) · [Intro to LLMs](https://www.youtube.com/watch?v=zjkBMFhNj_g)
- [LeCun · Path Towards AMI](https://openreview.net/pdf?id=BZ5a1r-kVsf) · [NVIDIA GTC 2025](https://www.endofmiles.net/lecun-says-hes-not-so-interested-in-llms-anymore)
- [Raschka · Coding the KV Cache](https://sebastianraschka.com/blog/2025/coding-the-kv-cache-in-llms.html)

### D. Frameworks

- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence) · [AutoGen Memory](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/memory.html)
- [Letta Research](https://www.letta.com/research) · [Don't Break the Cache](https://arxiv.org/abs/2601.06007v2) · [ctx.ist](https://ctx.ist/thesis/)

---

*Research method: Three parallel sub-agents (technical principles + product API design + future paradigms), cross-validated across four sources (Exa, Tavily, Context7, WebSearch). 67 primary URLs, 2024-Q1 to 2026-Q2.*
