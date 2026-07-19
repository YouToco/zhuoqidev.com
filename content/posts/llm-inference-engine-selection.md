---
title: "LLM 推理引擎怎么选——2026 年从本地单机到 PD 分离的全景选型地图"
description: "阿里云那张 Ollama / vLLM / SGLang / HF Pipeline 四引擎表在 2026 年已经不够用了。这篇把推理引擎按「本地 → 高性能服务 → 分布式分离」三层重新梳理，覆盖 8 个主流引擎和 PD 分离 / 投机解码 / FP4 量化三大新趋势，附决策矩阵和决策树。"
date: 2026-07-19
tags: ["LLM", "推理引擎", "vLLM", "SGLang", "模型部署", "推理优化", "选型指南", "调研报告"]
categories: ["调研报告"]
showToc: true
---

阿里云 CAP 有一篇讲推理引擎选型的文章，把候选收敛到四个：**Ollama、vLLM、SGLang、Hugging Face Pipeline**。这个划分在 2024 年是够用的。

但到 2026 年，它至少漏掉了半张地图——NVIDIA 的 TensorRT-LLM 完成了「PyTorch 化」转身、SGLang 因为首个开源复现 DeepSeek 大规模部署而封神、Hugging Face 自己给 TGI 挂上了「维护模式」横幅并劝你改用 vLLM，而整个 2025 年推理引擎领域真正的主线，其实是一个字：**拆**。

这篇文章把这张地图更新到 2026 年年中。它不替你拍板选哪个产品——**它给你一套分层框架、一张决策矩阵和一棵决策树，让你自己把候选收敛到 1–2 个。**

---

## 为什么 2026 年「选推理引擎」才是个真问题

三年前不需要纠结这个。那时候能把一个 7B 模型在 GPU 上跑起来、返回还算流畅的 token 流，就已经过关。

现在情况变了，原因有三个：

1. **模型能力在趋同，部署形态在分化。** 开源侧从 Llama、Qwen 到 DeepSeek-V3/R1、Kimi K2，能力差距在缩小；真正拉开差距的，变成了「你能不能把它高效、低成本、稳定地跑起来」。同一个 DeepSeek-R1，有人一张 4090 勉强跑起来做原型，有人用 96 张 H100 做到接近官方吞吐、成本压到官方 API 的五分之一——差的就是推理引擎和部署架构。
2. **大规模 MoE 把推理从「单卡工程」推成了「分布式系统工程」。** DeepSeek-V3 是 671B 总参 / 37B 激活，Kimi K2 更是 1T 总参。这类模型单机放不下，必须跨节点做专家并行（EP），推理引擎的选择直接决定了你要不要碰 all-to-all 通信、专家负载均衡这些硬骨头。
3. **同一个模型，引擎之间的吞吐/成本差异可以到数倍。** 这不是「快一点点」的差别，是「同样的卡，能不能多服务几倍用户」的差别，直接写进云账单。

所以选型不再是「随便挑一个能跑的」，而是**先想清楚你在地图的哪一层**。

---

## 一句话全景：八个引擎的定位速查表

先给结论。下面这张表把 2026 年主流引擎放在一起，一眼看清各自的位置：

| 引擎 | 主导方 | 核心机制一句话 | 最新版本（截至 2026-07） | 典型定位 |
|---|---|---|---|---|
| **vLLM** | 社区 / Red Hat | PagedAttention + V1 全异步引擎 | v0.25.x（2026-07） | 通用开源事实标准 |
| **SGLang** | LMSYS / 社区 | RadixAttention 前缀树 KV 复用 | v0.5.x | 大规模 MoE / DeepSeek 部署 |
| **TensorRT-LLM** | NVIDIA | 编译级内核 + In-flight Batching | v1.2.1（2026-04） | NVIDIA 卡上的极致性能 |
| **LMDeploy** | 上海 AI Lab | TurboMind 高性能 C++ 引擎 | v0.13.x | 国产模型 / 混合精度量化 |
| **Ollama** | Ollama | llama.cpp/GGML + 自研多模态引擎 | v0.30.x | 本地 / 桌面一键跑 |
| **llama.cpp** | ggml-org | GGUF + CPU/GPU 通吃 | 滚动更新 | 端侧 / CPU / 量化 |
| **HF TGI** | Hugging Face | 早期 Rust 服务网关 | v3.3.7（**维护模式**） | ⚠️ 官方已建议迁走 |
| **KTransformers** | 清华 kvcache-ai | CPU/GPU 异构，专家放 CPU | 滚动更新 | 单卡跑超大 MoE |

