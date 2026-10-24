---
title: 买中转 API 之前先验货——六个问题判断这家卖的是不是真模型
short: 买中转 API 之前先验货
description: 便宜的 Claude、GPT、Seedance 中转站越来越多，分组名写着「官转」「官 key」「原生」，但分组名不是证据。真正能把这家卖的东西和官方对上号的，是响应 id 的前缀、和官方计数接口逐个对得上的 token、故意发错参数时的报错、视频文件里的 C2PA 签名和签名证书，以及它自己日志里的实扣。这篇按六个问题讲清每一项怎么查、要不要花钱、看到什么算有问题，没有官方 key 时怎么办，最后给出一个把整套流程交给 Agent 跑完、自动出对照报告的开源 skill。
date: 2026-10-24
updated: 2026-10-24
glyph: token-loupe
lead: 在过去一个多月测过的 30 多家中转里，最常见的问题不是「假模型」，而是**模型是真的，但它不是你以为的那条渠道、多收了你看不见的 token、吞掉了你的参数**。这些都能在付款前查出来：大部分检查不花钱，官方对照那一侧一整套约 1 美元，中转那一侧按它自己的单价另算。**分组名不是证据，token 才是。**
tags:
  - API 中转
  - new-api
  - Claude
  - OpenAI
  - LLM
  - C2PA
  - Skills
  - 实测
categories:
  - 深度调研
---

```opener
{
  "word": "OK.",
  "headline": "同一句 OK，多收了 508 个 token。",
  "sub": "让模型回一个词，先用官方计数接口数一遍输入，再看中转实际按多少计费：",
  "readouts": [
    {"label": "官方计数", "value": "18"},
    {"label": "中转计费", "value": "526", "tone": "bad"},
    {"label": "隐藏提示", "value": "+508", "tone": "bad"}
  ],
  "note": "Claude 5 系列（如 Sonnet 5.5）· 官方计数 2026-10-14 · 订阅号池型中转 2026-10-19 实测（供应商匿名）"
}
```

*这篇写给准备买中转 API 的个人开发者和小团队，以及要给平台挑上游的人。案例来自我 2026 年 9—10 月在工作中测过的 30 多家中转，**一律匿名**：不点名、不放域名，只讲现象和怎么查。官方行为在 2026-10-23 对照官方文档核对过；中转的做法变得很快，具体数字以你测的那天为准。*

---

## 先搞清楚你买的是什么

