---
title: Mac 到底适不适合跑大模型？——苹果和英伟达的宣传页上，都没写的那几个数
short: Mac 到底适不适合跑大模型
description: 苹果说 Mac mini「快速、私密的本机推理」、提示处理快 13.5 倍；英伟达说笔记本 RTX 5090 有 1,824 AI TOPS。小字里的对比对象、测试配置，和真正决定你用起来快不快的三个数——内存带宽、读提示词的算力、GPU 实际能用的内存——却都没摆在显眼处。这篇用 llama.cpp 社区几十台机器的统一跑分、两台手头机器的核验，再按苹果脚注的原测法在 16 GB 基础款上复现一遍，再摆出它在写代码、编译、跑测试上实测赢下的部分，分场景回答 Mac mini、Mac Studio 和各档 N 卡到底适合干什么。
date: 2026-10-18
updated: 2026-10-18
lead: 能跑，和跑得好用，中间隔着几个宣传页上不写的数。**出字速度看内存带宽，读长文看算力，能跑多大看 GPU 实际能用的内存**；而两家的宣传，一个拿新 Mac 和五年前的 M1 比，一个让台式和笔记本共用「5090」这个名字。结论要分开说：Mac mini 拿来写代码、编译、跑测试、给云端模型的 Agent 当工作机，实测比同时期的游戏本快一倍多，很合适；拿来当本地大模型主力就不合适；Mac Studio 是「装得下大模型」最省事的办法，但读长文慢；N 卡在显存装得下的范围内最快，装不下就一落千丈。
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

```opener
{
  "word": "能跑。",
  "headline": "能跑，不等于跑得好。",
  "sub": "一台 16 GB 的 Mac mini，按苹果自己脚注里的测法跑 14B 模型：",
  "device": "mac-mini",
  "readouts": [
    {"label": "8K 提示 · 首字", "value": "15 秒"},
    {"label": "16K 提示 · 首字", "value": "35 秒"},
    {"label": "32K 提示", "value": "崩溃", "tone": "bad"}
  ],
  "note": "Qwen3-14B 4 bit · mlx-lm 0.32 · 2026-10-18 实测"
}
```

