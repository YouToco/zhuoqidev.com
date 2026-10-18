---
title: 'Is a Mac Actually Good for Running Large Language Models? The Numbers Neither Apple nor NVIDIA Puts on the Product Page'
short: 'Is a Mac actually good for local LLMs'
description: "Apple says the Mac mini offers \"fast, private, on-device inference\" and up to 13.5x faster LLM prompt processing; NVIDIA says the RTX 5090 Laptop GPU has 1,824 AI TOPS. What they compare against, how the test machines were configured, and the three numbers that decide how fast a model actually feels — memory bandwidth, the compute for reading prompts, and how much memory the GPU can really use — are not where you look first. Using the llama.cpp community's shared benchmarks across dozens of machines, a check on two machines of my own, and a re-run of Apple's own footnoted test on the 16 GB base model, this post answers, case by case, whether a Mac mini, a Mac Studio or an NVIDIA card is a good machine for running models."
date: 2026-10-18
updated: 2026-10-18
lead: "Being able to run a model and running it well are separated by a few numbers that product pages leave out. **Output speed follows memory bandwidth, reading long input follows compute, and the size you can run follows the memory the GPU can actually use.** Meanwhile one vendor compares its new Mac against an M1 from five years ago, and the other gives a desktop card and a laptop chip the same name, 5090. The verdict: a Mac mini is good for small models and Apple Intelligence, not as your main local-LLM machine; a Mac Studio is the easiest way to fit a big model, but slow at reading long input; NVIDIA cards are fastest as long as the model fits in video memory, and fall off a cliff when it does not."
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

```opener
{
  "word": "It runs.",
  "headline": "Running is not running well.",
  "sub": "A 16 GB Mac mini running a 14B model the way Apple's own footnote tests it:",
  "device": "mac-mini",
  "readouts": [
    {"label": "8K prompt · first token", "value": "15 s"},
    {"label": "16K prompt · first token", "value": "35 s"},
    {"label": "32K prompt", "value": "Crashed", "tone": "bad"}
  ],
  "note": "Qwen3-14B 4-bit · mlx-lm 0.32 · measured 2026-10-18"
}
```

