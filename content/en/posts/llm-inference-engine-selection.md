---
title: "How to Choose an LLM Inference Engine — A 2026 Map from Local Single-GPU to PD Disaggregation"
description: "Aliyun's four-engine table — Ollama / vLLM / SGLang / HF Pipeline — is no longer enough in 2026. This piece re-maps inference engines into three tiers (Local → High-Performance Serving → Distributed/Disaggregated), covering 8 mainstream engines plus three new trends — PD disaggregation, speculative decoding, and FP4 quantization — with a decision matrix and a decision tree."
date: 2026-07-19
tags: ["LLM", "Inference Engine", "vLLM", "SGLang", "Model Serving", "Inference Optimization", "Selection Guide", "Research"]
categories: ["Deep Dives"]
showToc: true
---

Aliyun's CAP has a piece on picking an inference engine that narrows the field to four: **Ollama, vLLM, SGLang, and Hugging Face Pipeline**. In 2024, that framing was fine.

By 2026, it's missing half the map. NVIDIA's TensorRT-LLM has completed its "PyTorch-ification," SGLang became famous as the first open-source project to reproduce DeepSeek's large-scale deployment, Hugging Face slapped a "maintenance mode" banner on TGI and told you to switch to vLLM — and the real throughline of the entire 2025 inference landscape can be summed up in one word: **disaggregate**.

This article updates that map to mid-2026. It won't tell you which product to buy — **it gives you a tiered framework, a decision matrix, and a decision tree so you can narrow the field to 1–2 candidates yourself.**

---

## Why "Choosing an Inference Engine" Is a Real Problem in 2026

Three years ago this wasn't worth agonizing over. Back then, getting a 7B model running on a GPU with a reasonably smooth token stream was already a pass.

That changed, for three reasons:

1. **Model capabilities are converging; deployment forms are diverging.** On the open side — from Llama and Qwen to DeepSeek-V3/R1 and Kimi K2 — the capability gap is shrinking. What actually separates teams now is "can you run it efficiently, cheaply, and reliably." The same DeepSeek-R1: one person barely runs it on a single 4090 for a prototype, another hits near-official throughput on 96 H100s at one-fifth the official API cost. The difference is the engine and the deployment architecture.
2. **Large-scale MoE has pushed inference from "single-GPU engineering" to "distributed-systems engineering."** DeepSeek-V3 is 671B total / 37B active; Kimi K2 is 1T total. These models don't fit on one machine — you *must* do expert parallelism (EP) across nodes, and the engine you pick decides whether you have to wrestle with all-to-all communication and expert load balancing.
3. **For the same model, throughput/cost between engines can differ by several times.** Not "a little faster" — "same GPU, several times more users served." That goes straight onto your cloud bill.

So selection is no longer "grab whatever runs." It's **first figure out which tier of the map you're on.**

---

## The One-Table Overview: Eight Engines at a Glance

Conclusion first. Here's where the mainstream 2026 engines sit, side by side:

| Engine | Backed by | Core mechanism in one line | Latest version (as of 2026-07) | Typical positioning |
|---|---|---|---|---|
| **vLLM** | Community / Red Hat | PagedAttention + fully async V1 engine | v0.25.x (2026-07) | The general-purpose open-source standard |
| **SGLang** | LMSYS / Community | RadixAttention prefix-tree KV reuse | v0.5.x | Large-scale MoE / DeepSeek deployment |
| **TensorRT-LLM** | NVIDIA | Compiled kernels + In-flight Batching | v1.2.1 (2026-04) | Peak performance on NVIDIA cards |
| **LMDeploy** | Shanghai AI Lab | TurboMind high-performance C++ engine | v0.13.x | Chinese models / mixed-precision quant |
| **Ollama** | Ollama | llama.cpp/GGML + in-house multimodal engine | v0.30.x | Local / desktop one-command runs |
| **llama.cpp** | ggml-org | GGUF + runs on CPU/GPU alike | Rolling | Edge / CPU / quantization |
| **HF TGI** | Hugging Face | Early Rust serving gateway | v3.3.7 (**maintenance mode**) | ⚠️ Officially advised to migrate away |
| **KTransformers** | Tsinghua kvcache-ai | CPU/GPU heterogeneous, experts on CPU | Rolling | Running huge MoE on a single GPU |

See the ⚠️ on the HF row? That's one of the most important shifts of 2025 — more on it below.

---

