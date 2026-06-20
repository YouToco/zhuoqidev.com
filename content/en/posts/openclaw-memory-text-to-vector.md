---
title: "OpenClaw Memory in Practice: From 'Vector Search Is Down But Everything Still Works' to Zero-Cost NVIDIA Embeddings"
description: "OpenClaw's vector retrieval silently failed — but BM25 text search kept the memory system running for two weeks unnoticed. When you discover 'it works without embeddings,' should you even bother fixing it? Here's how I used NVIDIA's free embedding API to complete the picture, and what I learned about when vector search actually matters."
date: 2026-06-20
tags: ["OpenClaw", "AI Agent", "Memory System", "Embedding", "NVIDIA", "Vector Search", "BM25"]
categories: ["AI Agent in Practice"]
series: ["OpenClaw Production Notes"]
series_order: 2
seriesOpened: true
summary: "OpenClaw's vector retrieval silently failed — but BM25 text search kept the memory system running for two weeks unnoticed. Should you even bother fixing it? Here's how I used NVIDIA's free embedding API to complete the picture at zero cost."
showToc: true
ShowReadingTime: true
---

> This is the second post in the [OpenClaw Production Notes](/series/openclaw-production-notes/) series. [The first](/posts/openclaw-pitfalls/) covered compaction silently swallowing replies and defensive Outer Loop design. This one is about the memory system — specifically, a real experience that made me rethink whether vector search is worth the trouble.

## Background: How OpenClaw's Memory Retrieval Works

OpenClaw uses a **hybrid retrieval system** — vector (embedding similarity) and BM25 (keyword matching) fused at a 7:3 weight ratio, then passed through PPO-adaptive five-dimensional reranking (recency 0.35 + frequency 0.25 + semantic 0.25 + saliency 0.15 + procedural on-demand).

Architecturally:

```
User Query
   ↓
┌───────────────┐   ┌───────────────┐
│ Vector (70%)  │   │ BM25 (30%)    │
│ embedding →   │   │ keyword match →│
│ cosine sim    │   │ TF-IDF score  │
└──────┬────────┘   └──────┬────────┘
       └────────┬──────────┘
                ↓
       Hybrid ranking + PPO 5-dim reweighting
                ↓
           Top-K memory chunks
```

Looks great on paper. But after two weeks in production, I discovered something puzzling.

## Discovery: Vector Search Was Broken, and Nobody Noticed

During a routine health check, I ran `openclaw memory status` and spotted an anomaly:

```
Vector store: unknown
Embedding cache: enabled (0 entries)
FTS: ready
```

**Vector store unknown, embedding cache empty** — vector retrieval wasn't working at all. But here's the strange part: the memory system was retrieving memories daily, Dreaming consolidation ran on schedule, and the Agent's response quality showed no obvious degradation.

Look at the FTS (full-text search) line: **ready**. BM25 had been quietly carrying the entire load.

The root cause: the `memorySearch` section in `openclaw.json` was missing the embedding provider configuration. On startup, embedding initialization failed silently, and the system degraded to pure BM25 mode. No error, no warning — it just used the 30%-weighted retrieval channel alone, and it held up.

### What This Means

903 memory chunks, 512 recall entries — the entire memory system ran on **pure text search** for two weeks, and nobody noticed anything was wrong.

This forced me to reexamine a basic assumption: **how much does vector search actually matter for a coding Agent's memory?**

## Why BM25 Was Good Enough Here

The memory content of a coding Agent has several characteristics that happen to be BM25's sweet spot:

**1. Memory content is highly structured.** OpenClaw's memory files are Markdown with frontmatter (`name`, `type`, `description`), heading hierarchies, and precise technical terms. Not vague natural language, but things like `compaction safeguard`, `Gemini 429 quota exhaustion`, `fable-5 global ban`. BM25 handles this kind of semi-structured technical documentation quite well.

