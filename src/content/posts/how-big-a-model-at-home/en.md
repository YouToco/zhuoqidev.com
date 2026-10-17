---
title: 'How Big a Model Can One Person Keep at Home? From a Mac mini vs RTX 3060 Benchmark to Three Walls: Memory, Power and Borders'
short: 'How big a model one person can keep at home'
description: "I spent three days benchmarking a Mac mini M6 against an RTX 3060 laptop, then kept asking about Mac Studio, the 4090, a 1M-context workstation that lasts five years, and finally data-center servers and export controls. Looking back, it was one question all along: how much AI can one person own? The answer is not set by compute but by three walls — memory decides how big a model fits and how fast it talks, power decides how many cards you can stack, and borders decide which cards you can buy."
date: 2026-10-18
updated: 2026-10-18
lead: "At home, compute is almost never the first bottleneck. **Every token the model writes means reading the whole model out of memory once**, so output speed follows memory bandwidth, the size you can run follows memory capacity, and compute only matters while the prompt is being read. Beyond that, a socket at home gives you 2.2–3.5 kW at most, and the best cards cannot be bought in mainland China. In October 2026, the ceiling for one person at home is roughly one Mac Studio or one or two export-edition workstation cards; anything bigger, you rent."
tags:
  - Local LLM
  - Hardware
  - Apple Silicon
  - NVIDIA
  - llama.cpp
  - Memory Bandwidth
  - Benchmarks
categories:
  - Deep Dives
---

