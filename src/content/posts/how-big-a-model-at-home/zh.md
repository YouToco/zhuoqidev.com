---
title: 一个人，在家能养多大的模型？——从 Mac mini 对 3060 的实测，到内存、电和国境三堵墙
short: 一个人在家能养多大的模型
description: 我花了三天测一台 Mac mini M6 和一台 RTX 3060 笔记本，又顺着问到 Mac Studio、4090、能撑五年的 1M 上下文工作站，最后问到机房服务器和出口管制。回头看，这些问题其实是同一个：一个人在自己手里，最多能拥有多大的 AI。答案不由算力决定，而是由三堵墙决定——内存决定装得下多大、出字多快，电决定你能堆几张卡，国境决定你能买到哪张卡。
date: 2026-10-18
updated: 2026-10-18
lead: 在家跑模型，算力几乎从来不是第一个瓶颈。**每出一个字，都要把整个模型从内存里搬一遍**，所以出字速度看内存带宽、能跑多大看内存容量，算力只管读提示词那一下。再往上，家里一个插座最多给你 2.2–3.5 kW，而最好的卡在中国大陆买不到。2026 年 10 月，一个人在家能养的上限，大约是一台 Mac Studio 或一两张特供版专业卡；再大的，只能租。
tags:
  - 本地大模型
  - 硬件选型
  - Apple Silicon
  - NVIDIA
  - llama.cpp
  - 内存带宽
  - 实测
categories:
  - 深度调研
---

