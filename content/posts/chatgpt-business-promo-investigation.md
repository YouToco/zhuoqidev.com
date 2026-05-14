---
title: "ChatGPT Business 48 个月优惠的源头究竟在哪——一次羊毛溯源调查"
description: "追踪 codestonegb、thealloynetwork 等优惠码从 Stripe 合作伙伴泄露到中文社区的完整链路，揭示 OpenAI 不公开的秘密促销体系。"
date: 2026-05-14
tags: ["ChatGPT", "OpenAI", "Stripe", "优惠码", "信息溯源", "OSINT"]
categories: ["调查"]
showToc: true
---

2026 年 5 月，中文 AI 圈被一波 ChatGPT Business 优惠刷屏了。英国区 2 席位月付 £11、美国区 $20、澳洲区 AU$25，最长持续 48 个月。`codestonegb`、`thealloynetwork`、`firstfocus` 这些神秘代码在 V2EX、linux.do、各大博客之间疯狂扩散。

但一个关键问题没人回答：**这些码到底从哪来的？**

我花了几天做了多源溯源调查。结论比"L 站首发"复杂得多。

---

## 优惠码不是 OpenAI 公开发布的

先把最重要的事实摆出来：**OpenAI 官方从未在任何公开渠道发布过这些优惠码。**

查遍 OpenAI 官方信息出口：
- `openai.com/index/`（官方博客）——只发产品发布公告，从不写 Promo Code
- `help.openai.com`（帮助中心）——有促销机制的通用 FAQ，但**从不列出具体码**
- `openai.com/pricing`（定价页）——标准价格，无优惠入口
- 官方 X 账号 `@OpenAI`——没有相关推文

OpenAI 的促销分发机制在官方文档里写得很清楚：**通过电子邮件定向发给"符合资格的用户"，或在产品内弹窗触发。** 资格由 OpenAI 决定，不是所有人可见。

那这些码怎么泄露出来的？

---

## 真正源头：Stripe 合作伙伴网络

OpenAI 从 2023 年起使用 **Stripe Billing + Stripe Checkout** 处理 ChatGPT 付费订阅。这套系统支持 Promo Code 机制——Stripe 允许为特定合作伙伴生成专属优惠码，通过 URL 参数 `?promoCode=XXX` 传递给支付网关。

每个码背后都是一家 Stripe 合作企业：

| 优惠码 | 区 | 关联企业 |
|--------|------|---------|
| `codestonegb` | 英国 | CodeStone (IT 服务商) |
| `thealloynetwork` | 美国 | The Alloy Network |
| `firstfocus` | 澳 | First Focus IT |
| `THINKTECHNOLOGIESUS` | 美国 | Think Technologies |
| `monicaius` | 美国 | Monica AI |
| `datroaiuk` | 英国 | Datro AI |
| `geccogb` | 英国 | GECC |

这些企业通过 Stripe 拿到专属码后，本应内部使用。但总有人会"手抖"——某个员工把链接发到了公开社区，然后就像野火一样扩散。

**所以真正的源头是 Stripe 企业合作伙伴的员工，而不是任何一个社区。**

---

## 各码的实际首现渠道

追踪每个码的最早出现时间戳，发现**不存在单一源头**：

| 优惠码 | 最早时间 | 首发渠道 |
|--------|---------|---------|
| `alongsideus` / `monicaius` | 5月1日 | 邮莓生活 (mailberry.com.cn) |
| `THINKTECHNOLOGIESUS` | 5月9日凌晨 | **X (Twitter) + linux.do 同时** |
| `codestonegb` | 5月9日 | X + linux.do 同步出现 |
| `firstfocus` | 5月10日 | **OzBargain** (澳洲 deal 社区) |
| `thealloynetwork` | 5月10日 | linux.do 福利羊毛版块 |
| `datroaiuk` | 5月12日 | 数字居民论坛 (shuzijumin.com) |
| `geccogb` | 5月10日 | **OzBargain** |

**5 月 9 日凌晨是个关键节点。** 钛刻科技一篇教程中记录："2026年5月9日凌晨1点，在X和L站都看到了 ChatGPT Team 买一送一持续48个月的消息。"这说明信息在 X 和 linux.do **几乎同步出现**。

也就是说：
- **linux.do** 是中文圈核心集散地，但不是独家首发
- **X (Twitter)** 上的日语/英语博主与 L 站基本同步
- **OzBargain** 是澳洲/英国区码的首发渠道
- **数字居民论坛** 偶尔爆冷门新码

---

## 时间线：各码泄露的精确节奏

{{< mermaid >}}
gantt
    title       ChatGPT Business 优惠码泄露时间线
    dateFormat  YYYY-MM-DD
    axisFormat  %m-%d
    tickInterval 2day

    section 前奏期
    Team免费试用接口关闭        :done,   crit,   a1, 2026-04-28, 1d
    80aj转载2月免费版            :done,           a2, 2026-04-30, 1d

    section 第一批码
    alongsideus / monicaius     :active,         b1, 2026-05-01, 1d
    码(邮莓生活首发)            :                 b1a, 2026-05-01, 1d

    section 爆发期
    THINKTECHNOLOGIESUS         :done,   crit,   c1, 2026-05-09, 1d
    codestonegb (X+L站同时)     :done,   crit,   c2, 2026-05-09, 1d

    section 扩散期
    firstfocus (OzBargain首发)  :done,           d1, 2026-05-10, 1d
    thealloynetwork (L站首发)   :done,           d2, 2026-05-10, 1d
    geccogb (OzBargain)         :done,           d3, 2026-05-10, 1d
    xwuxl.com教程发布           :done,           d4, 2026-05-10, 1d

    section 长尾期
    L站价格对比帖               :done,           e1, 2026-05-11, 1d
    V2EX大规模扩散              :done,           e2, 2026-05-11, 1d
    datroaiuk (数字居民论坛)    :done,           e3, 2026-05-12, 1d
{{< /mermaid >}}