*这篇写给想买一台机器在本地跑大模型、正在看宣传页做决定的人。数据主要来自 llama.cpp 社区的统一跑分，我用手上的 Mac mini（M6，16 GB）和 RTX 3060 笔记本跑同一条命令核对过，又按苹果脚注的原测法在 16 GB 基础款上复现了一遍。怎么跑的、完整数字在文末[附录](#附录跑法和完整数字)。*

---

## 宣传页上写了什么，小字里又写了什么

先把两家的宣传和脚注并排放：

| 宣传页上写的 | 小字里的条件 | 没摆在显眼处的 |
|---|---|---|
| Mac mini：「快速、私密的本机推理」，M6 的 LLM 提示处理「最高快 13.5 倍」 | 对比的是 **2020 年的 M1**；M6 测试机配 **32 GB** 内存；测的是 14B 模型、8K 提示的首字时间 | 没和任何显卡比；16 GB 起售款的带宽是 153 GB/s，页面写的是「最高 170」 |
| Mac Studio：「在本机运行前沿级模型，不需要云端 token」 | M5 Ultra 最多 512 GB，只有顶配能选 | 读长提示词的速度只有同档 N 卡的三分之一 |
| 笔记本 RTX 5090：1,824 AI TOPS，「在本地运行最新 AI 模型」 | 显存 24 GB、带宽 896 GB/s | 台式 RTX 5090 是 32 GB、1,792 GB/s，同一个名字，带宽差一倍 |
| 台式 RTX 5090：3,352 AI TOPS | — | 产品页上没写带宽；32 GB 装不下的模型，再多 TOPS 也跑不了 |

两家都没有说假话，但都把「算力」放在最显眼的位置。问题是，**跑大模型时你最常等的那件事——一个字一个字往外吐——几乎不看算力**。

---

## 跑模型，其实在比三件事

### 一、出字快不快：看内存带宽

模型生成文字是一个 token 一个 token 往外吐的。每吐一个，GPU 都要把**全部权重**从内存读一遍，和刚算出的一点状态做乘法。乘法很快，读很慢。所以单人出字速度有个很粗但好用的上限：

> **出字速度 ≈ 内存带宽 ÷ 模型占的字节数**

llama.cpp 社区有两个统一跑分帖（[苹果芯片](https://github.com/ggml-org/llama.cpp/discussions/4167)、[N 卡](https://github.com/ggml-org/llama.cpp/discussions/15013)），大家用同一个模型、同一条命令贴结果。我先用手上两台跑同一条命令核对：RTX 3060 笔记本 75.2 对社区 3060 台式机 76.9，Mac mini M6 35.0 对社区 Mac mini M6 35.7，只差 2–4%，数据可信。把各台机器按带宽排开：

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
    {"x": 153, "y": 35.0, "label": "Mac mini M6", "color": "blue", "side": "right"},
    {"x": 614, "y": 119.9, "label": "M5 Max", "color": "blue", "side": "right"},
    {"x": 1228, "y": 179.1, "label": "M5 Ultra", "color": "blue", "side": "right"},
    {"x": 896, "y": 158.1, "label": "笔记本 5090", "color": "seal", "side": "left"},
    {"x": 1008, "y": 189.0, "label": "4090", "color": "seal", "side": "left"},
    {"x": 1792, "y": 300.4, "label": "台式 5090", "color": "seal", "side": "left"}
  ],
  "caption": "Llama 2 7B 4 bit，llama.cpp 单人出字速度。数据取自 llama.cpp 社区跑分帖，Mac mini M6（16 GB）和 3060 笔记本两点为我 2026-10-17 的核验实测。带宽为厂商标称值（M5 Ultra 苹果只写「1.2 TB/s」，按 M5 Max 的两倍取 1,228）。社区各条软件版本不同，只看量级。"
}
```

几乎是一条直线。每台机器都只用上了标称带宽的 56–88%，但排名完全由带宽决定：M5 Ultra 的带宽比 4090 高两成，出字差不多；台式 5090 带宽是笔记本 5090 的两倍，出字也快了将近一倍。**同样叫 5090，两条线上差了一大截。**

### 二、读长文快不快：看算力

模型读你给它的那一大段文字（预填充），是几千个 token 一起算，这时瓶颈才轮到算力。差距一下子拉开：

```chart
{
  "type": "bars",
  "fmt": {"digits": 0},
  "legend": [
    {"color": "seal", "label": "N 卡"},
    {"color": "blue", "label": "苹果芯片"}
  ],
  "rows": [
    {"label": "台式 RTX 5090", "sub": "32 GB", "value": 14970, "color": "seal"},
    {"label": "RTX 4090", "sub": "24 GB", "value": 14771, "color": "seal"},
    {"label": "笔记本 RTX 5090", "sub": "24 GB", "value": 7642, "color": "seal"},
    {"label": "M5 Ultra", "sub": "最多 512 GB", "value": 4945, "color": "blue"},
    {"label": "M5 Max", "sub": "最多 128 GB", "value": 3220, "color": "blue"},
    {"label": "RTX 3060 笔记本", "sub": "6 GB", "value": 2311, "color": "seal"},
    {"label": "Mac mini M6", "sub": "16 GB", "value": 1016, "color": "blue"}
  ],
  "caption": "读提示词速度（token/秒），Llama 2 7B 4 bit、512 token 提示。社区跑分帖；3060 笔记本与 Mac mini 为我的核验实测。"
}
```

出字差不多的 4090 和 M5 Ultra，读提示词差了三倍。短对话感觉不到；可一旦你要它读一个代码仓库、一份几十页的合同，或者让它当 Agent 一轮轮调工具——每一轮都要把越来越长的上下文重读一遍——这三倍就是三倍的等待。

### 三、能跑多大：看 GPU 实际能用的内存

带宽决定快慢，**容量决定有没有**。模型装不进去，再快也是零。这一项两家的宣传都写了总数，没写「实际能用多少」：

- **Mac 的统一内存，GPU 用不满。** 我那台 16 GB 的 Mac mini，llama.cpp 启动时读到系统给 GPU 的上限是 12.7 GB，约 79%，而且还要和系统、浏览器、编辑器共用。
- **N 卡的显存是硬上限。** 超出的部分只能放回 CPU 内存，速度会掉一个数量级（下面有实测）。消费级最大的台式 5090 是 32 GB。

> [!NOTE]
> 一个粗算法：4 bit 量化的模型，每 10 亿参数约占 0.6 GB，再给上下文（KV 缓存）和运行时留两三成。照这个算，GPU 能用 12 GB 左右只够 14B 级，24–32 GB 养得下 30B 级，128 GB 养得下 100–150B 级，512 GB 才碰得到 600B 级的 MoE 大模型。这是估算，具体以模型和量化格式为准。

---

## 按苹果脚注的测法，在基础款上跑一遍

苹果的「快 13.5 倍」用的是：14B 模型、4 bit 量化、8K token 提示，测首字时间，测试机 32 GB。我在 16 GB 的 Mac mini 上用同样的条件跑了一遍（MLX，mlx-lm），另外加测 16K 和 32K——Agent 干活时，上下文到几万 token 很常见。同一个模型也拿到 6 GB 显存的 3060 笔记本上试了试。

```chart
{
  "type": "bars",
  "fmt": {"suf": " 秒", "digits": 1},
  "legend": [
    {"color": "blue", "label": "Mac mini M6 16 GB（全部在 GPU 上）"},
    {"color": "seal", "label": "RTX 3060 笔记本 6 GB（只放得下一半）"}
  ],
  "rows": [
    {"label": "2K 提示", "sub": "Mac mini", "value": 3.4, "color": "blue"},
    {"label": "8K 提示", "sub": "Mac mini（苹果脚注的条件）", "value": 15.4, "color": "blue"},
    {"label": "16K 提示", "sub": "Mac mini", "value": 34.6, "color": "blue"},
    {"label": "8K 提示", "sub": "3060 笔记本，一半层放 GPU", "value": 21.0, "color": "seal"}
  ],
  "caption": "Qwen3-14B 4 bit，从发出提示到第一个字的等待时间（秒）。Mac mini 用 mlx-lm 0.32，3060 笔记本用 llama.cpp b11696。2026-10-18 实测，每组跑两轮取平均。32K 提示在 Mac mini 上跑不起来，没有画。"
}
```

- **8K 提示，第一个字要等 15 秒**，之后每秒 15 个 token。日常问答还能接受，但这是苹果自己选的测试条件。
- **16K 要等 35 秒**，出字降到每秒 13 个；GPU 内存用到 11.5 GB，离系统给的 12.7 GB 上限只差一点。
- **32K 直接崩溃**：Metal 报「GPU 内存不足」，程序退出。14B 模型加 32K 上下文，在 16 GB 基础款上根本跑不起来——而 Agent 读代码仓库，上下文到这个量级很平常。
- **3060 笔记本连模型都放不进显存**：14B 要 8.2 GB，6 GB 显存只能放一半，剩下的留在 CPU 上算，出字掉到每秒 4.8 个；全放 CPU 只有 2.5 个。同一张卡跑放得下的 7B，出字是 75。**N 卡的墙不是慢，是一过线就塌。**

> [!TIP]
> 还有一件宣传页不会告诉你的事：**MLX 的版本很要紧**。我第一次用系统自带的 Python 3.9 装 mlx-lm，只装上了旧版 MLX（0.29），同样 8K 提示首字要等 55 秒——慢了 3.6 倍，因为旧版用不上 M6 GPU 里的神经网络加速器。换 Python 3.13 装上 0.32 才是上面的数。用 LM Studio、Ollama 也一样，先确认它带的 MLX 够新。

---

## Mac mini 不擅长跑模型，但很擅长另一件事

说完短板，也得公平地说它的长处。同一台 16 GB 的 Mac mini，和那台 RTX 3060 笔记本（CPU 是 i7-12700H，2022 年的 14 核游戏本）跑同一份脚本，测的是我每天真会干的活。真实项目用的是一个 TypeScript 网关仓库，5,139 个测试：

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
    {"label": "跑全量测试", "sub": "65 秒 对 136 秒", "value": 2.1, "color": "blue"},
    {"label": "TypeScript 类型检查", "sub": "3.3 秒 对 7.9 秒", "value": 2.4, "color": "blue"},
    {"label": "前端构建", "sub": "31 秒 对 73 秒", "value": 2.4, "color": "blue"},
    {"label": "单核 Python 混合负载", "sub": "0.05 秒 对 0.16 秒", "value": 3.1, "color": "blue"},
    {"label": "CPU 内存拷贝带宽", "sub": "114 对 16 GB/s", "value": 7.2, "color": "blue"},
    {"label": "numpy 单精度矩阵乘", "sub": "1,988 对 434 GFLOPS", "value": 4.6, "color": "blue"},
    {"label": "起子进程", "sub": "每秒 717 对 2,119 个", "value": 3.0, "color": "seal"},
    {"label": "两万个小文件增删", "sub": "1.63 秒 对 0.74 秒", "value": 2.2, "color": "seal"},
    {"label": "git grep 整个仓库", "sub": "428 对 175 毫秒", "value": 2.4, "color": "seal"},
    {"label": "训练小 CNN", "sub": "两边各用最快框架", "value": 2.7, "color": "seal"},
    {"label": "4B 模型单人出字", "sub": "56 对 96 token/秒", "value": 1.7, "color": "seal"}
  ],
  "caption": "快多少倍（快的一方 ÷ 慢的一方）。2026-10-15 至 10-17 实测，每项多轮取稳定值。完整数字见附录。"
}
```