注意到 HF 这一行的 ⚠️ 了吗？这是 2025 年格局最重要的变化之一，后面单独说。

---

## 分层看：推理引擎其实分三层

把八个引擎平铺在一张表里对比是有陷阱的——它们根本不在解决同一个问题。**Ollama 和 SGLang 放在一起选，就像拿家用轿车和集装箱卡车比油耗。** 正确的做法是先分层：

```
L1 本地 / 单机层     —— 一个人用，跑得起、装得简单最重要
   Ollama · llama.cpp · LM Studio · HF Pipeline（原型）

L2 高性能服务层      —— 一个服务撑多用户，吞吐 / 延迟 / 显存效率最重要
   vLLM · SGLang · TensorRT-LLM · LMDeploy · (TGI 已退场)

L3 分布式 / 分离层    —— 一个机房跑一个大模型，架构比引擎本身更重要
   PD 分离 · NVIDIA Dynamo · Mooncake · 大规模专家并行(EP)
```

**先定位到层，再在层内选引擎。** 大部分人的纠结，其实是把 L1 的需求拿到 L2 去选，或者反过来。

---

## L1 本地 / 单机层：跑得起、装得简单

这一层的核心诉求不是吞吐，是**「我一个人、一台机器、最好一条命令就能把模型跑起来」**。隐私敏感、离线、端侧、快速原型都归这里。

### Ollama / llama.cpp：门面与内核

这俩要一起讲，因为它们是同一件事的两面：

- **llama.cpp** 是内核——C/C++ 实现，用 **GGUF** 量化格式，CPU / GPU / Apple Silicon 通吃。端侧量化推理的地基。
- **Ollama** 是门面——在 llama.cpp 之上做「一键拉起 + 模型管理」的产品层，`ollama run qwen3` 就完事。

关于这俩，有一个**很多旧文没跟上的 2025 年变化**：