**2. Queries and documents share the same vocabulary.** When someone asks "how to configure compaction," the memory literally contains the word "compaction." There's no semantic gap where the user says "apple" but the document says "fruit." In programming, terminology is highly standardized — `429` is `429`, `context overflow` is `context overflow`. This is exactly what BM25 excels at: **exact term matching**.

**3. The memory corpus is in the thousands, not millions.** 99 files, 903 chunks — at this scale, BM25's precision and recall are both reasonable because the candidate set is small. Vector search's advantage shows at massive scale; at 1000 chunks, the edge is negligible.

**4. PPO five-dimensional reranking compensates for retrieval quality.** Even if BM25's initial ranking is imprecise, the recency dimension (recently used memories rank higher) and frequency dimension (frequently recalled memories get boosted) push the right memories to the top. These dimensions don't depend on embeddings — they're pure usage statistics.

One-line summary: **When terms are precise, data is in the thousands, and usage-based reranking is in play, BM25 alone is a perfectly adequate retrieval solution.**

This echoes what I wrote in my [memory selection framework](/posts/memory-choice-framework/): **don't use RAG unless you have to.** Vector search isn't the default — it's what data volume and semantic complexity force you into.

## So Why Fix It?

If BM25 was enough, why did I ultimately add vector search back? Three reasons:

**1. Cross-language retrieval.** My memory files mix Chinese and English — some incident records are in Chinese ("Gemini 资源池配额枯竭"), others in English ("unrestricted key enforcement"). BM25 can't do cross-language fuzzy matching: searching "quota exhausted" in English won't find the Chinese description of the same incident. Embedding spaces naturally align semantics across languages and synonyms.

**2. Concept-level retrieval.** Ask "have we seen the bot not responding before?" — BM25 matches the literal words "not responding," but won't match `compaction silently swallowing replies` (which is exactly the answer). Vector search brings "bot not responding" and "silently swallowing replies" closer in semantic space. As memories accumulate, these concept-level associations become increasingly important.

**3. Hybrid complementarity.** Vectors excel at semantic recall, BM25 excels at exact matching — the combination is strictly better than either alone. The 7:3 weight split means BM25 gives you a guaranteed floor of exact matches, while vectors add bonus semantic discovery. The first two weeks on pure BM25 were "good enough," but "good enough" and "good" are separated by exactly one vector index.

## Implementation: Zero-Cost Fix with NVIDIA's Free Embedding API