*This is for engineers who want to run large models on their own machines and are stuck on what to buy. The first part benchmarks two machines, the middle explains what running a model actually stresses, and the second half follows the three walls up to the ceiling. How I ran everything and the full numbers are in the [appendix](#appendix-how-i-ran-it-and-the-full-numbers).*

---

## I was asking the same question all along

Over three days I asked a string of questions that looked unrelated:

1. My new Mac mini M6 or my RTX 3060 laptop: which one writes code faster, trains faster, runs models faster?
2. Once the Mac uses the frameworks that suit it best (MLX, oMLX), can it catch the 3060 at running models?
3. Then where do Mac Studio, the 4090 and the 5090 land?
4. If I want a 1M-context, vision-capable, genuinely smart model locally, what should I buy to last five years?
5. Could I just buy a data-center server and get the newest Rubin GPUs?

In hindsight they are five steps of one question: **how much AI can one person own?** Each step ran into a new wall.

| Step | Wall | In one line |
|---|---|---|
| 1–3 | Memory | Output speed follows bandwidth; whether it fits follows capacity |
| 4 | Memory (KV) | The bill for 1M tokens of context is almost entirely KV-cache memory |
| 5 | Power, borders | A home cannot power a 24 kW machine; the best cards cannot be bought |

One wall at a time.

---

## Where I started: a Mac mini and a 3060 laptop

The two machines:

- **Mac mini (M6, 16 GB unified memory, ¥6,999 in China)**: 12-core CPU (2 + 4 + 6 cores in three tiers), 12-core GPU.
- **Ubuntu laptop (i7-12700H, 32 GB RAM, RTX 3060 Laptop GPU with 6 GB)**.

Both ran the same scripts on the work I actually do. The results split three ways, which turned out to be the three directions of this post:

```chart
{
  "type": "bars",
  "fmt": {"suf": "×", "digits": 1},
  "ref": {"value": 1, "label": "Even"},
  "legend": [
    {"color": "blue", "label": "Mac mini faster"},
    {"color": "seal", "label": "3060 laptop faster"}
  ],
  "rows": [
    {"label": "Full test suite", "sub": "real project, 5,139 tests", "value": 2.1, "color": "blue"},
    {"label": "TypeScript type check", "sub": "same project", "value": 2.4, "color": "blue"},
    {"label": "Front-end build", "sub": "same project", "value": 2.4, "color": "blue"},
    {"label": "Train a small CNN", "sub": "fastest framework on each", "value": 2.7, "color": "seal"},
    {"label": "Train a small Transformer", "sub": "fastest framework on each", "value": 1.4, "color": "seal"},
    {"label": "Generate with a 4B model", "sub": "one user, fastest engine on each", "value": 1.7, "color": "seal"}
  ],
  "caption": "How many times faster (faster side ÷ slower side). Measured 2026-10-15 to 10-17, several runs each, stable values."
}
```

For writing code and running tests the Mac is more than twice as fast; anything that touches the GPU flips the other way. The last row surprised me most: even on Apple's own MLX, and on oMLX with its SSD cache, **the Mac tops out at 56 tokens a second for one user, against 96 on the 3060**.

Why does a laptop GPU from a six-year-old architecture out-talk a brand-new Mac? Not because of compute.

---

## The first wall: memory

### Every token means reading the whole model once

A model writes one token at a time. For each token the GPU has to read **all of the weights** out of video memory (or unified memory) and multiply them with a tiny bit of fresh state. The multiplying is quick; the reading is slow.

So single-user output speed has a rough but useful ceiling:

> **Output speed ≈ memory bandwidth ÷ bytes the model occupies**

A 7B model quantized to 4 bits takes about 3.8 GB. The 3060 Laptop GPU has about 336 GB/s of memory bandwidth: that is 88 passes a second, and I measured 75, 86 % of the ceiling. My 16 GB Mac mini M6 has 153 GB/s (only the 32 GB version gets 170): a ceiling of 40, measured 35. **The 3060 wins because its memory moves more than twice as fast, not because it computes faster.**

This holds well beyond my two machines. llama.cpp has two community benchmark threads ([Apple Silicon](https://github.com/ggml-org/llama.cpp/discussions/4167), [NVIDIA](https://github.com/ggml-org/llama.cpp/discussions/15013)) where people post results from the same model and the same command. I ran that command on both of my machines first to check: 75.2 on my 3060 laptop against 76.9 for a community 3060 desktop, 35.0 on my M6 against 35.7 for a community Mac mini M6. A 2–4 % gap, so the data is trustworthy. Sorted by bandwidth:

```chart
{
  "type": "line",
  "fmt": {"digits": 0},
  "x": {"label": "Memory bandwidth (GB/s)", "min": 0, "max": 1900, "ticks": [0, 300, 600, 900, 1200, 1500, 1800]},
  "y": {"label": "Output speed (tokens/s)", "max": 320, "ticks": [0, 80, 160, 240, 320]},
  "series": [
    {"label": "NVIDIA", "color": "seal", "points": [[288, 64.0], [336, 75.2], [360, 76.9], [896, 158.1], [936, 161.9], [1008, 189.0], [1792, 300.4]]},
    {"label": "Apple Silicon", "color": "blue", "points": [[153, 35.0], [170, 35.7], [307, 66.3], [614, 119.9], [1228, 179.1]]}
  ],
  "marks": [
    {"x": 336, "y": 75.2, "label": "My 3060 laptop", "color": "seal", "side": "right"},
    {"x": 153, "y": 35.0, "label": "My Mac mini M6", "color": "blue", "side": "right"},
    {"x": 1008, "y": 189.0, "label": "4090", "color": "seal", "side": "left"},
    {"x": 1228, "y": 179.1, "label": "M5 Ultra", "color": "blue", "side": "right"},
    {"x": 1792, "y": 300.4, "label": "5090", "color": "seal", "side": "left"}
  ],
  "caption": "Llama 2 7B at 4 bits, llama.cpp single-user output speed. My two machines measured 2026-10-17; the rest from the llama.cpp community threads (software versions differ, so read the order of magnitude). Bandwidth is the vendor's rated figure (Apple only states \"1.2 TB/s\" for the M5 Ultra; I use 1,228, twice the M5 Max)."
}
```

It is nearly a straight line. Every machine uses only 56–88 % of its rated bandwidth, but the ranking is set entirely by bandwidth: the M5 Ultra has a fifth more bandwidth than the 4090 and writes at about the same speed; the 5090 has close to 1.8 times the 4090's bandwidth and writes 1.6 times faster.

### Compute only matters while the prompt is read

If bandwidth explains output, what are you paying for in an NVIDIA card? Reading the prompt.

When the model reads the text you give it (prefill), it processes thousands of tokens at once, and only then does compute become the bottleneck. The gap opens up at once:

```chart
{
  "type": "bars",
  "fmt": {"digits": 0},
  "legend": [
    {"color": "seal", "label": "NVIDIA"},
    {"color": "blue", "label": "Apple Silicon"}
  ],
  "rows": [
    {"label": "RTX 5090", "sub": "32 GB", "value": 14970, "color": "seal"},
    {"label": "RTX 4090", "sub": "24 GB", "value": 14771, "color": "seal"},
    {"label": "M5 Ultra", "sub": "up to 512 GB", "value": 4945, "color": "blue"},
    {"label": "M5 Max", "sub": "up to 128 GB", "value": 3220, "color": "blue"},
    {"label": "My 3060 laptop", "sub": "6 GB", "value": 2311, "color": "seal"},
    {"label": "My Mac mini M6", "sub": "16 GB", "value": 1016, "color": "blue"}
  ],
  "caption": "Prompt-reading speed (tokens/s), Llama 2 7B at 4 bits, 512-token prompt. Community threads plus my two machines."
}
```

The 4090 and the M5 Ultra write at about the same speed, yet read prompts three times apart. You will not notice it in a short chat, but feed it a whole book or a code repository and three times is three times the wait.

### Capacity decides how big a model you can keep

Bandwidth decides how fast; **capacity decides whether at all**. A model that does not fit runs at zero.

My 3060 has 6 GB of video memory: 4B and 7B models at 4 bits fit, a 27B does not. The Mac mini has 16 GB of unified memory, but the GPU cannot use all of it; the largest single tensor I could place was 8 GB. This is where Apple's approach shows: a Mac Studio with the M5 Max (40-core GPU) goes up to 128 GB and the top M5 Ultra up to 512 GB (on sale only from late October), while the largest consumer NVIDIA card, the 5090, has 32 GB. Apple's bandwidth also follows the configuration: the 32-core-GPU entry M5 Max has only 460 GB/s.

> [!NOTE]
> A rough rule: a 4-bit model takes about 0.6 GB per billion parameters, plus 20–30 % for context (the KV cache) and the runtime. By that rule, 32 GB keeps a ~30B dense model, 128 GB keeps 100–150B, and only 512 GB reaches 600B-class MoE models. It is an estimate; the real figure depends on the model and the quantization format.

So the first wall is really three things twisted together: **capacity decides how big, bandwidth decides how fast it writes, compute decides how fast it reads.** The Mac wins on capacity, NVIDIA on compute, and bandwidth goes either way.

### 1M tokens of context: a memory bill that is almost all KV

Next I asked: to run a **1M-context, vision-capable, dense, genuinely smart** model locally, what should I buy to last five years?

That question pushes the first wall to its extreme. For every token the model reads, it stores that token's "keys" and "values" at every layer and looks them up again while writing — the KV cache. The longer the context, the larger it grows, and it competes with the weights for the same memory.

The model I picked is [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B) (released 2026-08-14, dense, vision-capable). Only 16 of its 64 layers use full attention; the other 48 use linear attention with a fixed-size state, so its KV cache is small:

```text
KV per token = 16 layers × 2 (keys, values) × 4 KV heads × 256 dims × 2 bytes = 64 KiB
1M tokens    ≈ 64 GiB
```

```chart
{
  "type": "stack",
  "fmt": {"suf": " GB"},
  "series": [
    {"key": "w", "label": "Model weights", "color": "blue"},
    {"key": "kv", "label": "KV cache for 1M tokens", "color": "seal"}
  ],
  "rows": [
    {"label": "Full precision", "sub": "weights and KV at 16 bits", "values": {"w": 56, "kv": 69}},
    {"label": "Down to 8 bits", "sub": "weights and KV at 8 bits", "values": {"w": 28, "kv": 34}}
  ],
  "caption": "Memory to run Qwen3.8-27B at a full 1M-token context (GB), computed from the official configuration, runtime overhead excluded. One 96 GB workstation card holds the 8-bit row; full precision needs two."
}
```

With weights at 8 bits (about 28 GB) and the KV cache at 8 bits (about 34 GB), the total is about 62 GB — **one 96 GB workstation card is just enough; full precision needs two**. Swap in a 32B model with full attention on every layer and the same 1M tokens need 256 GiB of KV: four cards to start.

A Mac Studio holds the full-precision row only with 128 GB or more; the cheapest in China, a 96 GB M5 Ultra (from ¥46,999), only holds the 8-bit one. And even with the capacity, it runs into compute: reading 1M tokens cold, at the rate an M5 Ultra reads a 27B model, comes to more than half an hour by my estimate; a workstation card takes minutes to ten minutes. **Fitting is not the same as usable.**

---

## The second wall: power

Then one more step: skip the workstation and buy an 8-GPU data-center server?

NVIDIA's newest DGX Rubin NVL8 packs eight Rubin GPUs into one machine, rated at **about 24 kW per system**, with direct-to-chip liquid cooling, a full rack and a coolant distribution unit. An ordinary socket in a Chinese home is 10 A, about 2.2 kW; even the 16 A socket for an air conditioner or water heater gives about 3.5 kW.

```chart
{
  "type": "bars",
  "fmt": {"suf": " W"},
  "ref": {"value": 3520, "label": "A 16 A home socket, 220 V × 16 A"},
  "rows": [
    {"label": "DGX Rubin NVL8", "sub": "8-GPU data-center server", "value": 24000, "color": "seal"},
    {"label": "Two RTX PRO 6000", "sub": "Workstation Edition", "value": 1200, "color": "gold"},
    {"label": "Two RTX PRO 6000", "sub": "Max-Q Edition", "value": 600, "color": "gold"},
    {"label": "RTX 5090", "sub": "one card", "value": 575, "color": "gray"}
  ],
  "caption": "Rated GPU or system power only; CPU, fans and air conditioning excluded."
}
```

Seven times what even the heaviest socket delivers, before cooling: nearly all of those 24 kW become heat that no ordinary room can carry away. **For one person at home, the electricity meter is the second wall**; past it, it is no longer "at home".

---

## The third wall: borders

The last wall is the hardest one in mainland China.

- The Blackwell and Rubin generations of **data-center GPUs are barred from sale to China**, with no sign of a licence as of October 2026, so the server route is closed there.
- The full RTX PRO 6000 (96 GB) I recommended above **is also above the control threshold**. China gets an export edition, the **RTX PRO 6000D**: according to teardowns, 84 GB of memory and about 17 % fewer cores (NVIDIA has not published its specs). The FT reports that Chinese companies have bought more than a million such export-edition cards this year: you can get one, it is just one notch weaker than the full version.
- 84 GB still holds the 8-bit 1M-context plan above (about 62 GB), and two of them (168 GB) hold full precision — just a little slower and a little dearer.

> [!WARNING]
> Do not buy the full version through grey channels. The rules keep changing; check the latest notices and prices before you buy.

So in mainland China the third wall pushes the ceiling down one more notch.

---

## So how big a model can one person keep at home?

Stack the three walls and the answer for October 2026 looks roughly like this:

| You want | A sensible choice at home | The wall you hit |
|---|---|---|
| Write code, run tests, now and then a 4B–8B model | A Mac mini or a laptop with an NVIDIA GPU; either is enough | None yet |
| A ~30B model for yourself, fast output | A 24–32 GB NVIDIA card (4090, 5090) | Capacity |
| 100B and up, fitting matters more than speed | A Mac Studio (from ¥19,999 in China; M5 Max up to 128 GB, M5 Ultra from ¥46,999, up to 512 GB) | Compute (slow on long input) |
| 1M context, dense, vision, five years | 1–2 × 96 GB workstation cards (6000D in mainland China) + a large-memory workstation | The edge of power and borders |
| Frontier scale, many users at once | Not at home; rent GPUs or buy API tokens | All three |

**When it is worth keeping one at home**: you want privacy, offline use and unlimited retries, and the model is under about 100B.
**When to stop**: you want the smartest model, or long context read quickly — then a yuan spent on tokens goes much further than a yuan spent on hardware.

I work at a company that resells model APIs, so every day I watch other people's tokens being sold. After this round of testing I feel more settled about buying tokens, not less: **what you keep at home is the part you can fully own; everything above it was never meant for one person to carry.**

---

## Limitations

- The community numbers only cover a 7B model, one user and a 512-token prompt, and only llama.cpp. Concurrency, long context, MLX and vLLM need their own tests; the entries use different software versions, and newer versions alone are 10–30 % faster, so read the order of magnitude.
- The 1M cold-read times are estimates scaled from the 7B results, not measurements.
- Prices and export controls are as checked on 2026-10-18 and change quickly; the 6000D specs come from teardowns and benchmarks, not from NVIDIA.

---

## Sources

- Benchmarks: llama.cpp community threads [Apple Silicon #4167](https://github.com/ggml-org/llama.cpp/discussions/4167) and [NVIDIA #15013](https://github.com/ggml-org/llama.cpp/discussions/15013) (raw posts fetched 2026-10-17).
- Bandwidth and specs: [NVIDIA GPU comparison](https://www.nvidia.com/en-us/geforce/graphics-cards/compare/), [50 Series laptops](https://www.nvidia.com/en-us/geforce/laptops/50-series/), [RTX 3060 Laptop GPU (Notebookcheck)](https://www.notebookcheck.net/NVIDIA-GeForce-RTX-3060-Mobile-GPU-Benchmarks-and-Specs.497453.0.html); Apple [Mac mini specs](https://www.apple.com/mac-mini/specs/), [Mac Studio specs](https://www.apple.com/mac-studio/specs/), [Mac Studio announcement](https://www.apple.com/newsroom/2026/08/apple-introduces-new-mac-studio-with-m5-max-and-m5-ultra/); China prices from [apple.com.cn](https://www.apple.com.cn/shop/buy-mac/mac-studio).
- Model: [Qwen3.8-27B model card](https://huggingface.co/Qwen/Qwen3.8-27B) and [config.json](https://huggingface.co/Qwen/Qwen3.8-27B/blob/main/config.json).
- Power: [DGX Rubin NVL8](https://www.nvidia.com/en-us/data-center/dgx-rubin-nvl8/), [RTX PRO 6000](https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000/), [RTX PRO 6000 Max-Q](https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000-max-q/); sockets: Chinese standard [GB 1002-2024](https://www.chinesestandard.net/PDF/English.aspx/GB1002-2024).
- Export controls: [Tom's Hardware on the 6000D](https://www.tomshardware.com/pc-components/gpus/nvidia-rtx-pro-6000d-b40-blackwell-gpus-reportedly-set-to-supersede-banned-h20-accelerators-in-china), [PCGH teardown](https://www.pcgameshardware.de/Grafikkarten-Grafikkarte-97980/News/Nvidia-RTX-6000D-mit-84-GiByte-GDDR7-1487562/), [FT, 2026-10-13](https://www.ft.com/content/9dbd99db-6b0c-43bd-b7be-849f129df098) (paywalled).

---

## Appendix: how I ran it and the full numbers

<details>
<summary>How the two machines were tested</summary>

```bash
# The same command as the llama.cpp community benchmark (official b11696 prebuilt binaries)
llama-bench -m llama-2-7b.Q4_0.gguf -ngl 99 -fa 0,1 -p 512 -n 128
```

- Everyday development: one Python script covering single-core and all-core CPU, numpy, disk, developer tools, and a real TypeScript project's type check, full test suite (5,139 tests) and front-end build.
- GPU training: PyTorch at fp32 / mixed precision / mixed precision + compile on both, plus three MLX tiers on the Mac; the fastest tier on each side is compared.
- Model inference: Qwen3-4B-Instruct at 4 bits, llama.cpp (both), mlx-lm and oMLX (Mac); one user, 1 / 4 / 8 concurrent requests, and a 6k-token prefix read cold and warm.

</details>

<details>
<summary>Full numbers</summary>

| Item | 3060 laptop | Mac mini M6 |
|---|---|---|
| Full test suite (4 shards) | 136 s | 65 s |
| Type check | 7.9 s | 3.3 s |
| Front-end build | 72.5 s | 30.8 s |
| Small CNN training (fastest tier) | 8,718 images/s | 3,222 images/s |
| Small Transformer training (fastest tier) | 88,856 tokens/s | 64,401 tokens/s |
| 4B model, one user, output (fastest engine) | 96 tokens/s | 56 tokens/s (MLX) |
| 4B model, 8 at once (engine benchmark) | 296 tokens/s | 256 tokens/s (llama.cpp) |
| 6k prefix read again after a restart | Recomputed from scratch | 0.28 s (oMLX keeps it on SSD) |
| Llama 2 7B at 4 bits, output / prompt reading | 75.2 / 2,311 | 35.0 / 1,016 |

</details>