> **Ollama 正在从「llama.cpp 套壳」走向自研引擎。** 2025 年 5 月它上线了全新的多模态引擎，把视觉模型（gemma3、qwen2.5vl、mistral-small3.1 等）做成一等公民，并直接对接 GGML 张量库、逐步与 llama.cpp 解耦（[Ollama 博客](https://ollama.com/blog/multimodal-models)）。到 0.30 版本，Apple Silicon 上引入了 MLX 引擎与 llama.cpp 并存，Vulkan 默认开启（覆盖到 AMD/Intel GPU），NVIDIA 上性能约 +20%（[Ollama 博客](https://ollama.com/blog)）。

所以如果你还停留在「Ollama 就是个 llama.cpp 的启动器」的印象，该更新了。

**什么时候选它们：** 本地开发、桌面应用、隐私数据不能出内网、端侧部署、快速验证一个模型「行不行」。GGUF 是这一层的通用交换格式。

**什么时候别用：** 需要扛高并发的线上服务。它们面向的是单机 / 单用户体验，不是数据中心级吞吐——这跟 L2 的引擎定位是正交的，不是「谁更强」的问题。

### HF Pipeline 与 TGI：一个是原型玩具，一个已经退场

阿里云原文把「Hugging Face Pipeline」列为选型候选，这里要拆成两件事说清楚，因为**它俩经常被混为一谈，而且都有坑**：

- **`transformers.pipeline`** 是几行代码调用模型的高级 API，适合教学、原型、离线小批量。但它**从来就不是生产服务方案**——没有 continuous batching、没有 PagedAttention，并发上去就崩。把它当选型候选，只能是「原型阶段」的候选。
- **TGI（Text Generation Inference）** 才是 HF 曾经的服务产品。但——

{{< alert icon="bomb" >}}

**2025 年最重要的格局变化之一：Hugging Face 亲手给 TGI 挂上了「维护模式」横幅。** GitHub README 明确写着 *"text-generation-inference is now in maintenance mode"*，只接受小 bug 修复，并**反过来建议用户改用 vLLM、SGLang 或本地 llama.cpp / MLX**（[TGI GitHub](https://github.com/huggingface/text-generation-inference)）。HF 战略性地把 serving 让位给了 vLLM/SGLang，自己回去专注 transformers 的模型架构标准。

{{< /alert >}}

**结论：** 如果有人还在 2026 年推荐你用 TGI 上生产，说明他的信息停在了 2024 年。原型用 `pipeline`，生产直接看 L2。

---

## L2 高性能服务层：一个服务撑住多用户

这是绝大多数「要上线」的团队真正要选的一层。核心诉求变成了**吞吐（throughput）、延迟（TTFT / TPOT）、显存效率**——同样的 GPU，能不能多服务几倍请求。

这一层的两个地基技术，值得先记住：

- **Continuous Batching（连续批处理）**：不等一批请求全部结束，而是每生成一步就动态放入新请求、送走完成的请求，把 GPU 榨干。这是所有现代服务引擎的标配。
- **PagedAttention / RadixAttention**：两种 KV cache 管理哲学，分别是 vLLM 和 SGLang 的看家本领，下面细说。

### vLLM：开源事实标准，2025 年完成 V1 重写

**核心机制**：**PagedAttention** 把 KV cache 切成固定大小的「页」，像操作系统管虚拟内存一样把逻辑位置映射到非连续的物理块，消除显存碎片、提升并发。

**2025 年最大的事是 V1 架构重写**：2025-01 随 v0.7.0 发布 alpha，宣称相比旧架构**最高 1.7× 吞吐**，卖点是默认打开所有优化、隔离出独立的执行循环、零开销前缀缓存（[vLLM 博客](https://vllm.ai/blog/2025-01-27-v1-alpha-release)）；自 v0.8.0 起 **V1 成为默认引擎**（[Red Hat 实测](https://developers.redhat.com/articles/2025/04/28/performance-boosts-vllm-081-switching-v1-engine)）。V1 的调度器能在**同一步里混合 prefill 和 decode**，并内置 chunked prefill、prefix caching、投机解码、PD 分离等能力。

**投机解码、量化、PD 分离全都有**：内置 n-gram / EAGLE / Medusa / MTP 投机解码；量化覆盖 FP8 / INT8 / AWQ / GPTQ / GGUF 到 Blackwell 上的 MXFP4 / NVFP4；PD 分离通过 KV Connector 对接 Mooncake / LMCache 等外部 KV 服务。

**一句话定位**：**模型覆盖最广、生态最全、从单卡到多机都能用的「默认选项」。** 拿不准选什么的时候，先上 vLLM 基本不会错。

### SGLang：大规模 MoE / DeepSeek 部署的明星

**核心机制**：**RadixAttention** 用基数树（前缀树）+ LRU 自动复用多个请求间共享的前缀 KV cache，把 prefix caching 做成一等公民——这天生适合 Agent、多轮对话、few-shot 这类**前缀高度重复**的负载。

**让 SGLang 封神的一战**：2025-05，它成为**首个开源复现 DeepSeek 官方级别大规模部署**的引擎——12 节点 × 8×H100 = **96 张 H100**，2000-token 输入下每节点 52.3K input tok/s、22.3K output tok/s，**比朴素张量并行快 5×**，成本压到约 **$0.20 / 百万 output token（约为 DeepSeek 官方 Chat API 定价的 1/5）**，与官方 profile 差距仅 5–6%（[LMSYS 博客](https://www.lmsys.org/blog/2025-05-05-large-scale-ep/)）。背后是 DeepEP、DeepGEMM、EPLB、DP Attention、Two-Batch Overlap 一整套组合拳。

投机解码这边，SGLang 在 DeepSeek-V3 上开 MTP，输出吞吐最高 +60%、约 1.8× tokens/s（[LMSYS 博客](https://www.lmsys.org/blog/2025-07-17-mtp/)）。

**一句话定位**：**超大规模 MoE 整机房部署、长共享前缀（Agent / 多轮）场景的首选。** 到 2026 年，SGLang 在 DeepSeek 类模型的「整集群 PD + EP 工程化」上是开源里最激进的——它早已不是「四选一之一」，而是这个细分赛道的头号玩家。

### TensorRT-LLM：NVIDIA 官方引擎，完成「PyTorch 化」

**核心机制**：把模型编译成 TensorRT 引擎做算子级优化，配合 In-flight Batching（就是 continuous batching 的 NVIDIA 叫法）。

**历史包袱与 1.0 的转身**：TensorRT-LLM 过去的口碑是「编译式、极致快、但难用」。**v1.0.0（2025-09-24，注意是 2025 不是 2024）**是转折点——PyTorch 后端成为默认且稳定、LLM 高层 API 稳定，易用性明显向 vLLM/SGLang 靠拢，同时新增 NVFP4、投机解码增强、Wide-EP（大规模专家并行）（[v1.0.0 Release](https://github.com/NVIDIA/TensorRT-LLM/releases/tag/v1.0.0)）。

> ⚠️ **辩证看待营销数字**：网络上流传的「H100 FP8 上 10,000+ tok/s、比原生 PyTorch 快 4×」等数字多来自第三方博客，未在 NVIDIA 官方一手材料里稳定复现，引用需谨慎。

**一句话定位**：**纯 NVIDIA 硬件（尤其 Hopper / Blackwell）、追求极致吞吐延迟、要走企业级（Triton / NIM）落地的团队。** 代价是绑定 NVIDIA 生态、闭源内核多。

### LMDeploy / TurboMind：国产力量，混合精度与 KV 量化强

**核心机制**：上海 AI Lab 自研的 **TurboMind** 高性能 C++/CUDA 引擎，主打 blocked KV cache、KV cache 在线量化（INT4/INT8）、AWQ、自动前缀缓存。

**亮点数据**：TurboMind 的混合精度推理，相比现有混合精度框架**延迟最高降 61%、吞吐最高升 156%**，在 H800 上跑 gpt-oss 达到 vLLM 的 1.5×（[arXiv:2508.15601](https://arxiv.org/abs/2508.15601)）。对 DeepSeek 集成了 FlashMLA、DeepGEMM、DeepEP，PD 分离通过 DLSlime + Mooncake 落地。

**一句话定位**：**国产模型（InternLM / Qwen / DeepSeek）生产部署、对 KV cache 量化和低延迟有强需求的团队。** 在中低批量延迟和量化推理上常优于 vLLM，代价是生态和模型覆盖面小一些。

---

## L1.5 特殊场景：KTransformers——用内存换「跑得起」

这个引擎值得单列，因为它解决的是一个很具体但很痛的问题：**显存不够，但我就是想在本地把满血 671B MoE 跑起来。**

**核心机制**：利用 MoE「稀疏激活」的特点做 CPU/GPU 异构——把稀疏激活的专家权重甩给 CPU（大内存 + AMX 指令集），把注意力等稠密计算留给 GPU（高带宽）。

**代表成绩**：在**单张 24GB 显卡（RTX 4090D）+ 大内存**上跑起**满血 DeepSeek-R1/V3 671B**，预填充最高 286 tok/s、生成约 14 tok/s（[KTransformers 教程](https://github.com/kvcache-ai/ktransformers/blob/main/doc/en/DeepseekR1_V3_tutorial.md)）。2025-10 它的 CPU 内核还被合并进了 SGLang，让「异构 offload」从玩具走向可服务化。

**一句话定位**：**显存受限却想跑前沿大 MoE 的科研 / 低成本私有化场景。** 它不追高并发吞吐，追的是「能不能跑起来」——是「消费级硬件跑前沿模型」的代表方案。

---

## 模型格式 × 引擎：先看你的权重是什么格式

选引擎之前，先看手里的模型是什么格式——这直接砍掉一半候选：

| 格式 | 说明 | 主要适配引擎 |
|---|---|---|
| **GGUF** | 端侧通用量化容器（Q4_K_M 等），CPU 友好 | llama.cpp / Ollama |
| **Safetensors** | 加载快、不易受恶意代码影响，HF 生态主流 | vLLM / SGLang / TRT-LLM / LMDeploy |
| **PyTorch (.pt/.pth)** | 原始 state_dict 权重 | vLLM / HF Pipeline |

### 量化：2026 年已经进入 4-bit（FP4）时代

阿里云原文的量化视角还停在 FP8 / GGUF，这块需要升级——2025 年量化的主线是**从 8-bit 走向 4-bit**：

| 量化格式 | 特点 | 主要适配引擎 |
|---|---|---|
| **FP8 (E4M3)** | Hopper/Ada 起原生，权重 + 激活 + KV cache | vLLM / TRT-LLM / SGLang / LMDeploy |
| **AWQ** | 激活感知 4-bit 权重量化，精度好 | vLLM / LMDeploy / SGLang |
| **GPTQ** | 经典 4-bit 训练后量化 | vLLM / TRT-LLM |
| **GGUF (Q4_K_M…)** | 端侧通用量化容器 | llama.cpp / Ollama |
| **MXFP4** | 每 32 值共享一个 2 的幂 scale（微缩放） | gpt-oss 原生 / vLLM / LMDeploy / TRT-LLM |
| **NVFP4** | 每 16 值共享一个 FP8 scale，更细 | Blackwell 原生 / TRT-LLM / vLLM |

标志性事件是 **OpenAI 的 gpt-oss（2025）直接以 MXFP4 发布**——MoE 专家权重（占参数 90%+）做量化感知训练，让 120B 能塞进单张 80GB 卡（[NVIDIA 博客](https://developer.nvidia.com/blog/fine-tuning-gpt-oss-for-accuracy-and-performance-with-quantization-aware-training/)）。NVIDIA 则称 NVFP4 的 KV cache 比 FP8 省约 50%、精度损失 <1%、整体 1.6× 于 BF16 吞吐（[NVIDIA Research](https://research.nvidia.com/labs/eai/blogs/pushing-intelligence-to-4-bit/)）。

> **一条经验法则**：**格式和量化决定了你的候选池，先过这一关再谈引擎。** 手里是 GGUF 就别惦记 SGLang，想上 NVFP4 就得有 Blackwell 卡加 TRT-LLM/vLLM。

---

## 阿里云原文没讲的三个新趋势

这是这篇文章相比原文最大的增量。2025 年推理引擎领域真正的进展，全在这三件事上。

### 趋势一：PD 分离——2025 年的架构主线

前面说的「拆」，主要就是指这个。

**为什么要拆**：一次推理有两个阶段，特性完全相反——

- **Prefill（预填充）**：算完整个 prompt 的 KV，**计算密集**，吃算力。
- **Decode（解码）**：每步只生成 1 个 token，**访存密集**，吃显存带宽。

把它俩塞在同一张卡上会互相干扰，首 token 延迟（TTFT）和逐 token 延迟（TPOT）两个指标很难同时满足。**拆开到不同的 GPU 池，就能各自独立扩缩容、各自选最优并行策略**——这就是 Prefill-Decode 分离（disaggregated serving）。

两个代表作：

- **Mooncake**（月之暗面 Kimi 的服务平台）：以 **KVCache 为中心**的分离架构，不光拆 prefill/decode，还把集群里闲置的 CPU / DRAM / SSD 组织成一个**全局 KV cache 池**。论文拿了 **FAST 2025 最佳论文**，模拟长上下文场景吞吐最高 +525%（[arXiv:2407.00079](https://arxiv.org/abs/2407.00079)）。现在已被 vLLM、SGLang、TensorRT-LLM、Dynamo 广泛集成。
- **NVIDIA Dynamo**（见趋势三）把 PD 分离直接产品化了。

> **这背后是一个认知转变**：**KV cache 正从「单机显存里的东西」变成「集群级的存储层」。** Mooncake、LMCache 把 KV 下沉到 CPU/DRAM/SSD，实现跨实例、近 GPU 的前缀缓存。这一步，把推理彻底带进了分布式系统的领域。

### 趋势二：投机解码——从论文走向标配

**一句话原理**：用一个轻量「草稿模型」快速猜出接下来的多个 token，再让大模型**一次前向就并行验证**这一串——猜中的部分直接省掉了逐个生成的算力。

2025 年它从「论文里的技巧」变成了「vLLM/SGLang 里开个开关就能用」：

- **EAGLE-3**（[arXiv:2503.01840](https://arxiv.org/abs/2503.01840)）：放弃预测特征、改为直接预测 token + 多层特征融合，**最高 6.5× 加速**，还发现了「训练数据越多、加速比越高」的 scaling 规律。
- **MTP（Multi-Token Prediction）**：DeepSeek-V3 自带 MTP 头，天然可当草稿。SGLang 实测约 1.8× tokens/s、接受率 85–90%；vLLM 能自动识别 MTP 头。
- **Medusa**：2024 年的代表作（多解码头 + 树状注意力），2025 年多被 EAGLE-3 超越，但仍是内置选项之一。

**对选型的意义**：如果你的引擎（vLLM / SGLang / TRT-LLM）支持投机解码，而你还没开——这是一笔几乎免费的 1.4–2× 加速，值得优先试。

### 趋势三：NVIDIA Dynamo——把分离式推理产品化

**定位要点**：Dynamo **不是又一个推理引擎，而是引擎之上的编排层**。GTC 2025 发布，数据中心级、开源、专门做分布式推理编排。

它把前两个趋势打包成了产品，四大组件：

1. **Planner**：按 SLO 和负载，在「分离 vs 聚合」之间动态切换、动态增减 GPU。
2. **Smart Router**：用基数树跟踪全集群的 KV cache，把请求路由到能命中缓存的那张卡。
3. **KV Cache Manager**：把冷 KV 下沉到 CPU / SSD / 对象存储。
4. **NIXL**：跨异构内存 / 存储的高吞吐传输库。

**性能**：DeepSeek-R1 671B 在 GB200 NVL72 上吞吐提升 30×；Llama 70B 在 Hopper 上吞吐翻倍。关键是**它兼容 vLLM / SGLang / TensorRT-LLM 作为后端**（[NVIDIA 博客](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)）。

> **这件事的信号很清楚**：NVIDIA 用 Dynamo 把「PD 分离 + 智能路由 + KV 分层」标准化，而且**不绑定自家引擎**——等于承认了 vLLM/SGLang 是既成事实，自己退到编排层和硬件层去做价值。开源引擎的江湖地位，由此盖章。

---

## 选型决策矩阵

把 L2 这几个真正要「二选一 / 三选一」的引擎放到一起，按维度打分：

| 维度 | vLLM | SGLang | TensorRT-LLM | LMDeploy |
|---|---|---|---|---|
| **模型覆盖广度** | 最广 | 广 | 中（NVIDIA 优先） | 中（国产友好） |
| **上手难度** | 低 | 中 | 中（1.0 后改善） | 中 |
| **通用高并发吞吐** | 强 | 强 | 最强（NV 卡） | 强 |
| **超大 MoE / EP 部署** | 强 | 最强 | 强 | 强 |
| **前缀复用（Agent/多轮）** | 好 | 最好（RadixAttention） | 好 | 好 |
| **KV 量化 / 低延迟** | 好 | 好 | 强 | 最强（TurboMind） |
| **硬件绑定** | 无（含 TPU） | 无 | 强绑 NVIDIA | 主要 NVIDIA |
| **生态 / 社区** | 最活跃 | 活跃 | NVIDIA 官方 | 国产社区 |

没有一列全是「最」——**这正是「中立」的意思：不存在通吃的引擎，只有匹配你负载的引擎。**

---

## 实战决策树

把上面所有东西压缩成一棵树：

```
你要在哪一层？
│
├── 本地 / 单机 / 隐私 / 原型
│   ├── 就想一键跑起来、日常用 ─────────► Ollama
│   ├── 要抠 CPU / 端侧 / 极致量化 ──────► llama.cpp
│   ├── 几行代码验证个模型 ────────────► HF transformers.pipeline
│   └── 显存不够但要跑满血 671B MoE ───► KTransformers
│
├── 高性能线上服务（一个服务撑多用户）
│   ├── 拿不准 / 要模型覆盖最广 ───────► vLLM（默认选它）
│   ├── 大规模 MoE / DeepSeek / 多轮前缀重 ► SGLang
│   ├── 纯 NVIDIA 卡 + 要极致性能 + 企业级 ► TensorRT-LLM
│   └── 国产模型 + 强 KV 量化 / 低延迟 ──► LMDeploy
│
└── 机房级 / 一个大模型吃满整个集群
    └── 别只盯引擎，先上编排层 ─────────► NVIDIA Dynamo
        （PD 分离 + Mooncake KV 池 + EP，后端仍是 vLLM/SGLang/TRT-LLM）

⚠️ 还在考虑上 TGI 生产？—— 别了，官方已维护模式，改道 vLLM/SGLang。
```

---

## 分场景总结：一句话给答案

| 如果你是…… | 大概率选 |
|---|---|
| 个人开发者，本地跑模型、做原型 | **Ollama**（+ GGUF） |
| 要抠端侧 / CPU / Apple Silicon | **llama.cpp** |
| 教学、离线小批量、几行代码验证 | **HF `pipeline`**（别上生产） |
| 显存受限但想跑满血大 MoE | **KTransformers** |
| 要上线，拿不准，想一个能打的默认 | **vLLM** |
| 大规模跑 DeepSeek / MoE / Agent 多轮 | **SGLang** |
| 纯 NVIDIA、追极致性能、要企业级栈 | **TensorRT-LLM** |
| 国产模型、重 KV 量化 / 低延迟 | **LMDeploy** |
| 一个大模型要吃满整个机房 | **Dynamo**（编排层）+ 上面某个引擎（后端） |

---

## 收尾

阿里云那篇文章没有错，它只是**停在了「单机跑模型」这一层**。而 2025 年整个行业的重心，已经从「用哪个引擎把模型跑起来」，挪到了「用什么架构把一个大模型高效地摊到一整个集群上」。

如果只留一句话，我会留这句：

> **推理引擎的选择，本质是「你在哪一层」的选择。** 先定位到本地 / 服务 / 分布式这三层里的一层，候选就自动收敛到一两个；剩下的差异，交给你自己的负载去基准测试——**没有普适最优的引擎，只有跑过你自己流量的那个数字。**

三年前，能把模型跑起来就赢了。今天，怎么跑，才是真正的分水岭。

---

*本文的最新进展数据（vLLM V1、SGLang 复现 DeepSeek、TensorRT-LLM 1.0、Mooncake、Dynamo、EAGLE-3、NVFP4 等）来自对官方博客、GitHub release、arXiv 论文的多源交叉验证，关键数字均在正文附了来源链接。厂商自测数字（如 TGI 长上下文自测、TRT-LLM 第三方吞吐）已在文中标注「需辩证看待」。截至 2026-07。*