- **写代码、跑测试、编译，Mac mini 快一倍多。** 单核快约 3 倍，CPU 搬内存快 7 倍；SQLite 逐条提交更是快了 16 倍（0.15 秒对 2.4 秒）。
- **它慢的是系统调用多的小动作**：起子进程、增删小文件、`git grep` 慢两到三倍。但都是毫秒级——起一个子进程 1.4 毫秒对 0.5 毫秒，人感觉不到。连续满载 120 秒后，它会掉约 5% 的速度，笔记本不掉。
- **所以苹果（英文版）宣传页上说可以借助 Claude Code、Codex 这类 Agent 提升效率，这一句是成立的**：这类 Agent 的模型跑在云端，本机干的正是编译、跑测试、读写文件、调 git，这些 Mac mini 做得又快又稳。办公、写文档就更不在话下。

问题只出在「把模型也搬到这台机器上跑」。

## 苹果没写在显眼处的

1. **带宽跟着配置走，宣传写「最高」。** Mac mini M6 页面写「最高可达 170 GB/s」，16 GB 起售款是 153；Mac Studio 的 M5 Max 页面写 614 GB/s，那是 40 核 GPU 版，32 核起步版只有 460。按上面那条直线，带宽少一成，出字就慢一成。
2. **GPU 用不满统一内存。** 16 GB 实际给 GPU 约 12.7 GB，再扣掉你正在用的程序。
3. **读长文是短板。** 苹果所有「快 X 倍」都是和老款 Mac 比的；和同价位的 N 卡比，读提示词慢两到三倍。16 GB 基础款跑 14B，8K 提示要等 15 秒，32K 直接跑不起来——而 Agent、读代码仓库、长文档，正是「本地 AI」最常见的用法。
4. **软件版本决定能不能用上新硬件。** 旧版 MLX 用不上 M6 的神经网络加速器，读提示词慢 3.6 倍。
5. **它真正的长处是容量。** Mac Studio 最多 128 GB / 512 GB 统一内存，单台就能装下 N 卡要好几张才装得下的模型。这一点宣传没有夸大。