**4月28日 GPT Team 免费试用接口被关 → 4月30日 中文圈开始注意到 US IP 2月免费版 → 5月1日 第一批 Stripe 企业码流出 → 5月9日凌晨 信息双平台同时引爆 → 5月10-12日 各区域码密集出现。**

---

## 完整传播链路

{{< mermaid >}}
flowchart TD
    A["🏢 Stripe 企业合作伙伴<br/>（码的真正诞生点）"]
    
    A --> B["💬 企业员工泄露<br/>TG / Discord 私聊"]
    A --> C["🐦 X (Twitter)<br/>日英博主分享"]
    A --> D["🦘 OzBargain<br/>澳洲 deal 社区"]
    
    B --> E["🐧 linux.do<br/>中文圈信息集散地"]
    C --> E
    D --> E
    
    E --> F["📰 80aj.com / Toy<br/>4.30 首发2月免费版"]
    E --> G["🌐 V2EX<br/>5.11 大规模传播"]
    E --> H["📝 博客转载<br/>xwuxl.com / mailberry"]
    
    F --> I["📱 B站 / 知乎 / 公众号<br/>5.11-12 末梢扩散"]
    G --> I
    H --> I

    style A fill:#c44020,stroke:#a03018,color:#fff
    style E fill:#2563eb,stroke:#1d4ed8,color:#fff
    style I fill:#6b7280,stroke:#4b5563,color:#fff
{{< /mermaid >}}

**关键特征：不是链式传播，而是多源并行泄露。**

---

## 各区域实际到手价对比

同一套餐（2 席位月付），不同区域码的到手价差异可达 40%：

{{< chart >}}
type: 'bar',
data: {
  labels: ['英国 codestonegb', '英国 datroaiuk', '澳洲 firstfocus', '美国 thealloynetwork', '美国 THINKTECHNOLOGIESUS'],
  datasets: [{
    label: '月付折合人民币 (元)',
    data: [102, 102, 120, 145, 145],
    backgroundColor: ['#c44020', '#c44020', '#2563eb', '#059669', '#059669'],
    borderRadius: 6,
  }]
},
options: {
  indexAxis: 'x',
  plugins: {
    legend: { display: false }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: { display: true, text: '人民币 / 月' }
    }
  }
}
{{< /chart >}}

| 区域 | 原价 (2席位) | 优惠后 | 折合 CNY | 优惠幅度 |
|------|------------|--------|---------|---------|
| 英国 | £36 | **£11** | ~¥102 | 减 £25 (69%) |
| 澳洲 | AU$70 | **AU$25** | ~¥120 | 减 AU$45 (64%) |
| 美国 | US$50 | **US$20** | ~¥145 | 减 US$30 (60%) |

> 英国区码到手价最低，比美区便宜约 30%。但需要英国 IP + 对应码。

---

## 为什么 linux.do 被误认为源头

1. L 站**整理和归纳能力最强**——散落在各平台的零碎信息被集中到一个帖子里，附带 Console 脚本和支付教程
2. 80aj.com 等博客在转载时明确写了"据 linux.do 用户爆料"，强化了"L 站是源头"的印象
3. L 站的**时效性标签很清晰**，发布时间戳容易追溯，而 X 上的碎片信息容易淹没
4. 中文用户的信息获取路径天然以 L 站为中心

但实际调查发现：**澳洲区码首发在 OzBargain，部分英国码首发在数字居民论坛，美国码在 X 和 L 站同时出现。** 没有"唯一源头"。

---

## 想第一时间追到这类优惠，该蹲哪里

按优先级排序：

| 优先级 | 渠道 | 擅长方向 | 备注 |
|--------|------|---------|------|
| **P0** | **X (Twitter)** | 日/英/美区新码 | 搜 `ChatGPT promo code`，几乎与泄露同步 |
| **P0** | **linux.do 福利羊毛** | 全球码汇总 + 脚本 | 信息最全但比最快的慢几小时 |
| **P0** | **OzBargain** | 澳洲/英国区码 | `ozbargain.com.au` 搜 ChatGPT |
| **P1** | **数字居民论坛** | 偶尔有冷门码 | shuzijumin.com |
| **P2** | **V2EX** | 中文扩散 | 比 L 站慢半天到一天 |
| **P3** | 各类博客 | 教程整理 | 系统但时效性最差 |

**一句话：多平台同时蹲，不要押注单一信息源。**

---

## 更高维度的认知

这波 ChatGPT Business 优惠的本质是：

**OpenAI 通过 Stripe Partner Network 对 B 端客户进行定向补贴，用 B 端渠道间接获客。** 这不是面向消费者的促销，而是企业级销售的副产品。每个码都是真金白银的企业合作成本，所以**随时可能被收回**——没有公告，没有预警。

理解这一点，你就不会把这类优惠当成"可以一直薅的羊毛"，而是**精准狙击，快速上车，及时下车。**

*此次调查由 Claude Code 多源交叉验证驱动，信息截止 2026-05-14。*