*This is for anyone about to buy a machine to run large models locally and deciding from product pages. Most of the data comes from the llama.cpp community's shared benchmarks; I checked it by running the same command on the Mac mini (M6, 16 GB) and the RTX 3060 laptop I own, and re-ran Apple's own footnoted test on the 16 GB base model. How I ran everything and the full numbers are in the [appendix](#appendix-how-i-ran-it-and-the-full-numbers).*

---

## What the product pages say, and what the small print says

The two vendors' claims next to their footnotes:

| On the product page | In the small print | Not where you look first |
|---|---|---|
| Mac mini: "fast, private, on-device inference"; M6 "up to 13.5x faster with LLM prompt processing" | Compared against **the 2020 M1**; the M6 test machine had **32 GB**; the test is time to first token for a 14B model with an 8K-token prompt | No comparison with any GPU; the 16 GB entry model has 153 GB/s of bandwidth, while the page says "up to 170" |
| Mac Studio: run "frontier-class models on device — no cloud tokens needed" | M5 Ultra goes up to 512 GB, top configuration only | It reads long prompts at a third the speed of an NVIDIA card in the same output class |
| RTX 5090 Laptop GPU: 1,824 AI TOPS, "run the latest AI models locally" | 24 GB of memory, 896 GB/s | The desktop RTX 5090 has 32 GB and 1,792 GB/s: the same name, half the bandwidth |
| Desktop RTX 5090: 3,352 AI TOPS | — | The product page does not list bandwidth; a model that does not fit in 32 GB will not run, whatever the TOPS |

Neither vendor says anything false, but both put compute front and centre. The trouble is that **the thing you wait for most when running a large model — tokens coming out one by one — barely depends on compute.**

---

## Running a model really compares three things

### 1. How fast it writes: memory bandwidth

A model writes one token at a time. For each token the GPU reads **all of the weights** out of memory and multiplies them with a tiny bit of fresh state. The multiplying is quick; the reading is slow. So single-user output speed has a rough but useful ceiling:

> **Output speed ≈ memory bandwidth ÷ bytes the model occupies**

llama.cpp has two community benchmark threads ([Apple Silicon](https://github.com/ggml-org/llama.cpp/discussions/4167), [NVIDIA](https://github.com/ggml-org/llama.cpp/discussions/15013)) where people post results from the same model and the same command. I first ran that command on my two machines to check: 75.2 on my RTX 3060 laptop against 76.9 for a community 3060 desktop, 35.0 on my Mac mini M6 against 35.7 for a community Mac mini M6. A 2–4 % gap, so the data is trustworthy. Sorted by bandwidth:

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
    {"x": 153, "y": 35.0, "label": "Mac mini M6", "color": "blue", "side": "right"},
    {"x": 614, "y": 119.9, "label": "M5 Max", "color": "blue", "side": "right"},
    {"x": 1228, "y": 179.1, "label": "M5 Ultra", "color": "blue", "side": "right"},
    {"x": 896, "y": 158.1, "label": "Laptop 5090", "color": "seal", "side": "left"},
    {"x": 1008, "y": 189.0, "label": "4090", "color": "seal", "side": "left"},
    {"x": 1792, "y": 300.4, "label": "Desktop 5090", "color": "seal", "side": "left"}
  ],
  "caption": "Llama 2 7B at 4 bits, llama.cpp single-user output speed. From the llama.cpp community threads; the Mac mini M6 (16 GB) and 3060 laptop points are my own check runs on 2026-10-17. Bandwidth is the vendor's rated figure (Apple only states \"1.2 TB/s\" for the M5 Ultra; I use 1,228, twice the M5 Max). Software versions differ between entries, so read the order of magnitude."
}
```

It is nearly a straight line. Every machine uses only 56–88 % of its rated bandwidth, but the ranking is set entirely by bandwidth: the M5 Ultra has a fifth more bandwidth than the 4090 and writes at about the same speed; the desktop 5090 has twice the laptop 5090's bandwidth and writes nearly twice as fast. **Both are called 5090; they sit far apart on the line.**

### 2. How fast it reads long input: compute

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
    {"label": "Desktop RTX 5090", "sub": "32 GB", "value": 14970, "color": "seal"},
    {"label": "RTX 4090", "sub": "24 GB", "value": 14771, "color": "seal"},
    {"label": "Laptop RTX 5090", "sub": "24 GB", "value": 7642, "color": "seal"},
    {"label": "M5 Ultra", "sub": "up to 512 GB", "value": 4945, "color": "blue"},
    {"label": "M5 Max", "sub": "up to 128 GB", "value": 3220, "color": "blue"},
    {"label": "RTX 3060 laptop", "sub": "6 GB", "value": 2311, "color": "seal"},
    {"label": "Mac mini M6", "sub": "16 GB", "value": 1016, "color": "blue"}
  ],
  "caption": "Prompt-reading speed (tokens/s), Llama 2 7B at 4 bits, 512-token prompt. Community threads; the 3060 laptop and Mac mini are my own check runs."
}
```

The 4090 and the M5 Ultra write at about the same speed, yet read prompts three times apart. You will not notice in a short chat; but ask it to read a code repository, a contract dozens of pages long, or run it as an Agent calling tools turn after turn — rereading an ever-longer context every turn — and three times is three times the wait.

### 3. How big a model: the memory the GPU can actually use

Bandwidth decides how fast; **capacity decides whether at all**. A model that does not fit runs at zero. Both vendors print the total; neither prints how much you can actually use:

- **A Mac's GPU cannot use all of the unified memory.** On my 16 GB Mac mini, llama.cpp reads a GPU limit of 12.7 GB from the system at start-up, about 79 %, and it shares that with the OS, the browser and your editor.
- **An NVIDIA card's video memory is a hard limit.** Whatever does not fit goes back to CPU memory, and speed drops by an order of magnitude (measured below). The largest consumer card, the desktop 5090, has 32 GB.

> [!NOTE]
> A rough rule: a 4-bit model takes about 0.6 GB per billion parameters, plus 20–30 % for context (the KV cache) and the runtime. By that rule, about 12 GB usable by the GPU is only enough for the 14B class, 24–32 GB keeps a 30B-class model, 128 GB keeps 100–150B, and only 512 GB reaches 600B-class MoE models. It is an estimate; the real figure depends on the model and the quantization format.

---

## Apple's footnoted test, re-run on the base model

Apple's "13.5x faster" uses a 14B model at 4 bits with an 8K-token prompt and measures time to first token, on a 32 GB machine. I ran the same conditions on a 16 GB Mac mini (MLX, mlx-lm) and added 16K and 32K prompts — Agent work routinely reaches tens of thousands of tokens of context. I also tried the same model on the 3060 laptop with 6 GB of video memory.

```chart
{
  "type": "bars",
  "fmt": {"suf": " s", "digits": 1},
  "legend": [
    {"color": "blue", "label": "Mac mini M6 16 GB (all on the GPU)"},
    {"color": "seal", "label": "RTX 3060 laptop 6 GB (only half fits)"}
  ],
  "rows": [
    {"label": "2K prompt", "sub": "Mac mini", "value": 3.4, "color": "blue"},
    {"label": "8K prompt", "sub": "Mac mini (Apple's footnote conditions)", "value": 15.4, "color": "blue"},
    {"label": "16K prompt", "sub": "Mac mini", "value": 34.6, "color": "blue"},
    {"label": "8K prompt", "sub": "3060 laptop, half the layers on the GPU", "value": 21.0, "color": "seal"}
  ],
  "caption": "Qwen3-14B at 4 bits, wait from sending the prompt to the first token (seconds). Mac mini on mlx-lm 0.32, 3060 laptop on llama.cpp b11696. Measured 2026-10-18, average of two runs each. A 32K prompt does not run on the Mac mini, so it is not drawn."
}
```

- **With an 8K prompt the first token takes 15 seconds**, then 15 tokens a second. Bearable for everyday questions — and these are the conditions Apple chose.
- **16K takes 35 seconds**, and output drops to 13 tokens a second; GPU memory reaches 11.5 GB, just short of the 12.7 GB the system allows.
- **32K crashes**: Metal reports the GPU is out of memory and the program exits. A 14B model with 32K of context does not run on the 16 GB base model at all — and an Agent reading a code repository reaches that size routinely.
- **The 3060 laptop cannot even hold the model**: the 14B needs 8.2 GB, the 6 GB card takes half, the rest runs on the CPU, and output falls to 4.8 tokens a second; all on the CPU it is 2.5. The same card does 75 on a 7B that fits. **NVIDIA's wall is not slowness; past the line it collapses.**

> [!TIP]
> One more thing no product page tells you: **the MLX version matters**. My first install of mlx-lm picked the system Python 3.9, which only gets an old MLX (0.29); the same 8K prompt took 55 seconds to the first token — 3.6 times slower, because the old version cannot use the Neural Accelerators in the M6 GPU. Reinstalling with Python 3.13 and MLX 0.32 gave the numbers above. The same goes for LM Studio or Ollama: check that the MLX it ships is recent.

---

## What Apple does not put up front

1. **Bandwidth follows the configuration, and the page says "up to".** The Mac mini M6 page says "up to 170GB/s"; the 16 GB entry model has 153. The Mac Studio page lists 614 GB/s for the M5 Max — that is the 40-core-GPU version; the 32-core entry version has 460. On the line above, a tenth less bandwidth is a tenth slower output.
2. **The GPU cannot use all of the unified memory.** 16 GB gives the GPU about 12.7 GB, before subtracting whatever else you have open.
3. **Reading long input is the weak spot.** Every "X times faster" Apple quotes is against older Macs; against an NVIDIA card at the same price, prompt reading is two to three times slower. On the 16 GB base model a 14B with an 8K prompt waits 15 seconds and 32K does not run — and Agents, code repositories and long documents are exactly how "local AI" gets used most.
4. **The software version decides whether you get the new hardware.** An old MLX cannot use the M6's Neural Accelerators and reads prompts 3.6 times slower.
5. **Its real strength is capacity.** A Mac Studio holds up to 128 GB / 512 GB of unified memory; one machine fits a model that would take several NVIDIA cards, and it is quiet and frugal. On this point the marketing does not exaggerate.

## What NVIDIA does not put up front

1. **Video memory is a hard limit.** However high the AI TOPS on the page, a model that does not fit in video memory falls off a cliff.
2. **The laptop and the desktop share a name, not a spec.** Laptop 5090: 24 GB, 896 GB/s; desktop 5090: 32 GB, 1,792 GB/s. Same with the 3060: 6 GB on laptops, 12 GB on the desktop card. On a laptop, look at the memory and bandwidth, not the model number.
3. **AI TOPS is about reading the prompt.** Output speed follows bandwidth, and the desktop 5090's product page happens not to list it.
4. **Power and noise.** One desktop 5090 draws 575 W and wants a 1,000 W power supply; a Mac Studio under full load stays far below that.

---

## So is a Mac good for running large models?

| What you want to do | Is a Mac a good fit? | A better fit |
|---|---|---|
| Apple Intelligence, a 4B–8B model now and then, writing code | **Yes**; a Mac mini is enough | — |
| A 14B-class model as an everyday assistant, or an Agent reading a code repository | **Not really**: on the 16 GB base model an 8K prompt waits 15 seconds and 32K does not run; 32 GB fits it but still reads long input slowly | A desktop NVIDIA card with 16 GB or more |
| A 30B-class model for yourself, fast | **So-so**: it takes a Mac Studio to fit; output on par with a 4090, slow on long input | A 24–32 GB desktop NVIDIA card (4090, 5090) |
| 100B and up, fitting matters more than speed | **Best fit**: one Mac Studio with 128 GB / 512 GB holds it; NVIDIA needs several cards | — |
| Many users at once, fast reading, long context | **No** | Several workstation cards, or just buy API tokens |

China prices for reference (apple.com.cn, 2026-10-18): Mac mini M6 16 GB from ¥6,999; Mac Studio M5 Max from ¥19,999; M5 Ultra from ¥46,999.

In one line: **a Mac is the easiest machine to fit a model on, not the fastest machine to run it on.** The Mac mini's marketing suggests it is the natural entry point for local LLMs, but for running large models it sits closer to "it runs, the experience is so-so"; what makes a Mac worth its price here is the large memory of the Mac Studio tier.

---

## Further up: power and borders

If you keep going — an 8-GPU data-center server, the newest data-center GPU — you hit two ceilings that have nothing to do with performance:

- **Power**: one NVIDIA DGX Rubin NVL8 draws about 24 kW and needs direct-to-chip liquid cooling; an ordinary socket in a Chinese home is 10 A (about 2.2 kW), and even the 16 A socket for an air conditioner gives about 3.5 kW.
- **Borders**: the Blackwell and Rubin data-center GPUs are barred from sale to China, with no sign of a licence as of October 2026; the full RTX PRO 6000 (96 GB) is also above the control threshold, and China gets the export-edition RTX PRO 6000D (according to teardowns, 84 GB and about 17 % fewer cores).

Beyond that, you rent GPUs or buy tokens.

---

## Limitations

- The community numbers only cover a 7B model, one user, a 512-token prompt and llama.cpp; entries use different software versions, and newer versions alone are 10–30 % faster, so read the order of magnitude.
- My re-run covers one 16 GB Mac mini and, on the Mac, one engine (mlx-lm), while Apple's test used LM Studio; I did not measure the 32 GB version or a Mac Studio. The 14B numbers use Qwen3-14B, which may not be the model in Apple's footnote.
- Prices and export controls are as checked on 2026-10-18 and change quickly; the 6000D specs come from teardowns and benchmarks, not from NVIDIA.

---

## Sources

- Product pages and footnotes: Apple [Mac mini](https://www.apple.com/mac-mini/) ([Chinese edition](https://www.apple.com.cn/mac-mini/); footnote 6 gives the conditions for "13.5x"), [Mac Studio](https://www.apple.com/mac-studio/); NVIDIA [RTX 5090](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/), [RTX 50 Series laptops](https://www.nvidia.com/en-us/geforce/laptops/50-series/). All read on 2026-10-18.
- Benchmarks: llama.cpp community threads [Apple Silicon #4167](https://github.com/ggml-org/llama.cpp/discussions/4167) and [NVIDIA #15013](https://github.com/ggml-org/llama.cpp/discussions/15013) (raw posts fetched 2026-10-17).
- Specs: [NVIDIA GPU comparison](https://www.nvidia.com/en-us/geforce/graphics-cards/compare/), [RTX 3060 Laptop GPU (Notebookcheck)](https://www.notebookcheck.net/NVIDIA-GeForce-RTX-3060-Mobile-GPU-Benchmarks-and-Specs.497453.0.html); Apple [Mac mini specs](https://www.apple.com/mac-mini/specs/), [Mac Studio specs](https://www.apple.com/mac-studio/specs/); China prices from [apple.com.cn](https://www.apple.com.cn/shop/buy-mac/mac-studio).
- Power and sockets: [DGX Rubin NVL8](https://www.nvidia.com/en-us/data-center/dgx-rubin-nvl8/); Chinese standard [GB 1002-2024](https://www.chinesestandard.net/PDF/English.aspx/GB1002-2024).
- Export controls: [Tom's Hardware on the 6000D](https://www.tomshardware.com/pc-components/gpus/nvidia-rtx-pro-6000d-b40-blackwell-gpus-reportedly-set-to-supersede-banned-h20-accelerators-in-china), [PCGH teardown](https://www.pcgameshardware.de/Grafikkarten-Grafikkarte-97980/News/Nvidia-RTX-6000D-mit-84-GiByte-GDDR7-1487562/).

---

## Appendix: how I ran it and the full numbers

<details>
<summary>How the check and the re-run were done</summary>

```bash
# The same command as the community benchmark (llama.cpp b11696 official prebuilt binaries)
llama-bench -m llama-2-7b.Q4_0.gguf -ngl 99 -fa 0,1 -p 512 -n 128

# Apple's footnote 6 conditions: 14B, 4 bits, 8K prompt, time to first token (plus 16K and 32K)
mlx_lm.benchmark --model mlx-community/Qwen3-14B-4bit -p 8192 -g 128 -n 2
```

</details>

<details>
<summary>Full numbers for my two check machines</summary>

| Item | RTX 3060 laptop (6 GB) | Mac mini M6 (16 GB) |
|---|---|---|
| Llama 2 7B 4-bit output / prompt reading (tokens/s) | 75.2 / 2,311 | 35.0 / 1,016 |
| Qwen3-4B 4-bit single-user output (fastest engine) | 96 | 56 (MLX) |
| Qwen3-4B 4-bit, 8 at once (engine benchmark) | 296 | 256 (llama.cpp) |
| Memory the GPU can use | 6 GB of video memory | about 12.7 GB (system limit) |
| Qwen3-14B 4-bit, 8K prompt: first token / output | 21.0 s / 4.8 tokens/s (only half fits, 20 of 40 layers) | 15.4 s / 14.8 tokens/s (mlx-lm 0.32) |
| Qwen3-14B 4-bit, first token at 16K / 32K | not measured | 34.6 s / out of GPU memory, crashed |

</details>