## 英伟达没写在显眼处的

1. **显存是硬上限。** 宣传页的 AI TOPS 再高，模型装不进显存，速度会断崖式下跌。
2. **笔记本和台式同名不同命。** 笔记本 5090：24 GB、896 GB/s；台式 5090：32 GB、1,792 GB/s。3060 也一样：笔记本版 6 GB，台式版 12 GB。买笔记本时要看的是显存和带宽，不是型号。
3. **AI TOPS 管的是读提示词那一下。** 出字速度看带宽，台式 5090 的产品页上恰恰没写带宽。
4. **功耗和噪音。** 台式 5090 一张卡 575 W，要配 1,000 W 电源；Mac Studio 整机满载也远低于这个数。

---

## 所以，Mac 到底适不适合跑大模型

| 你想做什么 | Mac 合不合适 | 更合适的选择 |
|---|---|---|
| 用 Claude Code、Codex 这类 Agent 写代码（模型在云端）、编译、跑测试、办公 | **很合适**：实测编译、跑测试比 i7-12700H 游戏本快一倍多 | — |
| 用苹果智能、偶尔跑 4B–8B 小模型 | **合适**，Mac mini 就够 | — |
| 本地跑 14B 级模型当日常助手，或接 Agent 读代码仓库 | **不太合适**：16 GB 基础款 8K 提示等 15 秒、32K 跑不起来；32 GB 版能装下，但读长文仍慢 | 16 GB 以上显存的台式 N 卡 |
| 30B 级模型，自己用，要快 | **一般**：要 Mac Studio 才装得下，出字和 4090 同档，读长文慢 | 24–32 GB 的台式 N 卡（4090、5090） |
| 100B 级以上，能装下优先，慢一点可以 | **最合适**：Mac Studio 128 GB / 512 GB 单台就能装下，N 卡要好几张 | — |
| 多人同时用、要读得快、长上下文 | **不合适** | 多张专业卡，或者直接买 API |