*这篇写给想在自己机器上跑大模型、正在纠结买什么的工程师。前半篇是两台机器的实测，中间讲清楚「跑模型到底在比什么」，后半篇顺着三堵墙一路问到天花板。实测跑法和完整数字在文末[附录](#附录跑法和完整数字)。*

---

## 我其实一直在问同一个问题

这三天我问了一串看起来不相干的问题：

1. 新买的 Mac mini M6 和我那台 RTX 3060 笔记本，谁写代码快、谁训练快、谁跑模型快？
2. Mac 换上最合适的框架（MLX、oMLX）以后，跑模型能追上 3060 吗？
3. 那 Mac Studio、4090、5090 怎么排？
4. 想在本地跑一个 1M 上下文、能看图、够聪明的模型，买什么能撑五年？
5. 直接买一台机房服务器，是不是就能用上最新的 Rubin？

回头看，它们是一个问题的五个台阶：**一个人在自己手里，最多能拥有多大的 AI？** 每上一个台阶，我都撞上一堵新的墙。

| 台阶 | 撞上的墙 | 一句话 |
|---|---|---|
| 1–3 | 内存 | 出字快不快看带宽，装不装得下看容量 |
| 4 | 内存（KV） | 1M 上下文的账，几乎全是 KV 缓存的内存账 |
| 5 | 电、国境 | 家里带不动 24 kW 的机器；最好的卡买不到 |

下面一堵一堵说。

---

## 起点：一台 Mac mini 和一台 3060 笔记本

先交代两台机器：

- **Mac mini（M6，16 GB 统一内存，国行 6,999 元）**：12 核 CPU（2 + 4 + 6 三档核心）、12 核 GPU。
- **Ubuntu 笔记本（i7-12700H，32 GB 内存，RTX 3060 笔记本版 6 GB 显存）**。

两台跑同一份脚本，测我日常真会干的活。结论分成三块，正好是三个方向：

```chart
{
  "type": "bars",
  "fmt": {"suf": "×", "digits": 1},
  "ref": {"value": 1, "label": "打平"},
  "legend": [
    {"color": "blue", "label": "Mac mini 更快"},
    {"color": "seal", "label": "3060 笔记本更快"}
  ],
  "rows": [
    {"label": "跑全量测试", "sub": "真实项目 5,139 个测试", "value": 2.1, "color": "blue"},
    {"label": "TypeScript 类型检查", "sub": "同一个项目", "value": 2.4, "color": "blue"},
    {"label": "前端构建", "sub": "同一个项目", "value": 2.4, "color": "blue"},
    {"label": "训练小 CNN", "sub": "两边各用最快框架", "value": 2.7, "color": "seal"},
    {"label": "训练小 Transformer", "sub": "两边各用最快框架", "value": 1.4, "color": "seal"},
    {"label": "跑 4B 模型出字", "sub": "单人，各用最快引擎", "value": 1.7, "color": "seal"}
  ],
  "caption": "快多少倍（快的一方 ÷ 慢的一方）。2026-10-15 至 10-17 实测，每项各跑多轮取稳定值。"
}
```

写代码、跑测试，Mac 快一倍多；碰到 GPU 的活，3060 反过来快。最让我意外的是最后一行：Mac 换上苹果自家的 MLX、再换上带 SSD 缓存的 oMLX，**单人出字最快 56 个 token/秒，3060 是 96**。

为什么一块六年前架构的笔记本显卡，出字能比新 Mac 快这么多？答案不在算力上。

---

## 第一堵墙：内存

### 每出一个字，都要把整个模型搬一遍

大模型生成文字是一个字一个字往外吐的。每吐一个 token，GPU 都要把**全部权重**从显存（或统一内存）读一遍，和刚算出的那一点点状态做乘法。乘法本身很快，慢的是搬。

所以单人出字速度有个很粗但很好用的上限：

> **出字速度 ≈ 内存带宽 ÷ 模型占的字节数**

7B 模型量化到 4 bit 约 3.8 GB。3060 笔记本的显存带宽约 336 GB/s，除一下是每秒 88 次——实测 75 次，跑到了上限的 86%。我这台 16 GB 的 Mac mini M6 带宽是 153 GB/s（32 GB 版才是 170），上限 40 次，实测 35 次。**3060 快，是因为它的显存搬得快一倍多，不是因为它算得快。**

这条规律不只对我这两台成立。llama.cpp 社区有两个统一跑分帖（[苹果芯片](https://github.com/ggml-org/llama.cpp/discussions/4167)、[N 卡](https://github.com/ggml-org/llama.cpp/discussions/15013)），大家用同一个模型、同一条命令贴结果。我先拿自己两台跑了同一条命令核对：3060 笔记本 75.2 对社区 3060 台式机 76.9，M6 35.0 对社区 Mac mini M6 35.7，只差 2–4%，数据可信。把它们按带宽排开：

```chart
{
  "type": "line",
  "fmt": {"digits": 0},
  "x": {"label": "内存带宽（GB/s）", "min": 0, "max": 1900, "ticks": [0, 300, 600, 900, 1200, 1500, 1800]},
  "y": {"label": "出字速度（token/秒）", "max": 320, "ticks": [0, 80, 160, 240, 320]},
  "series": [
    {"label": "N 卡", "color": "seal", "points": [[288, 64.0], [336, 75.2], [360, 76.9], [896, 158.1], [936, 161.9], [1008, 189.0], [1792, 300.4]]},
    {"label": "苹果芯片", "color": "blue", "points": [[153, 35.0], [170, 35.7], [307, 66.3], [614, 119.9], [1228, 179.1]]}
  ],
  "marks": [
    {"x": 336, "y": 75.2, "label": "我的 3060 笔记本", "color": "seal", "side": "right"},
    {"x": 153, "y": 35.0, "label": "我的 Mac mini M6", "color": "blue", "side": "right"},
    {"x": 1008, "y": 189.0, "label": "4090", "color": "seal", "side": "left"},
    {"x": 1228, "y": 179.1, "label": "M5 Ultra", "color": "blue", "side": "right"},
    {"x": 1792, "y": 300.4, "label": "5090", "color": "seal", "side": "left"}
  ],
  "caption": "Llama 2 7B 4 bit，llama.cpp 单人出字速度。我的两台为 2026-10-17 实测，其余取自 llama.cpp 社区跑分帖（各条软件版本不同，只看量级）。带宽为厂商标称值（M5 Ultra 苹果只写「1.2 TB/s」，按 M5 Max 的两倍取 1,228）。"
}
```

几乎是一条直线。每台机器都只用上了标称带宽的 56–88%，但排名完全由带宽决定：M5 Ultra 的带宽比 4090 高两成，出字却差不多；5090 的带宽接近 4090 的 1.8 倍，出字也快了 1.6 倍。

### 算力只管「读提示词」那一下

带宽解释了出字，那 N 卡贵在哪？贵在读提示词。

模型读你给它的那一大段文字（预填充）时，是几千个 token 一起算，这时候瓶颈才轮到算力。差距一下子拉开：

```chart
{
  "type": "bars",
  "fmt": {"digits": 0},
  "legend": [
    {"color": "seal", "label": "N 卡"},
    {"color": "blue", "label": "苹果芯片"}
  ],
  "rows": [
    {"label": "RTX 5090", "sub": "32 GB", "value": 14970, "color": "seal"},
    {"label": "RTX 4090", "sub": "24 GB", "value": 14771, "color": "seal"},
    {"label": "M5 Ultra", "sub": "最多 512 GB", "value": 4945, "color": "blue"},
    {"label": "M5 Max", "sub": "最多 128 GB", "value": 3220, "color": "blue"},
    {"label": "我的 3060 笔记本", "sub": "6 GB", "value": 2311, "color": "seal"},
    {"label": "我的 Mac mini M6", "sub": "16 GB", "value": 1016, "color": "blue"}
  ],
  "caption": "读提示词速度（token/秒），Llama 2 7B 4 bit、512 token 提示。社区跑分帖 + 我的两台实测。"
}
```

出字差不多的 4090 和 M5 Ultra，读提示词差了三倍。短对话感觉不到，但一旦你想喂它一整本书、一个代码仓库，这三倍就是三倍的等待。

### 容量决定你能养多大

带宽决定快慢，**容量决定有没有**。模型装不进去，再快也是零。

我的 3060 只有 6 GB 显存，4B、7B 的 4 bit 模型能放下，27B 就放不下了。Mac mini 是 16 GB 统一内存，但 GPU 不能全用，实测单个张量最多放到 8 GB。这时候苹果的路数就显出来了：Mac Studio 的 M5 Max（40 核 GPU 版）最多配 128 GB，M5 Ultra 顶配最多 512 GB（10 月底才开卖），而消费级 N 卡最大的 5090 只有 32 GB。注意苹果的带宽也跟着配置走：同是 M5 Max，32 核 GPU 的起步版只有 460 GB/s。

> [!NOTE]
> 一个粗算法：4 bit 量化的模型，每 10 亿参数约占 0.6 GB，再给上下文（KV 缓存）和运行时留出两三成。照这个算，32 GB 大约养得下 30B 级稠密模型，128 GB 养得下 100–150B 级，512 GB 才碰得到 600B 级的 MoE 大模型。这是估算，具体以模型和量化格式为准。

所以第一堵墙其实是三件事拧在一起：**容量决定能养多大，带宽决定出字多快，算力决定读得多快**。Mac 赢在容量，N 卡赢在算力，带宽两边各有高低。

### 1M 上下文：一笔几乎全是 KV 的内存账

我接着问：想在本地跑一个**1M 上下文、能看图、稠密、够聪明**的模型，买什么能撑五年？

这一问把第一堵墙推到了极端。模型每读一个 token，都要把它在每一层的「键」和「值」存下来，下次生成时回头查——这就是 KV 缓存。上下文越长，它越大，而且它和权重抢的是同一块内存。

我挑的模型是 [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B)（2026-08-14 发布，稠密、能看图）。它 64 层里只有 16 层是全注意力，其余 48 层是状态固定的线性注意力，所以 KV 很省：

```text
每个 token 的 KV = 16 层 × 2（键、值）× 4 个 KV 头 × 256 维 × 2 字节 = 64 KiB
1M 个 token     ≈ 64 GiB
```

```chart
{
  "type": "stack",
  "fmt": {"suf": " GB"},
  "series": [
    {"key": "w", "label": "模型权重", "color": "blue"},
    {"key": "kv", "label": "1M 个 token 的 KV 缓存", "color": "seal"}
  ],
  "rows": [
    {"label": "全精度", "sub": "权重和 KV 都是 16 bit", "values": {"w": 56, "kv": 69}},
    {"label": "压到 8 bit", "sub": "权重和 KV 都是 8 bit", "values": {"w": 28, "kv": 34}}
  ],
  "caption": "Qwen3.8-27B 跑满 1M 上下文要多少内存（GB），按官方配置计算，不含运行时开销。一张 96 GB 专业卡装得下 8 bit 那一行，全精度要两张。"
}
```

权重压到 8 bit 约 28 GB，KV 也压到 8 bit 约 34 GB，加起来约 62 GB——**一张 96 GB 的专业卡刚好够，全精度要两张**。同样 1M 上下文，换一个全注意力的 32B 模型，KV 要 256 GiB，四张卡起步。

Mac Studio 只有配到 128 GB 以上才装得下全精度那一行，国行最便宜的是 96 GB 的 M5 Ultra（46,999 元起），只够 8 bit。就算容量够，它也卡在算力上：冷读 1M 个 token，按 M5 Ultra 读 27B 模型的速度估算要半小时以上，专业卡大约几分钟到十分钟。**能装下，不等于能用**。

---

## 第二堵墙：电

那再往上走一步：不买工作站了，直接买一台机房里的 8 卡服务器？

英伟达最新的 DGX Rubin NVL8 把 8 张 Rubin 塞进一台机器，官方标**一台约 24 kW**，要直触芯片的液冷、整机柜和冷却分配单元。而家里的普通插座是 10 A，约 2.2 kW；接空调、热水器的 16 A 插座也只有约 3.5 kW。

```chart
{
  "type": "bars",
  "fmt": {"suf": " W"},
  "ref": {"value": 3520, "label": "家里 16 A 插座 220 V × 16 A"},
  "rows": [
    {"label": "DGX Rubin NVL8", "sub": "8 卡机房服务器", "value": 24000, "color": "seal"},
    {"label": "两张 RTX PRO 6000", "sub": "Workstation 版", "value": 1200, "color": "gold"},
    {"label": "两张 RTX PRO 6000", "sub": "Max-Q 版", "value": 600, "color": "gold"},
    {"label": "RTX 5090", "sub": "单卡", "value": 575, "color": "gray"}
  ],
  "caption": "只算 GPU 或整机标称功耗，不含 CPU、风扇和空调。"
}
```

比最粗的那个插座还差七倍，而且这还没算散热：24 kW 几乎全变成热，一个房间根本带不走。**一个人在家，电表就是第二堵墙**，过了它就不叫「在家」了。

---

## 第三堵墙：国境

最后一堵墙，在中国大陆是最硬的。

- Blackwell、Rubin 这两代**数据中心卡对华禁运**，截至 2026-10 没有放行的消息，买机房服务器这条路在中国走不通。
- 我上面推荐的完整版 RTX PRO 6000（96 GB）**也在管制线以上**。在中国卖的是特供的 **RTX PRO 6000D**：据拆解是 84 GB 显存、核心少约 17%（英伟达没公布规格）。据 FT 报道，中国公司今年已经买了上百万张这类特供卡，买得到，只是比完整版弱一档。
- 84 GB 依然够上面那个 1M 上下文的 8 bit 方案（约 62 GB），两张 168 GB 够全精度——只是更慢一点、更贵一点。

> [!WARNING]
> 别走灰色渠道买完整版。管制规则还在变，买前查最新的公告和报价。

所以在中国大陆，第三堵墙把天花板又往下压了一格。

---

## 所以，一个人在家能养多大的模型

把三堵墙叠在一起，2026 年 10 月的答案大致是这样：

| 你想要 | 在家的合理选择 | 撞到的是哪堵墙 |
|---|---|---|
| 写代码、跑测试、偶尔跑个 4B–8B 小模型 | Mac mini 或带 N 卡的笔记本，都够 | 还没撞墙 |
| 30B 级模型，自己用，出字要快 | 24–32 GB 的 N 卡（4090、5090） | 容量 |
| 100B 级以上，能装下优先，慢点可以 | Mac Studio（国行 19,999 元起；M5 Max 最多 128 GB，M5 Ultra 46,999 元起、最多 512 GB） | 算力（读长文慢） |
| 1M 上下文、稠密、看图，撑五年 | 1–2 张 96 GB 专业卡（中国大陆是 6000D）+ 大内存工作站 | 电和国境的边缘 |
| 前沿规模、多人并发 | 在家养不了，只能租卡或买 API | 三堵墙全撞 |

**什么时候值得在家养**：你要的是隐私、离线、不限次数地反复试，而且模型在 100B 以内。
**什么时候别养了**：你要的是最聪明的模型、或者长上下文要读得快——这时候一块钱买 token，比一块钱买硬件划算得多。

我在一家做模型中转的公司上班，每天看的是别人家的 token 怎么卖。测完这一圈，我对「买 token」这件事反而更踏实了：**在家养的是你能完全拥有的那一截，再往上的，本来就不该一个人扛。**

---

## 局限

- 社区跑分只测 7B 模型、单人、512 token 短提示，只覆盖 llama.cpp。并发、长上下文、MLX、vLLM 都要另测；各条结果的软件版本不同，新版本本身会快一到三成，只看量级。
- 1M 冷读时间是按 7B 跑分换算的估算，不是实测。
- 价格、出口管制都是 2026-10-18 查到的状态，变化很快；6000D 的规格来自拆解和跑分，不是官方数据。

---

## 来源

- 跑分：llama.cpp 社区 [苹果芯片帖 #4167](https://github.com/ggml-org/llama.cpp/discussions/4167)、[N 卡帖 #15013](https://github.com/ggml-org/llama.cpp/discussions/15013)（2026-10-17 抓取原文）。
- 带宽与规格：[英伟达显卡对比页](https://www.nvidia.com/en-us/geforce/graphics-cards/compare/)、[50 系笔记本](https://www.nvidia.com/en-us/geforce/laptops/50-series/)、[3060 笔记本版（Notebookcheck）](https://www.notebookcheck.net/NVIDIA-GeForce-RTX-3060-Mobile-GPU-Benchmarks-and-Specs.497453.0.html)；苹果 [Mac mini 规格](https://www.apple.com/mac-mini/specs/)、[Mac Studio 规格](https://www.apple.com/mac-studio/specs/)、[Mac Studio 发布新闻稿](https://www.apple.com/newsroom/2026/08/apple-introduces-new-mac-studio-with-m5-max-and-m5-ultra/)；国行价格取自 [apple.com.cn](https://www.apple.com.cn/shop/buy-mac/mac-studio)。
- 模型：[Qwen3.8-27B 模型卡](https://huggingface.co/Qwen/Qwen3.8-27B) 与 [config.json](https://huggingface.co/Qwen/Qwen3.8-27B/blob/main/config.json)。
- 功耗：[DGX Rubin NVL8](https://www.nvidia.com/en-us/data-center/dgx-rubin-nvl8/)、[RTX PRO 6000](https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000/)、[RTX PRO 6000 Max-Q](https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000-max-q/)；插座：国标 [GB 1002-2024](https://www.chinesestandard.net/PDF/English.aspx/GB1002-2024)。
- 出口管制：[Tom's Hardware 关于 6000D](https://www.tomshardware.com/pc-components/gpus/nvidia-rtx-pro-6000d-b40-blackwell-gpus-reportedly-set-to-supersede-banned-h20-accelerators-in-china)、[PCGH 拆解](https://www.pcgameshardware.de/Grafikkarten-Grafikkarte-97980/News/Nvidia-RTX-6000D-mit-84-GiByte-GDDR7-1487562/)、[FT 2026-10-13](https://www.ft.com/content/9dbd99db-6b0c-43bd-b7be-849f129df098)（付费墙）。

---

## 附录：跑法和完整数字

<details>
<summary>两台机器的跑法</summary>

```bash
# llama.cpp 社区统一跑分的同一条命令（b11696 官方预编译包）
llama-bench -m llama-2-7b.Q4_0.gguf -ngl 99 -fa 0,1 -p 512 -n 128
```

- 日常开发：同一份 Python 脚本，测单核 / 全核、numpy、磁盘、开发工具，以及一个真实 TypeScript 项目的类型检查、全量测试（5,139 个）和前端构建。
- GPU 训练：PyTorch 分 fp32 / 混合精度 / 混合精度 + compile 三档（两边都跑），Mac 另跑 MLX 三档；各取最快一档比。
- 大模型推理：Qwen3-4B-Instruct 4 bit，llama.cpp（两边）、mlx-lm 和 oMLX（Mac）；单人、1 / 4 / 8 路并发、6k token 前缀冷热缓存。

</details>

<details>
<summary>完整数字</summary>

| 项目 | 3060 笔记本 | Mac mini M6 |
|---|---|---|
| 全量测试（4 分片） | 136 秒 | 65 秒 |
| 类型检查 | 7.9 秒 | 3.3 秒 |
| 前端构建 | 72.5 秒 | 30.8 秒 |
| 小 CNN 训练（最快一档） | 8,718 张/秒 | 3,222 张/秒 |
| 小 Transformer 训练（最快一档） | 88,856 token/秒 | 64,401 token/秒 |
| 4B 模型单人出字（最快引擎） | 96 token/秒 | 56 token/秒（MLX） |
| 4B 模型 8 路同时（引擎直测） | 296 token/秒 | 256 token/秒（llama.cpp） |
| 6k 前缀重启后再读 | 从头算 | 0.28 秒（oMLX 存在 SSD 上） |
| Llama 2 7B 4 bit 出字 / 读提示词 | 75.2 / 2,311 | 35.0 / 1,016 |

</details>