The key constraint: **no additional cost.** OpenClaw is already burning model API credits; if embeddings also cost per-token (OpenAI's `text-embedding-3-small` runs $0.02 per million tokens), even the small cost for 903 chunks of continuous indexing and per-query embedding is unnecessary.

NVIDIA's `nv-embed-v1` is a free embedding model available through the NVIDIA API Catalog, fully compatible with the OpenAI API format. It performs in the same tier as OpenAI's embedding models on MTEB benchmarks, outputs 4096 dimensions, and has solid multilingual support.

### Getting an API Key

1. Sign up at [NVIDIA API Catalog](https://build.nvidia.com/)
2. Navigate to the NV-Embed-V1 model page, click "Get API Key"
3. You get an `nvapi-` prefixed key — free to use, rate-limited but more than sufficient for Agent memory workloads

### Configuring OpenClaw

Add a `memorySearch` section to the agent defaults in `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "memorySearch": {
        "enabled": true,
        "provider": "openai",
        "remote": {
          "baseUrl": "https://integrate.api.nvidia.com/v1",
          "apiKey": "nvapi-your-key-here"
        },
        "model": "nvidia/nv-embed-v1"
      }
    }
  }
}
```

A critical detail: `provider` is set to `"openai"`, not `"nvidia"`. NVIDIA API Catalog's endpoint is fully compatible with OpenAI's `/v1/embeddings` format — same request body structure, same response format. OpenClaw just needs to know "this is an OpenAI-compatible embedding endpoint," and `baseUrl` handles the routing to NVIDIA's servers.

This is a testament to the OpenAI embedding API becoming the de facto standard: NVIDIA, Alibaba Tongyi, Jina, Cohere — they all implement the same interface. When choosing a provider, don't overthink it. As long as the API is compatible, `"openai"` is the universal adapter.

### Rebuilding the Index

After updating the config, restart the Gateway and rebuild the memory index:

```bash
openclaw memory reindex --deep
```

Output:

```
Indexed: 99/99 files · 903 chunks
Vector dims: 4096
Embedding cache: enabled (779 entries)
```

All 99 files re-embedded and indexed into the vector store. The 4096 dimensions from nv-embed-v1 are higher than OpenAI's 1536 (text-embedding-3-small), theoretically providing a more granular semantic space.

### Verifying Hybrid Retrieval

Testing with a semantically fuzzy query:

```bash
openclaw memory search "what was that incident where the bot stopped responding"
```

Top-1 result: the compaction silently-swallowed-reply memory entry — impossible under pure BM25 (the memory contains neither "stopped" nor "responding," only "silently discarded" and "Compaction output empty summary").

Cross-language test:

```bash
openclaw memory search "Gemini quota issue"
```

Matched the Chinese-language memory entry "Gemini 资源池整体配额枯竭" (Gemini resource pool quota exhaustion). BM25 cannot make this match.

## Before and After

| Dimension | Before (BM25 only) | After (Vector + BM25 7:3) |
|-----------|----------|----------|
| Exact term matching | Works | Works |
| Semantic/concept matching | No | Yes |
| Cross-language retrieval | No | Yes |
| Synonym matching | No | Yes |
| Cost | $0 | $0 (NVIDIA free tier) |
| Index size | 903 chunks | 903 chunks |
| Embedding cache | 0 | 779 entries |
| Retrieval latency | <10ms | <50ms (includes API call) |
| System stability | Stable | Stable (BM25 still backstops) |

The last row deserves emphasis: even if NVIDIA's API occasionally times out or becomes unavailable, the system automatically degrades back to pure BM25 — identical to the pre-fix state. **Vector search is a bonus, not a dependency.**

## Lessons Learned

**1. Get it running first, optimize later.** Vector search was misconfigured for two weeks and nobody noticed. This tells you that the core value of a memory system isn't retrieval algorithm precision — it's whether memories are being written, managed, and surfaced when needed. BM25 handles 80% of retrieval scenarios; the remaining 20% of semantic matching is an optimization, not a requirement.

**2. The right mental model for hybrid retrieval is "BM25 as floor, vectors as upside."** Don't flip it to "vectors as primary, BM25 as backup." In production, determinism (BM25's exact match will always find keyword-identical memories) matters more than probability (vector similarity might surface irrelevant content). In the 7:3 weight split, that 3 is the system's safety net.

**3. OpenAI-compatible format is the de facto standard for embeddings.** Whether you use NVIDIA, Alibaba, Jina, or Cohere, the configuration pattern is identical: `provider: "openai"` + `baseUrl: "vendor endpoint"` + `model: "model name"`. No vendor-specific adapters needed. This also means: if NVIDIA's free tier disappears someday, switching to another free embedding service is a two-line config change.

**4. Free ≠ inferior.** NVIDIA nv-embed-v1 is an MTEB-competitive model with 4096 dimensions and good multilingual support. It's free because NVIDIA wants to grow its API ecosystem — what you get is a genuinely competitive embedding model, not a crippled version.

**5. "Is vector search worth it?" depends on your data characteristics.** If your memories are all precise technical terms, data is in the thousands, and queries use the same vocabulary as documents — BM25 is enough, vector search is optional. If your memories include cross-language content, natural language descriptions, and concept-level associations — vector search goes from "optional" to "necessary." My scenario was the latter (mixed Chinese/English, incident descriptions vs. technical terminology), so I added it back.

---

> Next: [One File Path Eliminated 84% of Tool Calls — A Cron Job Debugging Story](/posts/openclaw-cron-skill-optimization/). When your AI Agent spends 15 exec calls every run searching for a skill's file path, inflating message count from 54 to 165, and the root cause is a single missing absolute path in the SKILL.md. This matters more than any algorithm tuning.