国行参考价（2026-10-18 apple.com.cn）：Mac mini M6 16 GB 6,999 元起；Mac Studio M5 Max 19,999 元起；M5 Ultra 46,999 元起。

一句话：**Mac mini 是一台很好用的开发机和 Agent 工作机，不是一台好用的本地大模型机。** 宣传页把这两件事写在了一起——「创造你自己的 AI 智能体」和在本机跑大语言模型——前一件实测成立，后一件在 16 GB 基础款上只能算「能跑，体验一般」。想在本地装下真正的大模型，要看的是 Mac Studio 那一档的大内存；想跑得快，还是 N 卡。

---

## 再往上：电和国境

如果你还想继续往上加——一台机房里的 8 卡服务器、一张最新的数据中心卡——会撞上两个和性能无关的天花板：

- **电**：英伟达 DGX Rubin NVL8 一台约 24 kW，要直触芯片的液冷；家里普通插座是 10 A（约 2.2 kW），接空调的 16 A 插座也只有约 3.5 kW。
- **国境**：Blackwell、Rubin 两代数据中心卡对华禁运，截至 2026-10 没有放行的消息；完整版 RTX PRO 6000（96 GB）也在管制线以上，中国卖的是特供的 RTX PRO 6000D（据拆解 84 GB、核心少约 17%）。

再往上的，就只能租卡或者买 token 了。

---

## 局限

- 社区跑分只测 7B 模型、单人、512 token 短提示，只覆盖 llama.cpp；各条结果软件版本不同，新版本本身会快一到三成，只看量级。
- 日常开发那组对比的是 2022 年的 i7-12700H 游戏本，不是同价位的新 PC；测试时笔记本上开着更多程序（快速重跑过一次，单核多核结果几乎一样）。npm 安装依赖的耗时受网络和缓存影响，没有计入。
- 我的复现只有 Mac mini 16 GB 一台，Mac 上只用了 mlx-lm 一个引擎，苹果原测用的是 LM Studio；32 GB 版、Mac Studio 没有实测。14B 的数字用的是 Qwen3-14B，和苹果脚注里的模型未必相同。
- 价格、出口管制都是 2026-10-18 查到的状态，变化很快；6000D 的规格来自拆解和跑分，不是官方数据。

---

## 来源