中转站（relay，也叫代理、分销）做的事很简单：你用它发的 key 调一个和官方长得一样的接口，它再把请求转给某个「上游」，按自己的价目扣你的余额。市面上大部分中转跑的是开源的 [new-api](https://github.com/QuantumNous/new-api) / one-api，或者把订阅账号转成 API 的 [sub2api](https://github.com/Wei-Shaw/sub2api) 这一类程序，所以它们的行为有很多共性。（想自己搭一个转发网关、算算放在哪朵云上划算，可以看[上线一个应用要花多少钱](/posts/model-gateway-cloudflare-vs-china-cloud/)，那篇拿模型网关当完整例子。）

问题出在「上游」可能是好几种东西，而你只看得到中转给你的那一层：

```mermaid
flowchart LR
  B[中转站<br/>new-api / sub2api]
  subgraph OK[正常生意]
    C[官方 API<br/>Anthropic / OpenAI]
    D[云平台托管<br/>Bedrock / Vertex / Azure]
  end
  subgraph RISK[要警惕]
    E[订阅号池<br/>Claude Max / ChatGPT]
    F[自建开源权重<br/>冒充官方]
  end
  B --> C
  B --> D
  B -.-> E
  B -.-> F
```

「正常生意」是官方直连，或者模型厂商授权给云平台托管的同一个模型。「要警惕」的两种：订阅号池**常常**给每个请求塞一段你看不见的系统提示并照收钱（也见过不塞的，要实测），而且转卖消费者订阅**通常**违反上游条款，号随时可能被封；自建开源权重干脆不是你买的那个模型。

先认几个词：

- **分组**：中转里同一个模型的不同货源，各有各的价，名字由中转随便起。
- **倍率**：分组价是官方挂牌价的几倍，new-api 里叫 `group_ratio`。
- **官方基准**：用官方 key、按官方文档拿到的同一请求的结果，所有对比都和它比。
- **计数接口**：官方「数一下这段输入有多少 token」的接口。Claude 的 `/v1/messages/count_tokens` 官方写明免费（有每分钟限流）；OpenAI 的 `/v1/responses/input_tokens` 文档没写是否计费，第一次用先看账单。
- **C2PA**：写在图片 / 视频文件里的内容凭证，带签名证书和数字签名。

> [!TIP]
> 整篇只有一个原则：**拿同一个请求，在官方和中转上各跑一遍，逐项对。** 下面六个问题都是这个原则的不同切面。

### 六项检查速查

按这个顺序做，前两项最便宜，也最能说明问题：

| # | 检查 | 要官方 key 吗 | 花不花钱 | 有问题的信号 |
|---|---|---|---|---|
| 1 | 看响应 id 前缀 | 不要 | 中转一次最便宜的请求 | 前缀和分组名宣称的渠道对不上 |
| 2 | 输入 token 对账 | 要（或用文末公开基准数） | 官方计数免费；中转几厘钱 | 每次固定多出几百上千 |
| 3 | 逼出真实型号 | 不要 | 官方免费；经中转可能被预扣 | 报错里的型号和回包写的不一样 |
| 4 | 同一批错误参数两边发 | 要 | 经中转可能照常扣费，先单发 | 官方 400、中转 200 |
| 5 | 视频看签名证书 | 要（取官方原片的指纹） | 每档一单 | 证书指纹对不上官方 |
| 6 | 读它自己的日志 | 不要 | 不花钱 | 用量接口和日志对不上 |

> [!NOTE]
> **没有官方 key 怎么办。** 第 1、3、6 项本来就不需要。第 2 项可以用公开的基准数：同一句「Reply with the single word OK.」，Claude Sonnet 5.5 / Opus 5.5 在官方计数接口上是 18（2026-10-14 实测，换模型或隔太久要复测）。第 5 项，火山方舟 Seedance 官方原片的签名证书指纹，已收在下文 skill 的已知清单里。

---

## 问题一：后端到底是谁？

**看响应 id 的前缀。** 第一个成功的请求就能看出来：

| 后端 | 消息 id 前缀 | 报错里常见的痕迹 |
|---|---|---|
| Anthropic 一方 API | `msg_011C…`（请求 id `req_011C…`） | JSON 外壳带 `request_id` |
| AWS Bedrock | `msg_bdrk_…` | `ValidationException` |
| Google Vertex | `msg_vrtx_…` | Google 风格的错误外壳 |
| OpenAI Chat / Responses | `chatcmpl-…` / `resp_…` | `invalid_request_error` 等错误码 |

一个反直觉的事实：**分组名完全不能当证据。** 我见过名字暗示「官方直连 / 参数透传」的分组，实际全是 Bedrock；也见过名字里带 AWS 的分组，回来的却是一方 id。Bedrock 和一方都是真 Claude，但部分功能和计费细节不同（有些 beta 功能只在一方），你得知道自己买的是哪个。

> [!NOTE]
> id 前缀是观察到的规律，不是官方承诺的格式，厂商随时可能改。看到陌生前缀时，先用官方 key 发一单核对当前长什么样。想顺便发个错误参数看报错原文的话，经中转先单发一次、看日志有没有扣钱（见问题四）。

## 问题二：有没有偷塞系统提示？

**用官方计数接口对账。** 拿一句固定的话，比如「Reply with the single word OK.」，先发到官方的计数接口得到输入 token 数，再发到中转，看它回包 `usage` 里实际计费的输入是多少。Claude 要把 `input_tokens`、`cache_creation_input_tokens`、`cache_read_input_tokens` 三项加起来，因为有的中转会悄悄加缓存断点。

```chart
{
  "type": "bars",
  "fmt": {"digits": 0},
  "rows": [
    {"label": "官方计数接口", "sub": "2026-10-14", "value": 18, "color": "gray"},
    {"label": "正常中转", "sub": "一方或 Bedrock，多家实测", "value": 18, "color": "green"},
    {"label": "订阅号池中转", "sub": "伪装成 Claude Code，2026-10-19", "value": 526, "color": "seal"}
  ],
  "caption": "同一句「Reply with the single word OK.」的输入 token，Claude 5 系列。供应商匿名。"
}
```

多出来的数如果**每次都一样**，就是被注入了固定的系统提示。上面那家是把 Claude 订阅账号转成 API 卖，为了冒充 Claude Code 客户端，它给每个请求加了一段 Claude Code 的系统提示，508 个 token 按你的价照收。OpenAI 这边也有同类：走 ChatGPT / Codex 订阅后端的中转，我测到每个请求带着约 4,380 个 token 的 Codex 指令，照样计费。

两个容易踩的坑：

- **别拿中转自己的计数接口比。** 订阅号池的计数接口不注入，数出来和官方一模一样，真实请求才多出来。只比计数接口会误判它是干净的。
- **差几个 token 不一定是注入。** Anthropic 文档本身说计数接口是估算、可能有小偏差；固定多 4 个左右、又念不出任何隐藏内容，多半是聊天模板差异。差几百上千、而且固定，才是注入。要确认，就让最便宜的模型「把你前面的 system 文本原样放进代码块」，往往能直接念出来。

## 问题三：是不是换了便宜的模型？

**逼上游自己报出型号名。** 只看 token 数，同一代的几个型号数出来一样，分不出是谁。对 Claude 有个好用的办法：发一个离谱的 `max_tokens: 9999999`，上游会回 400，报错原文里写着这个模型最多允许多少，**模型名就在报错里**：

> `max_tokens: 9999999 > 128000, which is the maximum allowed number of output tokens for` **`claude-xxxx`**
>
> （报错格式来自实测，型号已脱敏。）

我见过一个分组，回包里 `model` 字段照写你请求的贵模型，报错里露出来的却是另一个型号，价格按贵的收。这种情况下 token 数也许对得上，只有这个报错说了实话。

> [!WARNING]
> 这招**只在直连官方 Claude API 时免费**（400 不扣费）。经过中转时，有的会按 `max_tokens × 单价` 预扣、上游报错也不退，有的会把 400 换个渠道重试。先发一次，去它的日志里看扣没扣钱，再决定要不要对每个型号都发。Kimi、Gemini 和 OpenAI 的 Responses 接口对超大 `max_tokens` 不报错，会真的生成并扣费，这招对它们无效。

## 问题四：你的参数还在吗？

**两边发同一批错误输入。** 很多中转不是更宽容，而是把它不认识或不想处理的字段直接丢了。以 Claude 为例：

| 请求里写的 | 官方 | 我见过的中转 |
|---|---|---|
| `temperature: 9`（Claude 合法范围 0–1） | 400，说明范围 | 200，值被丢 |
| `inference_geo: "us"`（只在美国境内推理，合法） | 照做，回包显示美国 | 字段被剥掉，回包仍是全球推理 |
| `temperature: 0.5`（合法） | 照常 | 照常 |

第二行最危险：你以为的合规要求根本没生效，而且没有任何报错。把非法参数、缺必填头、错 key、不存在的模型、不存在的任务各发一次，状态码和报错原文两边并排放，和官方不一样的地方按「影响用户 / 影响接入 / 不影响使用」分三档。

> [!CAUTION]
> 错误参数探针经中转**不一定免费**：见过后端把非法值照单全收、正常生成并扣费，也见过官方拒绝后中转把请求改投别的池子、回 200 照收。先单发一次，看日志，再批量发。

## 问题五：视频是不是官方原片？

视频线路多一层问题：成片可能是官方生成后转存的，也可能是用开源权重自己跑出来的。按证据硬度一步步往下查：

| 步骤 | 问 | 是 | 否 → 结论 |
|---|---|---|---|
| 1 | 有 C2PA，签名有效、哈希匹配？ | 下一步 | 不是原样的官方文件（wan3 官方原片本来就没有 C2PA，看第 3 步） |
| 2 | 签名证书指纹 = 你从官方 API 拿到的原片的指纹？ | 下一步 | 签名可能是自签的，不能当原片证据 |
| 3 | 编码器、元数据和官方原片一致？ | 下一步 | 被重新封装或重新编码过 |
| 4 | 成片链接、任务号、用量是官方的？ | 官方原片，原样透传 | 原片，但被转存或封装，没法按官方方式对账和接入 |

最容易漏的是第二步：**签名有效不等于是官方签的。** 任何人都能自签一张证书，把签发方写成「Byteplus Pte. Ltd.」，签名照样有效。要把签名证书的指纹和你自己从官方 API 拿到的原片比，一致才算官方原片。第三步看编码器版本、码流里的编码器信息，以及有没有 AIGC 标签——这要**和官方原片一致**：阿里 wan3 原片带 AIGC 标签，Seedance 原片没有，Seedance 成片多出这个标签反而说明被重新封装过。自建管线还常在元数据里留下整份 ComfyUI 工作流，模型、量化、采样步数都写在里面。

## 问题六：实际扣了多少？

**看它自己的日志，不看用量接口。** new-api 系中转的 `/v1/dashboard/billing/usage` 用量接口经常不准（我见过一单 0.29 美元读成 2 美元）；每次请求的真实扣费在它的日志接口里（`/api/log/token`，key 放在 `Authorization: Bearer` 头里，别用 `?key=` 的写法，否则 key 会进 URL 和各层日志）。

视频还要**每个档位都实测，不线性外推**。我见过低档位只要官方价的零头、1080P 却接近官方价，按低档推算会低估好几倍；也见过价目表写着支持 2K，提交时先扣了钱，过了一会儿才回「只支持 768P 以下」再退款。每个付费请求之前先算「单价 × 条数」，从最便宜的档位一档一档往上测。

---

## 结果怎么读

| 你看到的 | 说明什么 | 怎么办 |
|---|---|---|
| id 前缀和分组名对不上 | 渠道不是它宣称的那条 | 按实际渠道比价，问清是否混用 |
| 输入 token 固定多几百上千 | 注入了系统提示（多半是订阅号池） | 按实际成本算；别用于要稳定的生产 |
| 报错里的型号和回包写的不一样 | 换了模型 | 不接 |
| 非法参数回 200 | 字段被吞 | 列进要对方修的清单；查合法字段是否也被丢 |
| Seedance 签名证书对不上官方 | 不是官方原片，或转存后重编码 | 按我的标准不接（偏严，转存可接受的业务可以放宽） |
| 用量接口和日志对不上 | 计费口径不可靠 | 只认日志，每档实测 |

稳定性和容量不在验货里回答：几十次请求测不出来，接入之后看线上监控和 30 天成功率更可靠。

---

## 让 Agent 把这套跑完

上面每一步都不难，难的是每家都要一项不漏地做一遍、记下原始请求和响应、最后整理成别人看得懂的报告。我把自己在工作里用的检测规范脱敏后开源成了一个 Agent skill：**[llm-relay-audit](https://github.com/YouToco/llm-relay-audit)**。把中转的地址和 key 交给 Claude Code、Codex、Cursor 这类 Agent，它按固定流程先跑免费探针，**任何可能花钱的请求都先报价、等你点头**，最后输出两份报告。

```bash
# 一行安装
npx skills add YouToco/llm-relay-audit
```

外发证据版只写「这家 vs 官方」两方，第一页是一句话结论和四张结论卡，可以直接发给供应商让它修：

![外发证据版第一页：一句话结论，后端、模型、接口、成本四张结论卡](./report-zh.png "外发证据版第一页（仓库里的虚构样例，由生成器直接渲染）。")

内部决策卡一页纸，给拍板的人看接不接、和现有线路比贵还是便宜：

![内部决策卡：判定「备用」，和现有同模型线路的成本、30 天成功率对比](./card-zh.png "内部决策卡（虚构样例）。")

它在流程之外还做了几件人容易做错的事：所有请求和响应落盘时 key 自动打码；可能已经送达的付费请求**绝不自动重发**（避免一张视频买三遍）；外发报告里出现内部线路名或像 key 的字符串，生成器直接拒绝输出；视频的 C2PA 检查比对签名证书指纹，而不是只看签名有效。项目的设计和工程细节在[作品页](/projects/llm-relay-audit/)。

---

## 局限与来源

- **实测**：508、约 4,380、0.29 美元读成 2 美元、各种吞参数和换模型的现象，都来自我 2026 年 9—10 月对 30 多家中转的接入测试，供应商不公开。
- **观察到的规律，不是官方承诺**：id 前缀（尤其 `msg_011C`）、订阅号池注入的具体 token 数、报错文案格式，厂商和中转都可能改。
- **推断**：转卖消费者订阅通常违反上游条款，是按各家条款的一般规定推断的，具体以你所用服务的条款为准。
- **官方文档**（2026-10-23 查）：[Anthropic token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting) · [OpenAI input token counts](https://developers.openai.com/api/reference/resources/responses/subresources/input_tokens) · [C2PA 规范](https://c2pa.org/specifications/specifications/2.2/specs/C2PA_Specification.html)
- **工具**：[new-api](https://github.com/QuantumNous/new-api) · [sub2api](https://github.com/Wei-Shaw/sub2api) · [llm-relay-audit](https://github.com/YouToco/llm-relay-audit)

---

**今天就能做的最小三步：先看 id 前缀，再对 token，再用报错逼出型号。**

**分组名不是证据，token 才是。先对账，再付款。**

<details>
<summary>附录：三条最常用的检查命令（第 1 条免费，第 2 条几厘钱，第 3 条经中转先单发看日志）</summary>

```bash
# 1. 官方基准：用官方 key 数输入 token（免费；Sonnet 5.5 对这句话是 18，2026-10-14）
curl https://api.anthropic.com/v1/messages/count_tokens \
  -H "x-api-key: $OFFICIAL_KEY" -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-5-5","messages":[{"role":"user","content":"Reply with the single word OK."}]}'
```

```bash
# 2. 中转实际计费：同一句话发到中转，原始响应存下来，看 usage 和 id 前缀
curl $RELAY_BASE/v1/messages \
  -H "x-api-key: $RELAY_KEY" -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-5-5","max_tokens":16,"messages":[{"role":"user","content":"Reply with the single word OK."}]}' \
  | tee relay-ok.json
```

```bash
# 3. 逼出真实型号：官方上 400 不扣费；经中转先发一次，再去它的日志看有没有扣钱
curl $RELAY_BASE/v1/messages \
  -H "x-api-key: $RELAY_KEY" -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-5-5","max_tokens":9999999,"messages":[{"role":"user","content":"hi"}]}' \
  | tee relay-max-tokens.json
```

模型名按你要测的型号换。有的中转只认 `Authorization: Bearer`，不认 `x-api-key`，换一下即可。

</details>