## Think in Tiers: Inference Engines Actually Split Into Three Layers

Laying all eight engines flat in one table is a trap — they aren't solving the same problem. **Choosing between Ollama and SGLang is like comparing a sedan and a container truck on fuel economy.** The right move is to tier them first:

```
L1 Local / Single-Machine  — one user; what matters is "runs at all, installs easily"
   Ollama · llama.cpp · LM Studio · HF Pipeline (prototype)

L2 High-Performance Serving — one service, many users; throughput / latency / VRAM efficiency win
   vLLM · SGLang · TensorRT-LLM · LMDeploy · (TGI has exited)

L3 Distributed / Disaggregated — one data center, one big model; architecture matters more than the engine
   PD disaggregation · NVIDIA Dynamo · Mooncake · large-scale Expert Parallelism (EP)
```

**Locate your tier first, then pick within it.** Most people's agonizing comes from taking an L1 need to L2 to shop — or the reverse.

---

## L1 Local / Single-Machine: Runs at All, Installs Easily

The core need here isn't throughput — it's **"one person, one machine, ideally one command to get the model running."** Privacy-sensitive, offline, edge, and rapid prototyping all live here.

### Ollama / llama.cpp: The Face and the Kernel

These two belong together — they're two sides of the same thing:

- **llama.cpp** is the kernel — C/C++, the **GGUF** quantization format, runs on CPU / GPU / Apple Silicon alike. The bedrock of edge quantized inference.
- **Ollama** is the face — a product layer on top of llama.cpp for "one-command launch + model management." `ollama run qwen3` and you're done.

There's a **2025 change many older articles haven't caught up on**:

> **Ollama is moving from "llama.cpp wrapper" to its own in-house engine.** In May 2025 it shipped a new multimodal engine, making vision models (gemma3, qwen2.5vl, mistral-small3.1, etc.) first-class citizens, talking directly to the GGML tensor library and gradually decoupling from llama.cpp ([Ollama blog](https://ollama.com/blog/multimodal-models)). By 0.30, it added an MLX engine on Apple Silicon alongside the llama.cpp one, enabled Vulkan by default (extending to AMD/Intel GPUs), and gained ~+20% on NVIDIA ([Ollama blog](https://ollama.com/blog)).

So if you still think "Ollama is just a llama.cpp launcher," it's time to update.

**When to pick them:** local dev, desktop apps, private data that can't leave the intranet, edge deployment, quickly checking whether a model "works." GGUF is the universal exchange format for this tier.

**When not to:** high-concurrency online services. These target single-machine / single-user experience, not data-center throughput — a positioning *orthogonal* to L2 engines, not a "who's stronger" question.

### HF Pipeline vs. TGI: One's a Prototyping Toy, One Has Exited

Aliyun's original lists "Hugging Face Pipeline" as a candidate. Two things need untangling here, because **they get conflated constantly and both have traps**:

- **`transformers.pipeline`** is the high-level "call a model in a few lines" API — great for teaching, prototypes, small offline batches. But it **was never a production serving solution** — no continuous batching, no PagedAttention; it collapses under concurrency. As a candidate, it's a "prototype-stage" candidate only.
- **TGI (Text Generation Inference)** was HF's actual serving product. But —

{{< alert icon="bomb" >}}

**One of the most important shifts of 2025: Hugging Face put a "maintenance mode" banner on TGI with its own hands.** The GitHub README states plainly *"text-generation-inference is now in maintenance mode,"* accepts only minor bug fixes, and **recommends users move to vLLM, SGLang, or local llama.cpp / MLX** ([TGI GitHub](https://github.com/huggingface/text-generation-inference)). HF strategically ceded serving to vLLM/SGLang and went back to focusing on the transformers model-architecture standard.

{{< /alert >}}

**Takeaway:** if someone still recommends TGI for production in 2026, their information stopped in 2024. Prototype with `pipeline`; for production, look at L2.

---

## L2 High-Performance Serving: One Service, Many Users

This is the tier most "going live" teams actually shop in. The core needs become **throughput, latency (TTFT / TPOT), and VRAM efficiency** — same GPU, several times more requests.

Two foundational techniques worth remembering first:

- **Continuous Batching**: don't wait for a batch to finish — at every generation step, dynamically admit new requests and retire completed ones, squeezing the GPU dry. Standard in every modern serving engine.
- **PagedAttention / RadixAttention**: two KV-cache management philosophies, the signature moves of vLLM and SGLang respectively. Detailed below.

### vLLM: The Open-Source Standard, V1 Rewrite in 2025

**Core mechanism**: **PagedAttention** slices the KV cache into fixed-size "pages" and, like an OS managing virtual memory, maps logical positions to non-contiguous physical blocks — eliminating fragmentation and boosting concurrency.

**The big 2025 event was the V1 architecture rewrite**: shipped as an alpha with v0.7.0 (2025-01), claiming **up to 1.7× throughput** over the old architecture, with all optimizations on by default, an isolated execution loop, and zero-overhead prefix caching ([vLLM blog](https://vllm.ai/blog/2025-01-27-v1-alpha-release)); **V1 became the default engine** from v0.8.0 on ([Red Hat measurements](https://developers.redhat.com/articles/2025/04/28/performance-boosts-vllm-081-switching-v1-engine)). The V1 scheduler can **mix prefill and decode within the same step**, and bundles chunked prefill, prefix caching, speculative decoding, and PD disaggregation.

**Speculative decoding, quantization, PD disaggregation — all present**: built-in n-gram / EAGLE / Medusa / MTP speculative decoding; quantization spanning FP8 / INT8 / AWQ / GPTQ / GGUF up to MXFP4 / NVFP4 on Blackwell; PD disaggregation via KV Connector to external KV services like Mooncake / LMCache.

**One-line positioning**: **the "default option" with the widest model coverage, richest ecosystem, and single-GPU-to-multi-node reach.** When you can't decide, starting with vLLM is rarely wrong.

### SGLang: The Star of Large-Scale MoE / DeepSeek Deployment

**Core mechanism**: **RadixAttention** uses a radix tree (prefix tree) + LRU to automatically reuse shared-prefix KV cache across requests, making prefix caching a first-class citizen — a natural fit for Agents, multi-turn dialogue, and few-shot loads where **prefixes are highly repetitive**.

**The battle that made SGLang famous**: in 2025-05 it became the **first open-source project to reproduce DeepSeek's official-grade large-scale deployment** — 12 nodes × 8×H100 = **96 H100s**, at 2000-token input hitting 52.3K input tok/s and 22.3K output tok/s per node, **5× faster than naive tensor parallelism**, at roughly **$0.20 / million output tokens (about 1/5 of DeepSeek's official Chat API price)**, within 5–6% of the official profile ([LMSYS blog](https://www.lmsys.org/blog/2025-05-05-large-scale-ep/)). Behind it is a whole combo: DeepEP, DeepGEMM, EPLB, DP Attention, Two-Batch Overlap.

On speculative decoding, SGLang running MTP on DeepSeek-V3 gets up to +60% output throughput, ~1.8× tokens/s ([LMSYS blog](https://www.lmsys.org/blog/2025-07-17-mtp/)).

**One-line positioning**: **the top pick for huge MoE data-center deployment and long-shared-prefix (Agent / multi-turn) workloads.** By 2026, SGLang is the most aggressive open-source engine for "whole-cluster PD + EP engineering" on DeepSeek-class models — it long ago stopped being "one of four" and became the number-one player in that niche.

### TensorRT-LLM: NVIDIA's Own Engine, "PyTorch-ified"

**Core mechanism**: compile the model into a TensorRT engine for kernel-level optimization, paired with In-flight Batching (NVIDIA's name for continuous batching).

**The historical baggage and the 1.0 pivot**: TensorRT-LLM's old reputation was "compiled, blazing fast, but painful to use." **v1.0.0 (2025-09-24 — note 2025, not 2024)** is the turning point — the PyTorch backend became default and stable, the high-level LLM API stabilized, usability clearly moved toward vLLM/SGLang, and it added NVFP4, speculative-decoding enhancements, and Wide-EP (large-scale expert parallelism) ([v1.0.0 Release](https://github.com/NVIDIA/TensorRT-LLM/releases/tag/v1.0.0)).

> ⚠️ **Read marketing numbers critically**: figures floating around like "10,000+ tok/s on H100 FP8, 4× faster than native PyTorch" mostly come from third-party blogs and aren't stably reproduced in NVIDIA's first-party materials. Cite with care.

**One-line positioning**: **pure NVIDIA hardware (especially Hopper / Blackwell), chasing peak throughput/latency, going enterprise (Triton / NIM).** The price is NVIDIA-ecosystem lock-in and lots of closed-source kernels.

### LMDeploy / TurboMind: Chinese Force, Strong on Mixed-Precision and KV Quant

**Core mechanism**: Shanghai AI Lab's in-house **TurboMind** high-performance C++/CUDA engine, built around blocked KV cache, online KV-cache quantization (INT4/INT8), AWQ, and automatic prefix caching.

**Highlight numbers**: TurboMind's mixed-precision inference cuts latency by up to 61% and raises throughput by up to 156% versus existing mixed-precision frameworks, reaching 1.5× vLLM running gpt-oss on H800 ([arXiv:2508.15601](https://arxiv.org/abs/2508.15601)). For DeepSeek it integrates FlashMLA, DeepGEMM, DeepEP, and lands PD disaggregation via DLSlime + Mooncake.

**One-line positioning**: **production deployment of Chinese models (InternLM / Qwen / DeepSeek), teams with strong KV-quant and low-latency needs.** Often beats vLLM on mid-low-batch latency and quantized inference, at the cost of a smaller ecosystem and model coverage.

---

## L1.5 Special Case: KTransformers — Trading Memory for "It Runs At All"

This engine deserves its own slot because it solves one very specific but very painful problem: **not enough VRAM, but I want to run the full 671B MoE locally anyway.**

**Core mechanism**: exploit MoE's "sparse activation" for CPU/GPU heterogeneity — offload the sparsely-activated expert weights to the CPU (big RAM + AMX instructions) and keep dense compute like attention on the GPU (high bandwidth).

**Signature result**: running the **full DeepSeek-R1/V3 671B** on **a single 24GB GPU (RTX 4090D) + large RAM**, with prefill up to 286 tok/s and generation ~14 tok/s ([KTransformers tutorial](https://github.com/kvcache-ai/ktransformers/blob/main/doc/en/DeepseekR1_V3_tutorial.md)). In 2025-10 its CPU kernels were merged into SGLang, taking "heterogeneous offload" from toy to serviceable.

**One-line positioning**: **VRAM-constrained research / low-cost private deployment that still wants to run frontier big MoE.** It doesn't chase high-concurrency throughput — it chases "can it run at all." The poster child for "run frontier models on consumer hardware."

---

## Model Format × Engine: First, What Format Are Your Weights?

Before picking an engine, check what format your model is in — this alone cuts half the candidates:

| Format | Notes | Main engines |
|---|---|---|
| **GGUF** | Universal edge quant container (Q4_K_M, etc.), CPU-friendly | llama.cpp / Ollama |
| **Safetensors** | Fast to load, resistant to malicious code, HF-ecosystem mainstream | vLLM / SGLang / TRT-LLM / LMDeploy |
| **PyTorch (.pt/.pth)** | Raw state_dict weights | vLLM / HF Pipeline |

### Quantization: 2026 Has Entered the 4-bit (FP4) Era

Aliyun's original stops at FP8 / GGUF for quantization — this part needs an upgrade. The 2025 storyline for quant is **8-bit → 4-bit**:

| Quant format | Notes | Main engines |
|---|---|---|
| **FP8 (E4M3)** | Native since Hopper/Ada; weights + activations + KV cache | vLLM / TRT-LLM / SGLang / LMDeploy |
| **AWQ** | Activation-aware 4-bit weight quant, good accuracy | vLLM / LMDeploy / SGLang |
| **GPTQ** | Classic 4-bit post-training quant | vLLM / TRT-LLM |
| **GGUF (Q4_K_M…)** | Universal edge quant container | llama.cpp / Ollama |
| **MXFP4** | One power-of-two scale per 32 values (micro-scaling) | gpt-oss native / vLLM / LMDeploy / TRT-LLM |
| **NVFP4** | One FP8 scale per 16 values, finer | Blackwell native / TRT-LLM / vLLM |

The landmark event is **OpenAI's gpt-oss (2025) shipping directly in MXFP4** — the MoE expert weights (90%+ of parameters) are quantization-aware-trained, letting the 120B fit on a single 80GB card ([NVIDIA blog](https://developer.nvidia.com/blog/fine-tuning-gpt-oss-for-accuracy-and-performance-with-quantization-aware-training/)). NVIDIA claims NVFP4's KV cache is ~50% smaller than FP8 with <1% accuracy loss and 1.6× BF16 throughput ([NVIDIA Research](https://research.nvidia.com/labs/eai/blogs/pushing-intelligence-to-4-bit/)).

> **A rule of thumb**: **format and quantization define your candidate pool — clear this gate before talking engines.** GGUF in hand? Don't dream of SGLang. Want NVFP4? You need a Blackwell card plus TRT-LLM/vLLM.

---

## The Three New Trends Aliyun's Original Skipped

This is where this article adds the most over the original. The real 2025 progress in inference engines lives entirely in these three things.

### Trend 1: PD Disaggregation — The Architectural Throughline of 2025

The "disaggregate" from earlier mostly means this.

**Why split**: one inference has two phases with opposite characteristics —

- **Prefill**: computes the KV for the whole prompt — **compute-bound**, eats FLOPs.
- **Decode**: generates one token per step — **memory-bound**, eats memory bandwidth.

Cramming both onto the same card makes them interfere, and it's hard to satisfy time-to-first-token (TTFT) and time-per-output-token (TPOT) at once. **Split them onto separate GPU pools and each can scale independently and pick its own optimal parallelism** — that's Prefill-Decode disaggregation (disaggregated serving).

Two representative works:

- **Mooncake** (the serving platform behind Moonshot's Kimi): a **KVCache-centric** disaggregated architecture that not only splits prefill/decode but organizes idle CPU / DRAM / SSD across the cluster into a **global KV cache pool**. The paper won **FAST 2025 Best Paper**, showing up to +525% throughput in simulated long-context scenarios ([arXiv:2407.00079](https://arxiv.org/abs/2407.00079)). It's now widely integrated by vLLM, SGLang, TensorRT-LLM, and Dynamo.
- **NVIDIA Dynamo** (see Trend 3) productizes PD disaggregation directly.

> **There's a mental shift behind this**: **the KV cache is going from "a thing in one machine's VRAM" to "a cluster-level storage layer."** Mooncake and LMCache sink KV down to CPU/DRAM/SSD, enabling cross-instance, near-GPU prefix caching. That step takes inference squarely into distributed-systems territory.

### Trend 2: Speculative Decoding — From Paper to Standard Feature

**One-line principle**: a lightweight "draft model" quickly guesses the next several tokens, then the big model **verifies the whole string in a single forward pass** — every correct guess skips a step of one-at-a-time generation.

In 2025 it went from "a trick in papers" to "flip a switch in vLLM/SGLang":

- **EAGLE-3** ([arXiv:2503.01840](https://arxiv.org/abs/2503.01840)): drops feature prediction in favor of direct token prediction + multi-layer feature fusion, **up to 6.5× speedup**, and found a scaling law — "more training data, higher speedup."
- **MTP (Multi-Token Prediction)**: DeepSeek-V3 ships with an MTP head that naturally serves as a draft. SGLang measures ~1.8× tokens/s at 85–90% acceptance; vLLM auto-detects the MTP head.
- **Medusa**: the 2024 landmark (multiple decoding heads + tree attention), largely surpassed by EAGLE-3 in 2025 but still a built-in option.

**What it means for selection**: if your engine (vLLM / SGLang / TRT-LLM) supports speculative decoding and you haven't turned it on — that's a nearly free 1.4–2× speedup worth trying first.

### Trend 3: NVIDIA Dynamo — Productizing Disaggregated Inference

**The key positioning point**: Dynamo **is not yet another inference engine — it's an orchestration layer above the engines.** Announced at GTC 2025, it's data-center-grade, open-source, purpose-built for distributed inference orchestration.

It packages the first two trends into a product, with four components:

1. **Planner**: dynamically switches between "disaggregated vs. aggregated" and scales GPUs up/down by SLO and load.
2. **Smart Router**: tracks the whole cluster's KV cache via a radix tree and routes a request to the card that will hit the cache.
3. **KV Cache Manager**: sinks cold KV to CPU / SSD / object storage.
4. **NIXL**: a high-throughput transfer library across heterogeneous memory / storage.

**Performance**: DeepSeek-R1 671B gets 30× throughput on GB200 NVL72; Llama 70B doubles throughput on Hopper. Crucially, **it accepts vLLM / SGLang / TensorRT-LLM as backends** ([NVIDIA blog](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)).

> **The signal is clear**: NVIDIA uses Dynamo to standardize "PD disaggregation + smart routing + KV tiering," and **doesn't bind to its own engine** — effectively conceding that vLLM/SGLang are a done deal and retreating to add value at the orchestration and hardware layers. The open engines' standing is thereby stamped.

---

## The Decision Matrix

Putting the L2 engines that you actually pick "one of two / one of three" from side by side, scored by dimension:

| Dimension | vLLM | SGLang | TensorRT-LLM | LMDeploy |
|---|---|---|---|---|
| **Model coverage** | Widest | Wide | Medium (NVIDIA-first) | Medium (China-friendly) |
| **Ease of onboarding** | Low | Medium | Medium (better after 1.0) | Medium |
| **General high-concurrency throughput** | Strong | Strong | Strongest (NV cards) | Strong |
| **Huge MoE / EP deployment** | Strong | Strongest | Strong | Strong |
| **Prefix reuse (Agent/multi-turn)** | Good | Best (RadixAttention) | Good | Good |
| **KV quant / low latency** | Good | Good | Strong | Strongest (TurboMind) |
| **Hardware lock-in** | None (incl. TPU) | None | Hard NVIDIA lock | Mostly NVIDIA |
| **Ecosystem / community** | Most active | Active | NVIDIA official | China community |

No column is all "best" — **and that's exactly what "neutral" means: there's no one-size-fits-all engine, only the one that matches your workload.**

---

## The Practical Decision Tree

Everything above, compressed into one tree:

```
Which tier are you on?
│
├── Local / single-machine / privacy / prototype
│   ├── Just want one command, daily use ─────────► Ollama
│   ├── Squeezing CPU / edge / extreme quant ─────► llama.cpp
│   ├── A few lines to validate a model ──────────► HF transformers.pipeline
│   └── VRAM too small but must run full 671B MoE ► KTransformers
│
├── High-performance online service (one service, many users)
│   ├── Unsure / want the widest model coverage ──► vLLM (default to it)
│   ├── Large MoE / DeepSeek / heavy multi-turn prefix ► SGLang
│   ├── Pure NVIDIA + peak perf + enterprise ─────► TensorRT-LLM
│   └── Chinese models + strong KV quant / low latency ► LMDeploy
│
└── Data-center scale / one big model eats the whole cluster
    └── Don't just stare at the engine — add an orchestration layer ► NVIDIA Dynamo
        (PD disaggregation + Mooncake KV pool + EP; backend is still vLLM/SGLang/TRT-LLM)

⚠️ Still considering TGI for production? — Don't. It's officially in maintenance mode; reroute to vLLM/SGLang.
```

---

## Scenario Summary: One-Line Answers

| If you are… | You'll most likely pick |
|---|---|
| An individual dev running models locally, prototyping | **Ollama** (+ GGUF) |
| Squeezing edge / CPU / Apple Silicon | **llama.cpp** |
| Teaching, small offline batches, validating in a few lines | **HF `pipeline`** (not for production) |
| VRAM-constrained but want the full big MoE | **KTransformers** |
| Going live, unsure, want a solid default | **vLLM** |
| Running DeepSeek / MoE / Agent multi-turn at scale | **SGLang** |
| Pure NVIDIA, chasing peak perf, want the enterprise stack | **TensorRT-LLM** |
| Chinese models, heavy KV quant / low latency | **LMDeploy** |
| One big model eating the whole data center | **Dynamo** (orchestration) + one of the above (backend) |

---

## Closing

Aliyun's article isn't wrong — it just **stopped at the "run a model on one machine" tier.** The industry's center of gravity in 2025 has moved from "which engine runs the model" to "what architecture spreads one big model efficiently across an entire cluster."

If I keep only one sentence, it's this:

> **Choosing an inference engine is, at heart, choosing "which tier you're on."** Locate yourself in one of the three — local / serving / distributed — and the candidates auto-narrow to one or two; the rest of the difference, hand it to your own workload to benchmark. **There is no universally optimal engine — only the number that ran on your own traffic.**

Three years ago, getting the model running won. Today, *how* you run it is the real dividing line.

---

*The latest-progress data here (vLLM V1, SGLang reproducing DeepSeek, TensorRT-LLM 1.0, Mooncake, Dynamo, EAGLE-3, NVFP4, etc.) comes from multi-source cross-validation of official blogs, GitHub releases, and arXiv papers; key figures are linked inline. Vendor self-reported numbers (e.g., TGI's long-context self-benchmark, third-party TRT-LLM throughput) are flagged "read critically" in the text. As of 2026-07.*