- 宣传页与脚注：苹果 [Mac mini](https://www.apple.com/mac-mini/)（[中文版](https://www.apple.com.cn/mac-mini/)，脚注 6 为「13.5 倍」的测试条件）、[Mac Studio](https://www.apple.com/mac-studio/)；英伟达 [RTX 5090](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/)、[RTX 50 系笔记本](https://www.nvidia.com/en-us/geforce/laptops/50-series/)。均为 2026-10-18 读取。
- 跑分：llama.cpp 社区 [苹果芯片帖 #4167](https://github.com/ggml-org/llama.cpp/discussions/4167)、[N 卡帖 #15013](https://github.com/ggml-org/llama.cpp/discussions/15013)（2026-10-17 抓取原文）。
- 规格：[英伟达显卡对比页](https://www.nvidia.com/en-us/geforce/graphics-cards/compare/)、[3060 笔记本版（Notebookcheck）](https://www.notebookcheck.net/NVIDIA-GeForce-RTX-3060-Mobile-GPU-Benchmarks-and-Specs.497453.0.html)；苹果 [Mac mini 规格](https://www.apple.com/mac-mini/specs/)、[Mac Studio 规格](https://www.apple.com/mac-studio/specs/)；国行价格取自 [apple.com.cn](https://www.apple.com.cn/shop/buy-mac/mac-studio)。
- 功耗与插座：[DGX Rubin NVL8](https://www.nvidia.com/en-us/data-center/dgx-rubin-nvl8/)；国标 [GB 1002-2024](https://www.chinesestandard.net/PDF/English.aspx/GB1002-2024)。
- 出口管制：[Tom's Hardware 关于 6000D](https://www.tomshardware.com/pc-components/gpus/nvidia-rtx-pro-6000d-b40-blackwell-gpus-reportedly-set-to-supersede-banned-h20-accelerators-in-china)、[PCGH 拆解](https://www.pcgameshardware.de/Grafikkarten-Grafikkarte-97980/News/Nvidia-RTX-6000D-mit-84-GiByte-GDDR7-1487562/)。

---

## 附录：跑法和完整数字

<details>
<summary>核验与复现的跑法</summary>

```bash
# 社区统一跑分的同一条命令（llama.cpp b11696 官方预编译包）
llama-bench -m llama-2-7b.Q4_0.gguf -ngl 99 -fa 0,1 -p 512 -n 128

# 苹果脚注 6 的条件：14B、4 bit、8K 提示，测首字时间（另测 16K、32K）
mlx_lm.benchmark --model mlx-community/Qwen3-14B-4bit -p 8192 -g 128 -n 2
```

</details>

<details>
<summary>两台核验机器的完整数字</summary>

| 项目 | RTX 3060 笔记本（6 GB） | Mac mini M6（16 GB） |
|---|---|---|
| Llama 2 7B 4 bit 出字 / 读提示词（token/秒） | 75.2 / 2,311 | 35.0 / 1,016 |
| 跑全量测试（5,139 个，4 分片） | 136 秒 | 65 秒 |
| TypeScript 类型检查 / 前端构建 | 7.9 秒 / 72.5 秒 | 3.3 秒 / 30.8 秒 |
| 单核 Python 混合负载 / 全核 | 0.157 秒 / 2.67 秒 | 0.051 秒 / 0.44 秒 |
| CPU 内存拷贝 / numpy 单精度矩阵乘 | 15.9 GB/s / 434 GFLOPS | 114 GB/s / 1,988 GFLOPS |
| SQLite 1,000 次逐条提交 | 2.4 秒 | 0.15 秒 |
| 起子进程 / 两万小文件增删 / git grep | 2,119 个/秒 / 0.74 秒 / 175 毫秒 | 717 个/秒 / 1.63 秒 / 428 毫秒 |
| 120 秒满载末段 ÷ 首段 | 1.005 | 0.954 |
| Qwen3-4B 4 bit 单人出字（最快引擎） | 96 | 56（MLX） |
| Qwen3-4B 4 bit 8 路同时（引擎直测） | 296 | 256（llama.cpp） |
| GPU 能用的内存 | 6 GB 显存 | 约 12.7 GB（系统上限） |
| Qwen3-14B 4 bit，8K 提示：首字 / 出字 | 21.0 秒 / 4.8 token/秒（只放得下一半，20 / 40 层） | 15.4 秒 / 14.8 token/秒（mlx-lm 0.32） |
| Qwen3-14B 4 bit，16K / 32K 提示首字 | 没测 | 34.6 秒 / GPU 内存不足，崩溃 |

</details>
