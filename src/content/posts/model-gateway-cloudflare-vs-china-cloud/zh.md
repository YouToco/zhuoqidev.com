---
title: 后端服务放 Cloudflare、国内云还是海外大厂——按服务类型看技术适配和成本，以模型网关为例实查七家云的账单
short: 服务放哪朵云
description: 选部署平台之前，先看服务把时间和钱花在哪：在等还是在算、每个请求搬多少字节、状态怎么写。本文先用这三个问题给常见后端服务分类，说清边缘函数、按时长计费的 Serverless、常驻机器各适合哪一类；再以模型网关为例算到每一项。模型网关的一个请求要挂 20 秒等上游吐 token，真正干活只有约 10 毫秒。Cloudflare 按干活的毫秒数收费、出流量免费，但每次读写状态都要单独付钱；阿里云、腾讯云和 AWS、Google Cloud、Azure 的状态几乎免费，但网关替客户转发 prompt 的每个字节都按流量计费；Oracle 每月前 10 TB 出流量免费，是唯一的例外。本文用 aliyun CLI、tccli、各家公开价格接口和官方价目页实查 2026-10-09 的价格，按每月 1,000 万、1 亿、10 亿次请求把七家的账单算到每一项，再加上延迟、可达性和真实案例，给出什么时候选哪边的判断。
date: 2026-10-09
updated: 2026-10-09
lead: 选平台先给服务分类：时间花在等还是算、每个请求搬多少字节、状态怎么写。同一种平台，对一类服务最省，对另一类可能最贵。以模型网关为例：量小时，Cloudflare 比所有云的自建都便宜一个数量级；量到每月 10 亿次，大多数云的自建只比它贵三成到一倍多，出流量几乎免费的 Oracle 反倒最便宜。**决定胜负的不是算力，是「谁为等待收钱、谁为搬运收钱、谁为状态收钱」。**
tags:
- 模型网关
- LLM Gateway
- Cloudflare Workers
- Durable Objects
- 阿里云
- 腾讯云
- 成本测算
- 架构选型
- Serverless
categories:
- 深度调研
---

**版本范围**：价格是 2026-10-09 查到的公开目录价，不含折扣和活动价。国内两家用官方命令行工具的询价接口查，其余几家用公开价格接口或官方价目页；汇率 1 美元 = 6.7153 元。命令、工具版本和完整的数字表都放在文末的[附录](#附录怎么查的和完整数字)。

> [!NOTE]
> **模型网关的账单都建立在一组示意假设上**：每个请求挂 20 秒、网关只算 10 毫秒、来回传 50 KB，机器规格也没有压测。最敏感的是最后一个数，也就是每个请求传多少字节。[这张图](#每个请求传多少字节决定谁便宜)能看出你的业务落在哪一边。

---

## 先说结论

**先给服务分类，再挑平台。** 时间花在等还是算、每个请求搬多少字节、状态怎么写，这三个问题决定哪种平台在技术上合适、在账单上便宜。同一种平台，对一类服务最省，对另一类可能最贵：按时长计费的 Serverless 对等待型服务最贵，对偶发的计算型服务反而合适。[服务分类那一节](#先给服务分类三个问题决定放哪)有一张对照表，列了常见服务各落在哪。

下面以模型网关为例，它是典型的等待型服务。先看三个规模下，各家自建和 Cloudflare 每月要花多少钱（点上面的标签切换规模）：

```chart
{
 "type": "bars",
 "fmt": {"pre": "¥"},
 "legend": [
   {"color": "seal", "label": "Cloudflare"},
   {"color": "green", "label": "Oracle"},
   {"color": "gray", "label": "其他云自建"}
 ],
 "panels": [
   {
    "title": "每月 1,000 万次请求",
    "rows": [
      {"label": "Cloudflare", "sub": "常规写法", "value": 140, "color": "seal"},
      {"label": "Cloudflare", "sub": "优化写法", "value": 67, "color": "seal"},
      {"label": "阿里云 · 深圳", "value": 1625},
      {"label": "腾讯云 · 广州", "value": 1422},
      {"label": "AWS · 美东", "value": 2467},
      {"label": "Google Cloud · 美东", "value": 3056},
      {"label": "Azure · 美东", "value": 4794},
      {"label": "Oracle · 美东", "value": 1973, "color": "green"}
    ]
   },
   {
    "title": "每月 1 亿次",
    "rows": [
      {"label": "Cloudflare", "sub": "常规写法", "value": 2756, "color": "seal"},
      {"label": "Cloudflare", "sub": "优化写法", "value": 2115, "color": "seal"},
      {"label": "阿里云 · 深圳", "value": 5854},
      {"label": "腾讯云 · 广州", "value": 5359},
      {"label": "AWS · 美东", "value": 6646},
      {"label": "Google Cloud · 美东", "value": 7387},
      {"label": "Azure · 美东", "value": 9125},
      {"label": "Oracle · 美东", "value": 2388, "color": "green"}
    ]
   },
   {
    "title": "每月 10 亿次",
    "rows": [
      {"label": "Cloudflare", "sub": "常规写法", "value": 32574, "color": "seal"},
      {"label": "Cloudflare", "sub": "优化写法", "value": 25139, "color": "seal"},
      {"label": "阿里云 · 深圳", "value": 45696},
      {"label": "腾讯云 · 广州", "value": 45179},
      {"label": "AWS · 美东", "value": 47179},
      {"label": "Google Cloud · 美东", "value": 43798},
      {"label": "Azure · 美东", "value": 49848},
      {"label": "Oracle · 美东", "value": 8832, "color": "green"}
    ]
   }
 ],
 "caption": "每月账单，人民币目录价（2026-10-09）。自建 = 负载均衡 + 两个可用区的机器 + Redis + MySQL + 日志 + 出流量。香港、新加坡等地域，以及托管网关、Serverless 的完整数字在文末附录。"
}
```

模型网关这一类的六条判断：

1. **量小时，Cloudflare 便宜一个数量级。** 每月 1,000 万次请求，Cloudflare 一百多元，最便宜的自建也要一千四百元左右。云厂商的钱花在保底上：两台机器、一个高可用数据库、一个 Redis，没有流量也要付。
2. **量大以后，两边的钱花在不同的地方。** Cloudflare 花在状态读写上，每次查 key、记账都单独收钱；其他云花在出流量上，网关替客户转发的每个字节都收钱。到每月 10 亿次，阿里云、腾讯云和三大海外云的自建只比 Cloudflare 贵三成到一倍多。
3. **Oracle 是例外。** 它每月前 10 TB 出流量免费，美东自建在量大时比 Cloudflare 还便宜约三倍。代价是要自己运维机器。
4. **最敏感的不是请求数，是每个请求传多少字节。** 短问答这种小请求，云厂商自建反而比 Cloudflare 便宜；编码 Agent 动辄几百 KB 的请求，Cloudflare 便宜好几倍。
5. **按挂钟时间计费的 Serverless，量大以后最贵。** 函数计算、云函数、Lambda 这类产品都要为等上游的 20 秒付钱，六家云厂商没有例外。
6. **账单之外，还要看用户在哪。** 从深圳访问国内云 10 毫秒上下，访问 Cloudflare 要 160 毫秒。**用户主要在中国大陆，就放国内云；在海外，量小放 Cloudflare，量大、流量重考虑 Oracle 自建。**

---

## 这篇写给谁

- 你在给一个后端服务选部署平台（Cloudflare、国内云、海外云），不一定做模型网关。前半篇的分类适用于大多数后端服务，后半篇用模型网关做完整例子。
- 例子部分假设你知道 LLM API 怎么调用，知道流式输出是一段一段推回来的（SSE），写过或配过反向代理、API 网关。
- 你**不需要**用过 Cloudflare Workers 或阿里云负载均衡；用到的产品会在下面的术语表里先讲清楚。
- 本文**不讨论**模型推理本身（GPU、推理引擎），也不展开合规细节，只在影响架构的地方点到为止。

### 术语表

| 术语 | 一句话解释 |
|---|---|
| 挂钟时间 | 一个请求从进来到结束经过的真实时间，包括等别人的时间 |
| CPU 时间 | 程序真正在算的时间，等网络、等数据库的时间不算 |
| 等待型 / 计算型 | 一个请求的时间主要花在等别人（网络、上游、数据库），还是花在自己算；常见的说法是 I/O 密集型、CPU 密集型 |
| SSE（服务器推送事件） | 模型流式输出的格式：一个 HTTP 响应不断开，每生成一小段就推一行 `data: …` |
| 自建 | 在云服务器上自己跑网关进程：负载均衡 + 两个可用区的机器 + Redis + MySQL + 日志 |
| Workers | Cloudflare 的边缘函数，跑在全球机房里，按请求数和 CPU 时间计费 |
| Durable Object（下文简称 DO） | Cloudflare 的「有名字的单线程小服务」：同一个名字全球只有一个实例，适合做每个 API key 的计数器和余额 |
| KV / Queues / D1 | Cloudflare 的全球键值缓存（最终一致）/ 消息队列 / SQLite 数据库 |
| 边缘函数 | 阿里云 ESA 的「函数和 Pages」、腾讯云 EdgeOne 的边缘函数，都是国内版的「Workers」 |
| ICP 备案 | 网站用中国大陆的服务器或节点对外服务前，必须完成的工信部登记 |

---

## 先给服务分类：三个问题决定放哪

选平台之前先别问哪家便宜，先问你的服务把时间和钱花在哪。三个问题就够分清楚，而且它们互相独立：

1. **时间花在等，还是花在算？** 网关、代理、调大模型的后端，一个请求大部分时间在等别人；图片和视频处理、PDF 渲染、压缩加密，一个请求大部分时间在算。
2. **每个请求搬多少字节？** 普通 API、短问答是几 KB；长上下文、文件、图片和视频是几百 KB 到几 MB。
3. **状态怎么读写？** 没有状态；读多写少、能缓存（配置、key 列表）；每个请求都要强一致地写（计数、余额、库存、会话）。

再加一个约束：**用户在哪**。它不改变账单的结构，但决定了延迟，也决定了能不能用某家平台：在中国大陆对外服务要 ICP 备案，Cloudflare 除了 Enterprise 的 China Network 没有大陆节点。

三类平台对这三个问题的反应完全不同。打个比方，服务像电话接线员：接通只要几秒，但一通电话要聊二十秒。

- **按 CPU 时间收费（Cloudflare Workers 这类边缘函数）**：只为接线员动手的那几秒付钱。
- **按实例活跃时长收费（Lambda、函数计算、云函数、Cloud Run）**：为整通电话付钱，接线员发呆也算。
- **按预留容量收费（云服务器、负载均衡）**：按雇了几个接线员付钱，忙闲都一样。

另外两项各家也不一样：Cloudflare 出流量不收费、状态按读写次数收费；其他云出流量按字节收费、状态（Redis、数据库）按台收费。放进一张表（✓ 合适，△ 能用但有条件，✗ 不合适）：

| 服务的特点 | 边缘函数（Workers） | 按时长计费的 Serverless | 常驻机器 / 容器 |
|---|---|---|---|
| 等得多、算得少 | ✓ 等待不收钱 | ✗ 等多久收多久 | ✓ 等待只占连接、不占 CPU |
| 算得多（单次几百毫秒以上） | △ CPU 按毫秒收，单价偏高；单次 CPU 最长 5 分钟、内存 128 MB | ✓ 偶发、突发的最合适：挂钟时间几乎都在算，不吃亏；Lambda 单次最长 15 分钟 | ✓ 持续高负载最便宜 |
| 出流量重 | ✓ Cloudflare 出流量免费 | ✗ 按字节收 | ✗ 按字节收（Oracle 例外） |
| 每个请求都要强一致地写状态 | △ 每次读写单独收钱，要按 key 拆 DO | △ 要外接 Redis 或数据库，还要管好连接数 | ✓ Redis 按台收钱，量大便宜 |
| 读多写少、能缓存 | ✓ KV 读便宜 | ✓ | ✓ |
| 用户在中国大陆 | ✗ 没有大陆节点 | ✓ 用国内云的 | ✓ 用国内云的 |

**算得多的服务，比的是每 CPU 小时的价：**

```chart
{
 "type": "bars",
 "fmt": {"pre": "¥", "digits": 2},
 "legend": [
   {"color": "seal", "label": "按 CPU 毫秒计费"},
   {"color": "gold", "label": "按时长计费的 Serverless"},
   {"color": "gray", "label": "机器（满载时）"}
 ],
 "rows": [
   {"label": "腾讯云 CVM", "sub": "SA9 包月", "value": 0.1, "color": "gray"},
   {"label": "Oracle", "sub": "E6.Flex 按需", "value": 0.128, "color": "gray"},
   {"label": "阿里云 ECS", "sub": "c9i 包月", "value": 0.136, "color": "gray"},
   {"label": "Google Cloud", "sub": "c4 按需", "value": 0.286, "color": "gray"},
   {"label": "AWS EC2", "sub": "c8i 按需", "value": 0.315, "color": "gray"},
   {"label": "Azure", "sub": "F4als_v7 按需", "value": 0.406, "color": "gray"},
   {"label": "Cloudflare Workers", "sub": "按 CPU 毫秒", "value": 0.484, "color": "seal"},
   {"label": "AWS Lambda", "sub": "Arm，1,769 MB ≈ 1 vCPU", "value": 0.57, "color": "gold"},
   {"label": "AWS Lambda", "sub": "x86", "value": 0.713, "color": "gold"}
 ],
 "caption": "每 CPU 小时的价（人民币，2026-10-09）。机器按 4 vCPU 的月价折算，是 100% 用满时的价；平均只用三成，实际单价要乘以三左右。Lambda 按 1,769 MB 内存约等于 1 个 vCPU 折算。"
}
```

Workers 的 CPU 单价是阿里云包月机器的约 3.6 倍、AWS 按需机器的约 1.5 倍。但机器要按峰值买，平时用不满：和阿里云比，机器平均利用率低于约三成时，Workers 按毫秒计费反而便宜。Lambda 这类按时长计费的单价更高，但对计算型服务不冤，因为挂钟时间几乎都在算；它适合偶发、突发的活，持续跑满的计算还是放机器最便宜。还要看硬限制：Workers 单次 CPU 最长 5 分钟、内存 128 MB，大图处理、长视频转码这类活放不下。

**常见的服务落在哪：**

| 服务 | 时间花在 | 每个请求的字节 | 状态 | 适合放哪 |
|---|---|---|---|---|
| 模型网关、LLM 代理（本文的例子） | 等 | 中到重 | 每个请求强一致地写两次 | 后面全文 |
| 调大模型的应用后端（Agent、RAG、AI 客服） | 等 | 中 | 会话、用量 | 和模型网关同一类：边缘函数或常驻进程，别用按时长计费的 Serverless |
| 实时推送、聊天（SSE、WebSocket） | 等（长连接） | 轻 | 在线状态、房间 | Workers + DO（WebSocket 休眠期间不收时长费），或常驻进程 + Redis |
| 慢接口代理、BFF、Webhook 中转 | 等 | 轻 | 没有或很少 | 边缘函数最省；量大以后常驻进程也划算 |
| 图片、PDF、视频处理 | 算 | 重 | 没有 | 偶发用按时长计费的 Serverless，持续用机器；边缘函数受 CPU 和内存上限所限 |
| 文件和媒体下载 | 几乎不算 | 很重 | 没有 | 对象存储加 CDN；海外用户可以用出流量免费的 Cloudflare R2 |
| 高频短请求（鉴权、计数、限流服务） | 很少 | 轻 | 每个请求都要读，要求毫秒级 | 常驻进程加内存缓存（Unkey 从 Workers 迁走就是这个原因，见后文） |

*表：按三个问题给常见后端服务归类（本文的判断，不是官方建议）。*

**模型网关落在第一行**：等得多、算得少，每个请求的流量中到重，还要强一致地写两次状态。下面就拿它做完整的例子：把账单算到每一项，看三个问题各自让账单怎么变。

---

## 从第一性原理推：一个模型网关请求长什么样

模型网关做的事，拆到最小只有六步：

```mermaid
flowchart TD
    C(["客户端"]) --> A["① 查 API key<br>是谁、能用哪些模型"]
    A --> B["② 占并发位、预扣余额<br>超了直接 429"]
    B --> R["③ 选上游线路"]
    R --> U["④ 把请求体转发给上游"]
    U --> S["⑤ 把 SSE 流原样转回<br>约 20 秒，几乎不用 CPU"]
    S --> F["⑥ 读出 usage，释放并发位<br>按实际用量结算、记一条日志"]
    classDef wait fill:#d0ebff,stroke:#1971c2
    classDef work fill:#fff3bf,stroke:#f08c00
    class S wait
    class A,B,R,U,F work
```

*图：一个模型网关请求的最小因果链（示意，不是某个产品的实现）。黄色几步要算，但每步只有几毫秒；蓝色那一步要等，一等就是十几秒到几分钟。*

这六步决定了模型网关和普通 API 网关的三点不同：

| 特征 | 本文取值（示意） | 为什么重要 |
|---|---|---|
| 挂钟时间很长 | 20 秒 | 大部分时间在等上游生成 token；推理模型会更长 |
| CPU 时间很短 | 10 毫秒 | 鉴权、选线、逐块转发 SSE、找 usage。Cloudflare 限制页给的参考：平均每个 Worker 约 2.2 ms，做鉴权、解析大包体的重负载通常 10–20 ms |
| 出流量大 | 50 KB / 请求 | 30 KB 是把客户的 prompt 转给上游，20 KB 是把 SSE 回给客户端。**对网关来说，转发 prompt 也是出流量** |

10 毫秒除以 20 秒是 0.05%。也就是说，网关 99.95% 的时间都在等，正是上一节说的等待型服务：按 CPU 收费的平台几乎只收那 10 毫秒，按时长收费的要收满 20 秒，按台收费的要按峰值并发买机器。流量上，Cloudflare 出流量不收费，阿里云、腾讯云每 GB 收五毛到一块。

下面这段伪代码把六步落到 Workers 上，注释里标出哪些行在「等」、哪些在「算」。它是示意，不是哪个平台的真实源码：

```ts
// 伪代码（示意）：Workers 版模型网关的一次请求
export default {
  async fetch(req, env, ctx) {
    const key = await env.KEYS.get(apiKeyOf(req), "json");         // ① KV 读：等网络，不算 CPU
    if (!key) return new Response("invalid key", { status: 401 });

    const limiter = env.LIMITER.get(env.LIMITER.idFromName(key.id)); // 每个 API key 一个 DO
    const slot = await limiter.acquire(estimateCost(req));           // ② 占并发位 + 预扣余额（写 1 行）
    if (!slot.ok) return new Response("too many requests", { status: 429 });

    const upstream = await fetch(pickLine(key), forward(req));       // ③④ 等上游首包，可能好几秒，不算 CPU
    const { readable, writable } = new TransformStream();
    ctx.waitUntil(pipeAndFindUsage(upstream.body, writable, async (usage) => {
      await limiter.release(slot.id, usage);                         // ⑥ 释放并发位 + 结算（写 1 行）
      await env.USAGE.send({ key: key.id, usage });                  // ⑥ 用量消息，消费者按分钟聚合写 D1
    }));
    return new Response(readable, upstream);                         // ⑤ 20 秒的流，CPU 只花在逐块拷贝上
  },
};
```

同样六步换到阿里云或腾讯云，就是一个常驻进程（Higress 插件或自己写的 Go 服务）加一个 Redis：

- ① 查 key：进程内存缓存，未命中再查 Redis；
- ② 占并发位、预扣余额：Redis 的 `INCR` / `DECR` 加一段 Lua 脚本；
- ⑥ 用量：进程里先攒一批，再批量写数据库，或者发到消息队列。

**架构是一样的，差的是每一步怎么收费。**

---

## 账单拆开看：钱都花在哪

三个规模是每月 1,000 万、1 亿、10 亿次请求，峰值按平均的 3 倍算。每个请求查 1 次 key，记 2 次账（开始占位、结束结算），发 1 条用量消息，写 1 条约 1 KB 的日志。把每月 10 亿次时的账单拆成三块：

```chart
{
 "type": "stack",
 "fmt": {"pre": "¥"},
 "series": [
   {"key": "state", "label": "状态读写（查 key、计数、余额、用量库）", "color": "blue"},
   {"key": "egress", "label": "出流量", "color": "gold"},
   {"key": "rest", "label": "其余（机器、负载均衡、日志）", "color": "gray"}
 ],
 "rows": [
   {"label": "Cloudflare", "sub": "常规写法", "values": {"state": 27462.09, "egress": 0, "rest": 5111.91}},
   {"label": "Cloudflare", "sub": "优化写法", "values": {"state": 20027.24, "egress": 0, "rest": 5111.91}},
   {"label": "阿里云 · 深圳", "values": {"state": 1730.0, "egress": 37997.0, "rest": 5968.64}},
   {"label": "腾讯云 · 广州", "values": {"state": 2008.0, "egress": 40000.0, "rest": 3170.65}},
   {"label": "AWS · 美东", "values": {"state": 4625.9, "egress": 28826.77, "rest": 13726.01}},
   {"label": "Oracle · 美东", "values": {"state": 2954.46, "egress": 2269.5, "rest": 3607.73}}
 ],
 "caption": "每月 10 亿次请求时，月费拆成三块（人民币）。Cloudflare 的「状态」按次收费，自建方案的 Redis 和 MySQL 按台收费。"
}
```

**Cloudflare 的账单八成多是状态读写；阿里云、腾讯云、AWS 的账单六到九成是出流量；Oracle 三块差不多大。** 原因在后面两节：Cloudflare 每次读写状态都单独计费，而云厂商的 Redis 按台收钱，请求数翻十倍价格不变；反过来，Cloudflare 出流量不收费，云厂商每 GB 都要收钱。

### 每个请求传多少字节，决定谁便宜

Cloudflare 的账单和字节数无关，云厂商自建几乎和字节数成正比。把每个请求的出流量从 5 KB 拉到 100 KB：

```chart
{
 "type": "line",
 "fmt": {"pre": "¥"},
 "x": {"label": "每个请求的出流量（KB）", "min": 0, "max": 100, "ticks": [0, 20, 40, 60, 80, 100]},
 "y": {"label": "每月 10 亿次请求时的月费（人民币）", "max": 100000, "ticks": [0, 20000, 40000, 60000, 80000, 100000]},
 "series": [
   {"label": "阿里云 · 深圳自建", "color": "blue", "points": [[5, 9478], [10, 13723], [15, 17731], [20, 21726], [25, 25721], [30, 29716], [35, 33711], [40, 37706], [50, 45696], [60, 53247], [70, 60737], [80, 68227], [90, 75717], [100, 83207]]},
   {"label": "AWS · 美东自建", "color": "gray", "points": [[5, 18896], [10, 22186], [15, 25320], [20, 28443], [25, 31566], [30, 34688], [35, 37811], [40, 40933], [50, 47179], [60, 52548], [70, 57785], [80, 63023], [90, 68261], [100, 73499]]},
   {"label": "Oracle · 美东自建", "color": "green", "points": [[5, 6562], [10, 6562], [15, 6834], [20, 7119], [25, 7405], [30, 7690], [35, 7975], [40, 8261], [50, 8832], [60, 9402], [70, 9973], [80, 10544], [90, 11115], [100, 11686]]},
   {"label": "Cloudflare 常规写法", "color": "seal", "points": [[0, 32574], [100, 32574]]},
   {"label": "Cloudflare 优化写法", "color": "seal", "dash": true, "points": [[0, 25139], [100, 25139]]}
 ],
 "marks": [
   {"x": 33.6, "y": 32574, "label": "≈ 34 KB 时打平", "color": "seal", "side": "left"},
   {"x": 50, "y": 45696, "label": "本文假设 50 KB", "color": "blue"}
 ],
 "caption": "Cloudflare 不收出流量费，所以是两条水平线。500 KB 的编码 Agent 请求在图外：阿里云自建 ¥365,488，AWS ¥236,506，Oracle ¥34,518。"
}
```

- **小请求，自建便宜。** 每个请求的出流量低于约 34 KB 时，阿里云自建比 Cloudflare 便宜（对 Cloudflare 的优化写法是约 24 KB）。短问答只有 5 KB 左右，自建只要 Cloudflare 的三分之一。
- **大请求，Cloudflare 便宜。** 编码 Agent 的请求体动辄几百 KB，这时 Cloudflare 便宜好几倍。AWS 的打平点比阿里云更低。
- **Oracle 在整个范围里都最便宜**，要到三四百 KB 才和 Cloudflare 打平。
- **量越小，打平点越低。** 每月 1,000 万次时，云厂商的保底费已经比 Cloudflare 的全部账单还高，怎么都打不平。

所以「Cloudflare 便宜」这句话**只在量小或者请求大的时候成立**。

还有一个只有国内云才有的杠杆：**上游如果在同一家云的内网里**（比如在阿里云上调用百炼），转发 prompt 的那部分可以不走公网。百炼的私网连接目前只开了北京和香港，网关和百炼同地域时，每月 10 亿次能把出流量这一项从约 3.8 万元降到约 1.9 万元（已算上私网连接费）；网关在深圳、跨地域连北京，就基本省不下来。

### CPU 时间几乎不影响账单

把网关的 CPU 时间从 5 毫秒翻到 20 毫秒，Cloudflare 的月费只变 6%；云厂商自建 4 台 8 核机器也装得下。**按 CPU 计费时，等上游的 20 秒几乎不花钱。**

### 网关费只是模型费的零头

摊到每个请求，Cloudflare 约 0.00003 元，阿里云自建约 0.000045 元。拿模型费对照一下：一次 7,500 token 输入、300 token 输出的调用，按 DeepSeek V4.1-Flash 的高峰价约 0.017 元，网关只占 0.2–0.3%；换成便宜得多的通义 qwen-flash，也只占 2–3%（两家价格 2026-10-08 核对）。**所以选平台不能只看账单，延迟、可达性和稳定性至少同样重要。**

---

## Cloudflare 这边：流量免费，状态按次收费

**省钱的原因有两条，都写在官方定价页上。** 第一，按 CPU 时间计费，等 `fetch()`、KV、数据库的时间都不算，挂钟时长不收费也不设上限，所以 20 秒的流和 0.2 秒的流一个价。第二，出流量和带宽不收费，Worker 发出的子请求也不收费，转发 prompt 不花钱。条款里也没有带宽上限：Cloudflare 2023 年改条款后，「不能大量传非网页内容」只约束 CDN，开发者平台不受此限（[条款更新说明](https://blog.cloudflare.com/updated-tos/)）。

**贵在哪：每次读写状态都单独计费。**

1. **最大的一项是 DO 写行**，每月 10 亿次时约 1.3 万元。并发位和余额必须写进 DO 自带的 SQLite，不能只放内存：DO 空闲 10 秒左右就可能休眠，休眠后内存里的计数会丢，而一条流要挂 20 秒。优化写法是用量先在 DO 里累加、每分钟落一次库，并去掉 Queues，月费能降两成多。
2. **一个 DO 是单线程的。** 官方给单个对象的软上限约每秒 1,000 次请求，带存储写入时更低，设计规则页也明确反对用单个 DO 做全局限速。正确做法是每个 API key 一个 DO，大客户的 key 再拆分片。
3. **KV 是最终一致的。** 其他机房要 60 秒以上才看得到改动，所以吊销 key、改余额不能只靠 KV。Pydantic 开源的 AI 网关在旧版 README 里就承认，用 KV 缓存状态时额度控制只能做成「软上限」。
4. **D1 单库最大 10 GB，而且不能提。** 按分钟聚合的用量表，每月 10 亿次时一个多月就写满。所以要定期汇总、按月分库（每个账号能建 5 万个库），冷数据归档到 R2。

**三个能把账单放大好几倍的坑：**

- **让 DO 在整条流期间保持活跃。** 比如让流经过 DO 转发，或者在 DO 里挂一个 `setTimeout` 做租约超时，DO 就会按挂钟时长计费，每月 10 亿次时最多多出约 21.5 万元。租约超时要用 `setAlarm`。2026-10-01 起，DO 里没完成的出站调用、`waitUntil` 也会让它保持活跃（最多 15 分钟），更容易踩到。
- **AI Gateway 默认把完整的 prompt 和 response 存进日志。** 2026-09-24 以后新开 AI Gateway 的账号，日志按 Workers Logs 的价格计费，每月 10 亿次时约 9.4 万元。要么关掉 payload 记录，要么关日志。另外，用 Cloudflare 统一付费（Unified Billing）时，每个 gateway 每分钟只允许 200 次请求，每月 1,000 万次的平均速率就超了，所以转售场景只能用自己的上游 key（BYOK）。
- **默认的日志配置。** 新建的 Worker 默认开日志，每次调用自动写一条，DO 的每次 RPC 按文档推断也会写一条，一个请求就是约 4 条。按官方给的平均每条 4.84 KB 粗算，日志费会涨到原来的二十倍。给网关和 DO 所在的 Worker 关掉调用日志或采样。

**一个时间点要注意**：Workers Logs 在 2026-12-01 从按条计费改成按 GB 计费（Cloudflare 2026-10-02 的博客公布），本文按新价算。计量包含 Cloudflare 自动附加的字段，所以「每条 1 KB」只是下限；按平均每条 4.84 KB 算，每月 10 亿次时常规写法的总价会从约 3.3 万元涨到约 4 万元。

---

## 国内云这边：状态几乎免费，流量按字节收费

**省钱的原因：状态是按台付钱的。** 一个 1 GB 双副本的 Redis 每月 77 元，标称每秒 10 万次操作，每月 10 亿次时峰值每秒只要约 4,600 次。查 key、计数、余额全压在它上面，**请求数翻十倍，它的价格不变**。

**贵在哪：出流量。**

1. **转发 prompt 也算出流量。** 每个请求 50 KB 里，有 30 KB 是网关替客户送给上游的。
2. **境外节点的流量更便宜，但要手动开阶梯价。** 阿里云香港、新加坡、东京的流量单价比深圳低，所以每月 10 亿次时，香港自建反而比深圳便宜，虽然香港的机器贵近一倍。但从 2024-12-12 起，ECS、EIP **不会自动按阶梯价**（阿里云叫 CDT）计费，要手动「升级至 CDT 计费」，免费，开了不能关；香港不升级，每月 10 亿次时要多付约 2.1 万元。新加坡、东京反过来：不升级时的原价比阶梯首档还低，流量在一定区间内不升级更省。
3. **上游请求别走 NAT。** 阿里云 NAT 网关从 2025-09-26 起按处理的流量收费，上游请求走 NAT，会在流量费之外再加约 23%。给每台 ECS 直接挂按流量计费的公网 IP 更省。
4. **长连接不会让负载均衡变贵，但会被超时掐断。** 阿里云 ALB 的容量费实际由处理的字节数决定，2.3 万条长连接只折合不到 8 个容量单位；腾讯云 CLB 共享型干脆不按容量收费。但 **ALB 的请求超时默认 60 秒**，推理模型的长流要先调大，否则会 504。

**托管 AI 网关**（阿里云云原生 API 网关的 AI 网关，内核是开源的 Higress）：多模型路由、Fallback、消费者 API key、Token 限流都有，计费项里看不到为这些功能单独收的钱，但最小规格每月约 4,000 元（文档价）。按客户计费需要的余额、用量库还得自己配 Redis 和数据库，所以量小时它比整套自建贵两倍多。2026-09-01 起收费的 Serverless 版没有动辄几千元的起步规格费（企业版每月约 176 元实例费），量小时和自建差不多；但它的公网流量进出都按 0.8 元/GB 收、不走阶梯价，量大以后更贵。

---

## 海外四家：三大云和国内云是同一本账，Oracle 是例外

**三大云的流量价和国内云在同一量级。** AWS、Google Cloud、Azure 首档每 GB 约合六毛到八毛人民币，量大以后降到五毛多，比阿里云略低。

**机器、数据库、日志更贵。** 量小时，AWS 美东比阿里云深圳贵一半，Azure 美东贵到近三倍。日志尤其明显：三家都是每 GB $0.50，是阿里云日志服务的 8 倍多。两边一抵，量大时三大云和国内云的账单差不多。

如果客户端在中国大陆，Google Cloud 回给客户端的那部分流量要按价目表里「到中国内地」那一档计，每 GiB $0.20–0.23（官方没写按什么判定目的地）。把全部出流量都按这个价算（上限），每月 10 亿次时美东会从约 4.4 万元涨到约 8.1 万元。

**Oracle 的出流量几乎免费。** 价目表写明每月前 10 TB 出流量免费，超出后北美 $0.0085/GB、亚太 $0.025/GB。同地域内（包括跨可用域）的流量不收费，负载均衡转发的数据不另收费，日志写入也免费、只收存储。所以每月 10 亿次时，美东 50 TB 出流量只要约 2,300 元，阿里云深圳同样的流量要约 3.8 万元。它的代价在别处：

- 10 TB 免费额度按「来源大区」各算一份：Oracle 2021 年的[新闻稿](https://www.oracle.com/news/announcement/oracle-joins-cloudflare-bandwidth-alliance-2021-11-10/)和 2025 年的官方白皮书都写明是每个 regional zone。美东（北美区）和新加坡（亚太区）各 10 TB，同一大区里的多个地域共用一份。
- 新加坡只有一个可用域（Oracle 对可用区的叫法），做不到跨可用区，只能跨故障域。
- 按量付费账户默认每个可用域只有 6 个 OCPU、只能开一个地域，量大以后要先申请提额。
- NAT 网关对同一个目的地址和端口的并发连接有上限，美东每个可用域约 2 万条。2.3 万条流都压在一个可用域、打同一个上游时会撞上，所以机器最好挂公网 IP 直接出去（预留公网 IP 官方写明不收费）。
- 最小的 MySQL 高可用规格按 3 个实例收费，每月 $170，是量小时账单的大头。

**负载均衡的默认超时，是上线前最容易踩的坑：**

| | 默认 | 对 SSE 的影响 |
|---|---|---|
| 阿里云 ALB | 请求超时 60 秒，按 ALB 和后端多久没有数据往来算（WebSocket 文档的说法，SSE 没写） | 推理模型首 token 前思考超过 60 秒会 504，要先调大 |
| AWS ALB | 空闲超时 60 秒，可调到 4,000 秒 | 推理模型思考超过 60 秒还没吐首个 token 就会断；调大或发 SSE 心跳 |
| Google Cloud 外部应用负载均衡 | 后端服务超时 30 秒，**算的是整个响应的总时长** | 不是空闲超时，超过 30 秒的流直接被截断；全局负载均衡最多可调到 86,400 秒，上线前要调大 |
| Azure Application Gateway v2 | 请求超时 20 秒，按多久没收到数据算 | 官方排错文档写超时后会把请求再发给另一台后端，没说 POST 例外；如果 POST 也重试，首 token 超过 20 秒的请求**可能被转发两次、上游扣两次费**（推论，没实测）；跑 SSE 还要关掉默认开启的响应缓冲 |
| Oracle 灵活负载均衡 | 空闲超时 60 秒，可调到 7,200 秒 | 发送数据不会重置接收计时 |

---

## Serverless 和边缘函数：量大以后都不行

按挂钟时间计费的 Serverless 要为等上游吐 token 的那 20 秒付钱，六家云厂商没有例外。只有在量小、并且开了单实例多并发时，函数计算、Cloud Run、Container Apps 才比自建便宜一点，因为省掉了常驻机器和负载均衡；量一上去就反过来了：

```chart
{
 "type": "bars",
 "fmt": {"pre": "¥"},
 "ref": {"value": 45696, "label": "阿里云深圳自建"},
 "rows": [
   {"label": "Cloudflare Workers", "sub": "按 CPU 时间计费", "value": 32574, "color": "seal"},
   {"label": "Google Cloud Run", "sub": "单实例并发 250", "value": 59634},
   {"label": "阿里云 AI 网关", "sub": "托管", "value": 60518},
   {"label": "阿里云函数计算", "sub": "单实例并发 100", "value": 68877},
   {"label": "腾讯云云函数", "sub": "开请求多并发，估算", "value": 75903},
   {"label": "Azure Container Apps", "sub": "每副本 100 条流", "value": 79376},
   {"label": "Google Cloud Run", "sub": "单实例并发 80", "value": 107676},
   {"label": "OCI Functions", "sub": "Oracle", "value": 264894},
   {"label": "AWS Lambda", "sub": "128 MB Arm", "value": 278460},
   {"label": "腾讯云云函数", "sub": "默认一个实例一条流", "value": 321865}
 ],
 "caption": "每月 10 亿次请求的月费（人民币，含 Redis、数据库、日志和出流量）。虚线是阿里云深圳自建。按挂钟时间计费的方案要为等上游的 20 秒付钱；Cloudflare Workers 只按 CPU 时间计费。"
}
```

各家的限制：

- **阿里云函数计算**：规格费按配置收、不按实际用量收，所以等上游的 20 秒 vCPU 全额计费，也进不了 vCPU 免费的「浅休眠」。唯一的省钱办法是单实例多并发，并发为 1 时的计算费是并发 100 时的约 95 倍。
- **腾讯云云函数**：SSE 文档写明，默认一个函数实例同一时刻只处理一条 SSE 连接，量大时峰值还超出每个地域默认的并发配额。Web 函数可以开「请求多并发」，文档把长连接列为主要用途，但只举了 WebSocket、没说 SSE；图里那组数按每实例 100 并发、装填率 70% 估算，没实测。
- **AWS Lambda**：一个执行环境同时只处理一个请求，流式响应要等整个流结束才停止计费，客户端断开也照扣；默认并发 1,000，量大要申请提额。
- **Google Cloud Run**：一个实例最多可以同时处理 1,000 个请求，是几家里最适合长连接的，但仍按实例的挂钟时间计费。它还会自动写请求日志、每 GiB 收 $0.50（可以用排除过滤器关掉），图里没算。
- **Azure**：Functions Flex 默认单实例并发 16，每月 10 亿次时要 1,447 个实例，超过 1,000 个的上限；Container Apps 把并发调到 100 后能跑。
- **OCI Functions**：一个实例一次只处理一个请求，同步调用最长 300 秒，而且要等函数执行完才返回结果，做不了流式。

**边缘函数做不了通用模型网关**，问题出在限制上，不在价格：

| | Cloudflare Workers | 阿里云 ESA 函数 | 腾讯云 EdgeOne 边缘函数 |
|---|---|---|---|
| 怎么计费 | 请求 + CPU 时间 | 按次，¥5/百万次 | 请求 ¥1.7/百万次 + CPU ¥0.11/百万毫秒 |
| 单次总时长 | 不限（客户端连着就行） | **120 秒**（等待也算） | 文档没写上限；`fetch` 超时最大可配 300 秒 |
| 首包 | 文档没列限制 | **10 秒内不出数据就回 504** | 文档没列限制 |
| 请求体 | 100 MB 起（看域名套餐） | 函数文档没写；站点上传上限默认 300 MB | **1 MB** |
| 单次 CPU | 默认 30 秒，可配到 5 分钟 | 文档没写数值 | **200 毫秒** |
| 子请求 | 默认 1 万次 | **4 个**（中文文档写每次 4 个，英文写同时 4 个、可申请提额） | 64 次 |
| 强一致状态 | Durable Objects | 没有（KV 最终一致，最长 300 秒） | KV 内测，只对企业版，每个命名空间每天 100 万次读 |
| 中国大陆节点 | 只有 China Network（Enterprise + ICP） | 有，要 ICP 备案 | 有，要 ICP 备案 |

推理模型的首 token 常常超过 10 秒，长输出常常超过 120 秒，Agent 的长上下文请求也很容易超过 1 MB。而且两家都没有 DO 这样的强一致状态，限速和余额还得回源到中心机房。海外的 CloudFront Functions 和 Lambda@Edge 也转发不了 20 秒的 SSE，Azure Front Door 的文档写明不支持 SSE。**边缘函数可以挡在网关前面做缓存、鉴权预检，替代不了网关。**

**海外的托管 AI 网关**，三大云有、Oracle 没有，但都不是为「转售」设计的：

- **Azure API Management**：v2 的三个层级都能透传 SSE，带 `llm-token-limit` 这类按 token 限流的策略，量小时用 Basic v2 每月约 $148（微软把它定位为开发测试用）。卡脖子的是每个上游主机最多 2,048 条并发后端连接，SSE 一条流占一条连接，每月 1 亿次的峰值就超了。经典层写明按单元算，v2 只写了 2,048；按单元算，每月 10 亿次要买 12 个单元，约 $1.8 万/月，按字面理解则要拆成 12 个实例、再加一层分流。上游走 HTTP/2 在 v2 里还是预览。
- **AWS**：Bedrock AgentCore Gateway（2026-07 起支持推理目标）能代理 OpenAI、Anthropic 和兼容端点，SSE 原样透传，2026-08 起能按用户身份限 RPM、TPM 和并发。但内置鉴权只有 IAM、JWT 或不鉴权，自定义校验要另挂拦截器，而文档写拦截器暂不支持流式；也没有「每个客户一个 API key」、按客户的用量账单和预付费余额。API Gateway 的 REST API 从 2025-11 起支持流式响应，但读不到流里的用量。
- **Google**：Apigee 能透传 SSE，但按 token 限流的策略只能用在最贵的代理类型上，每月 10 亿次时光调用费就要约 $73,000。
- **Oracle**：没有通用的 LLM 网关，它的生成式 AI 服务只能调自己目录里的模型。

---

## 账单之外：延迟和可达性

```chart
{
 "type": "bars",
 "fmt": {"suf": " ms"},
 "rows": [
   {"label": "阿里云 · 深圳", "value": 7, "color": "gray"},
   {"label": "腾讯云 · 广州", "value": 8, "color": "gray"},
   {"label": "阿里云 · 香港", "value": 13, "color": "gray"},
   {"label": "腾讯云 · 香港", "value": 13, "color": "gray"},
   {"label": "阿里云 · 新加坡", "value": 57, "color": "gray"},
   {"label": "腾讯云 · 新加坡", "value": 89, "color": "gray"},
   {"label": "Cloudflare", "value": 162, "color": "seal", "sub": "任播，落在洛杉矶"},
   {"label": "AWS · 新加坡", "value": 203, "color": "gray"},
   {"label": "AWS · 美东", "value": 224, "color": "gray"},
   {"label": "Oracle · 新加坡", "value": 230, "color": "gray"},
   {"label": "阿里云 · 弗吉尼亚", "value": 231, "color": "gray"},
   {"label": "Oracle · 美东", "value": 236, "color": "gray"}
 ],
 "caption": "深圳电信家宽 ping 各家入口，2026-10-09，每个 20 次。国内地域和 Cloudflare 取 10:49 的中位数，境外地域取 11:55 的平均值。Azure 和 Google Cloud 的入口是全球任播地址，测不出某个地域，没列。"
}
```

几点说明：

- **测法**：我所在的局域网把 TCP 连接都做了透明代理，任何地址握手都是 2–3 毫秒，所以改用 ping。这只是一条线路、一个时段；两天前的晚上，我在同一个网络用 TCP 握手测 Cloudflare 是 193 毫秒。
- **路由**：`mtr` 显示，去 Cloudflare 的包在电信 163 骨干上从约 9 毫秒跳到约 160 毫秒，也就是在这里出境，最后落在 Cloudflare 洛杉矶的地址上。
- **新加坡不一定近**：同样在新加坡，阿里云 57 毫秒，AWS 和 Oracle 却要 200 多毫秒，和美东差不多。国内云的境外地域和国内运营商的互联通常好得多。

**对首 token 的影响**：新建 HTTPS 连接至少要 3 个往返（TCP、TLS 1.3、发出请求），在 162 毫秒的往返下，首 token 前就多了约 0.45 秒；复用连接时多约 0.15 秒。对聊天来说能感觉到，对 Agent 的长任务影响不大。

**另外三件事：**

- **China Network 搬不进这套架构。** Cloudflare 官方说明，不开 China Network 时，中国大陆用户连的是境外机房。China Network 要 Enterprise 套餐、单独订阅、每个主域名的 ICP 备案或许可证，还要过京东云的内容审核；它的可用产品清单里有 Workers、KV、R2，**没有 DO、D1、Queues**（官方没说这几项在京东云节点上是不能用还是绕回境外）。`*.workers.dev` 在大陆被封：Cloudflare 员工在[官方社区](https://community.cloudflare.com/t/cloudflare-workers-suspected-of-being-blocked-in-china/382155)确认过，GreatFire 的第三方观测到 10-07 仍是全部被封，所以必须绑自己的域名。
- **海外模型的跨境那一跳躲不掉。** OpenAI 和 Anthropic 的 API 支持地区名单里，既没有中国大陆，也没有香港（[OpenAI](https://developers.openai.com/api/docs/supported-countries)、[Anthropic](https://www.anthropic.com/supported-countries)，2026-10-09 核对）。所以网关调这两家，出口要放在新加坡、日本、美国这类支持地区，香港节点只能做中转。从大陆用户的角度看，长距离的那一跳要么发生在「用户 → Cloudflare 洛杉矶」，要么发生在「境外网关 → 美国上游」。所以调用海外模型时，Cloudflare 的延迟劣势会小很多，差别主要在线路质量。
- **两边都出过大故障，形态不同。** Cloudflare 2025-06-12 因 KV 依赖的第三方云宕机，AI Gateway 错误率峰值到 97%；2025-11-18 核心代理故障，KV 也大量报 5xx。每个请求都同步读 KV 或 DO 的网关，会跟着全球一起挂，没有「换个可用区」的退路。阿里云香港可用区 C 在 2022-12-18 因制冷故障中断十多个小时，但故障集中在一个可用区，跨可用区部署就有退路。

---

## 谁真的把模型网关放在 Workers 上

我只采信一手证据：官方博客、官方文档、仓库里的部署配置、创始人署名文章。

| 平台 | 用了哪些 Cloudflare 组件 | 证据 | 强度 |
|---|---|---|---|
| **Cloudflare AI Gateway** | Workers；日志先放 D1，后挪 R2，再改成按「账户 + gateway」分片的 DO | [官方博客 2024-10-24](https://blog.cloudflare.com/billions-and-billions-of-logs-scaling-ai-gateway-with-the-cloudflare/) | 证实 |
| **Helicone**（托管代理和托管 AI Gateway） | Workers + DO（限速器，加每个组织一个钱包：开始按最坏成本冻结，结束按实际用量结算）+ KV + Queues；超过 20 MiB 的请求体转给 Containers；后端在 AWS | [`worker/wrangler.toml`](https://github.com/Helicone/helicone/blob/main/worker/wrangler.toml)、[钱包 DO](https://github.com/Helicone/helicone/blob/main/worker/src/lib/durable-objects/Wallet.ts)、[官方文档](https://docs.helicone.ai/references/availability) | 证实（边缘请求路径） |
| **OpenRouter** | 边缘层用 Workers，在边缘缓存用户和 API key 数据；余额很低时会多查数据库，延迟上升 | [官方文档](https://openrouter.ai/docs/guides/best-practices/latency-and-performance) | 证实（只到边缘层） |
| **Portkey** | 开源网关仓库自带生产环境的 `wrangler.toml`，官方文档说托管版跑在全球「edge workers」上 | [wrangler.toml](https://github.com/Portkey-AI/gateway/blob/main/wrangler.toml) | 间接证据 |
| **Unkey**（迁走了） | 曾用 Workers + DO 做 API key 校验和限速，2025-08 迁到 AWS 上的有状态 Go 服务 | [联合创始人文章 2025-08-01](https://www.unkey.com/blog/serverless-exit) | 证实 |
| **Braintrust**（迁走了） | 2023 年 AI Proxy 跑在 Workers 上；现在托管入口是 AWS 上的 Gateway，原因没公开 | [2023 年博客](https://www.braintrust.dev/blog/ai-proxy)、[现行文档](https://www.braintrust.dev/docs/deploy/gateway) | 证实「迁了」 |

从这张表能看出三件事：

1. **除了 Cloudflare 自己，没有一家是「全 Cloudflare」。** 最接近的是 Helicone：请求路径上的 Workers、DO、KV、Queues 全在 Cloudflare，分析库和账务后端在 AWS。本文 Cloudflare 一侧连账务都放在 D1 里，比现实中的做法更激进。
2. **大家踩的坑都在状态层，不在计算层。** 包括 AI Gateway 的日志存储、Helicone 的钱包预扣、OpenRouter 的低余额回源、Pydantic 网关的 KV 软额度。
3. **Unkey 的离开有它的场景。** 它的原因是：缓存读要走网络，p99 超过 30 毫秒；为了绕开无状态，堆了 DO、Queues、Workflows 一串产品；数据导出麻烦；客户没法自托管。迁走后延迟降到原来的 1/6。但 Unkey 每个请求都要在 10 毫秒内完成 key 校验，模型网关的一个请求本来就要挂 20 秒，几十毫秒的状态读取占比小得多，这个结论不能原样搬过来。

国内侧的主流做法是**常驻网关进程加 Redis**，不是边缘函数：

- **Higress**：阿里开源的网关，2026-03-15 进入 CNCF Sandbox，约 9,500 星。项目方说它支撑通义千问 APP、百炼大模型 API 和 PAI，但没有公开流量数字。它的 Token 限流用 Redis 做全局计数，和 Cloudflare 一侧用 DO 计数是同一个设计点。
- **阿里云 AI 网关**：官方客户案例里，国泰产险所有访问大模型的流量都走 AI 网关，日均近亿 token。
- **国内边缘函数**：没有找到点名的模型网关客户。

---

## 怎么选

**先按服务类型**：回到[服务分类那一节](#先给服务分类三个问题决定放哪)的两张表。等待型优先看边缘函数或常驻进程，计算型看负载是偶发还是持续，流量重看出流量怎么收费，每个请求都写状态的看状态怎么收费。**下面的决策树和清单是模型网关这一类的。**

```mermaid
flowchart LR
    %% layout: tree
    Q(["付费用户主要在哪？"])
    Q --> CN["中国大陆"] --> CN1["国内模型为主<br>→ 阿里云 / 腾讯云内地：常驻网关（Higress 或自写）+ Redis<br>别用函数计算 / 云函数，边缘函数只挡在前面"]
    CN --> CN2["也要海外模型<br>→ 内地入口 + 境外节点调海外模型<br>出口放在 OpenAI / Anthropic 支持的地区（如新加坡、东京）<br>香港节点记得升级 CDT，新加坡、东京先算一下"]
    Q --> OS["海外"] --> OS1["量小、不想运维<br>→ Cloudflare Workers + 每个 key 一个 DO<br>账务按月分库或外接数据库，日志关掉 payload"]
    OS --> OS2["量大、流量重<br>→ Oracle 自建（出流量每月前 10 TB 免费）<br>已在 AWS / GCP / Azure 上的，流量账和国内云差不多"]
    Q --> BOTH["两边都有"] --> BOTH1["→ 两个入口各自就近<br>账务只放一处，别双写"]
    classDef q fill:#fff3bf,stroke:#f08c00
    classDef pick fill:#d3f9d8,stroke:#2f9e44
    class Q q
    class CN1,CN2,OS1,OS2,BOTH1 pick
```

*图：按用户所在地选平台的决策树（本文的判断，不是官方建议）。*

**什么时候选 Cloudflare：**

- 用户主要在海外，或者是调用海外模型的开发者；
- 规模还小（每月千万次以内），想要几乎为零的保底费、不想运维机器，六家云厂商的自建都比不过；
- 请求体大（Agent、长上下文、多模态），流量费在云厂商那边会是账单大头；
- 团队能接受按 key 拆 DO、D1 定期归档这类「为状态而设计」的工作。

**什么时候别用 Cloudflare：**

- 用户主要在中国大陆，对首 token 延迟敏感（聊天产品）；
- 规模到每月 10 亿次量级、请求又很短（每个请求出流量低于约 30 KB），国内云或三大云自建会更便宜；
- 用户在海外、规模大，又愿意自己运维机器：Oracle 自建便宜约三倍；
- 需要强一致的全局状态（全局并发、跨 key 的额度池），又不想自己做分片；
- 需要在中国大陆有节点，又买不起 Enterprise，或者用了 DO、D1、Queues。

---

## 结语

选平台先给服务分类，换一类服务，三个问题的答案变了，结论也跟着变。模型网关不是计算密集型服务，而是**等待密集、搬运密集、状态密集**型服务。拿 CPU 价格去比两朵云，比的是账单里最小的那一项。

> **铁律：先问三件事——谁为等待收钱，谁为搬运收钱，谁为状态收钱。再看你的用户离哪边近。**

---

## 附录：怎么查的和完整数字

正文里的数字都出自这里。表头的「1,000 万次 / 1 亿次 / 10 亿次」都是每月的请求数。

### 怎么查的

- **国内两家用官方命令行工具的询价接口。** 阿里云用 aliyun CLI 3.5.1（`DescribePrice`、`GetPayAsYouGoPrice`），腾讯云用 tccli 3.1.180.1（`InquiryPrice*`、`DescribeDBPrice`）。所有调用都是只读的询价接口，没有创建任何资源。
- **Cloudflare 全部来自官方价目页和限制页。** 它没有价格接口，wrangler 4.148.0 和 Cloudflare API 只能查自己账号的用量。
- **海外四家用不用登录的公开价格接口**（AWS Price List、Azure Retail Prices API、Oracle 价目 API）；Google Cloud 的价格接口要 API key，用的是官方价目页。查美东和新加坡两个地域，一律按需价、月按 720 小时。预留实例、Savings Plans 能再省三到五成，但只省机器，不省流量。
- **一律用目录价。** 阿里云的询价接口会同时返回账号折扣（比如我的账号负载均衡和 NAT 有 85 折），这类折扣不计入。查不到接口的用官方文档价并标出来，比如阿里云 AI 网关在计费系统里没有计价模块。
- **同一天做过两轮核实**：前两轮标为「未核实」的事项逐项查了官方原文，查实的已改进正文，仍查不实的（多半要账号、压测或真实账单）照旧标出。

<details>
<summary>几条代表性的询价命令（完整命令和原始输出都存了下来）</summary>

```bash open
# 阿里云：ECS 包月价（含 40 GB ESSD PL0 系统盘，不含带宽）
aliyun ecs DescribePrice --RegionId cn-shenzhen --ResourceType instance \
  --InstanceType ecs.c9i.xlarge --PriceUnit Month --Period 1 \
  --SystemDisk.Category cloud_essd --SystemDisk.PerformanceLevel PL0 --SystemDisk.Size 40

# 阿里云：50,000 GB 公网出流量走 CDT 阶梯的总价
aliyun bssopenapi GetPayAsYouGoPrice --region cn-hangzhou --ProductCode cdt \
  --ProductType cdt_DataTransfer_public_cn --SubscriptionType PayAsYouGo --Region cn-shenzhen \
  --ModuleList.1.ModuleCode internet_traffic --ModuleList.1.PriceType Usage \
  --ModuleList.1.Config 'Region:cn-shenzhen,internet_traffic:50000,charge_type:PayByTraffic,isp:BGP'

# 阿里云：Redis（Tair）、RDS 包月价
aliyun r-kvstore DescribePrice --RegionId cn-shenzhen --ZoneId cn-shenzhen-c \
  --InstanceClass redis.shard.large.ce --OrderType BUY --ChargeType PrePaid --Period 1 --NodeType MASTER_SLAVE
aliyun rds DescribePrice --RegionId cn-shenzhen --ZoneId cn-shenzhen-c --Engine MySQL --EngineVersion 8.0 \
  --DBInstanceClass mysql.n4.large.2c --DBInstanceStorage 100 --DBInstanceStorageType cloud_essd \
  --PayType Prepaid --UsedTime 1 --TimeType Month --Quantity 1 --OrderType BUY --CommodityCode rds

# 腾讯云：CVM 包月价（含 50 GB 通用型 SSD，带宽设 0）
TENCENTCLOUD_REGION=ap-guangzhou tccli cvm InquiryPriceRunInstances --cli-unfold-argument \
  --Placement.Zone ap-guangzhou-6 --ImageId img-mmytdhbn --InstanceType SA9.LARGE8 \
  --InstanceChargeType PREPAID --InstanceChargePrepaid.Period 1 \
  --SystemDisk.DiskType CLOUD_BSSD --SystemDisk.DiskSize 50 \
  --InternetAccessible.InternetChargeType TRAFFIC_POSTPAID_BY_HOUR \
  --InternetAccessible.InternetMaxBandwidthOut 0 --InstanceCount 1
```

```bash open
# AWS：us-east-1 到互联网的出流量阶梯（Price List 公开文件，AWSDataTransfer 服务）
curl -s https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSDataTransfer/current/us-east-1/index.json

# Azure：eastus 的出流量阶梯（Retail Prices API）
curl -s "https://prices.azure.com/api/retail/prices?\$filter=serviceName%20eq%20'Bandwidth'%20and%20armRegionName%20eq%20'eastus'%20and%20meterName%20eq%20'Standard%20Data%20Transfer%20Out'"

# Oracle：北美出发的出流量（价目 API，B88327 = Outbound Data Transfer - Originating in North America, Europe, and UK）
curl -s "https://apexapps.oracle.com/pls/apex/cetools/api/v1/products/?currencyCode=USD&partNumber=B88327"
```

</details>

### 关键单价

<details>
<summary>Cloudflare、阿里云（深圳）、腾讯云（广州）</summary>

| | Cloudflare（美元） | 阿里云（深圳，人民币） | 腾讯云（广州，人民币） |
|---|---|---|---|
| 计算 | Workers $5/月，含 1,000 万请求和 3,000 万 CPU 毫秒；超出 $0.30/百万请求、$0.02/百万 CPU 毫秒；**挂钟时长不收费** | ECS c9i 包月：2c4g ¥205.91，4c8g ¥391.82，8c16g ¥763.64（含系统盘） | CVM SA9 包月：2c4g ¥156.2，4c8g ¥287.4，8c16g ¥549.8（含系统盘） |
| 负载均衡 | 不需要 | ALB 实例 ¥0.049/时 + 容量单位（LCU）¥0.049/个·时；LCU 按新建连接、并发连接、处理字节、规则次数四个维度取最大值 | CLB 共享型 ¥0.2/时，**不按容量收费** |
| 出流量 | **不收费** | CDT 阶梯：10 TB 内 ¥0.80/GB，10–50 TB ¥0.75，50–150 TB ¥0.70，再往上 ¥0.65；每月免费 20 GB | ¥0.80/GB，单一价，没有阶梯也没有免费额度 |
| 计数 / 余额 | DO：请求 $0.15/百万，SQLite 写 $1.00/百万行（含 5,000 万行） | Tair 双副本 1 GB ¥76.98/月，4 GB ¥360/月 | Redis 主从 1 GB ¥76/月，4 GB ¥304/月 |
| 查 key | KV 读 $0.50/百万（含 1,000 万） | 同上 Redis | 同上 Redis |
| 用量 / 账务库 | Queues $0.40/百万次操作（一条消息 3 次）；D1 写 $1.00/百万行，**单库最大 10 GB** | RDS MySQL 高可用：2c4g ¥660/月，4c16g ¥1,370/月 | MySQL 双节点：2c4g ¥480/月，4c16g ¥1,704/月 |
| 日志 | Workers Logs，**2026-12-01 起**按 $0.25/GB 写入 + $0.10/GB·月存储 | SLS ¥0.4/GB（含索引和 30 天存储） | CLS 按功能计费，每 GB 约 ¥0.83 |

</details>

<details>
<summary>AWS、Google Cloud、Azure、Oracle（美东，美元）</summary>

| | AWS | Google Cloud | Azure | Oracle |
|---|---|---|---|---|
| 出流量 | 每月免费 100 GB；10 TB 内 $0.09/GB，10–50 TB $0.085（新加坡首档 $0.12） | Premium 层到北美：1 TiB 内 $0.12/GiB，10 TiB 内 $0.11，再往上 $0.08（新加坡到亚洲首档 $0.12） | 每月免费 100 GB；10 TB 内 $0.087/GB，10–50 TB $0.083（新加坡首档 $0.12） | **每月前 10 TB 免费**，超出 $0.0085/GB（新加坡 $0.025） |
| 4 vCPU 8 GiB 机器（每月） | c8i.xlarge $134.94 | c4-highcpu-4 $122.47 | F4als_v7 $174.24 | E6.Flex 2 OCPU $54.72 |
| 负载均衡 | ALB $16.20/月 + LCU（处理字节约 $0.008/GB） | 转发规则 $18/月 + $0.008/GiB | Application Gateway v2 $0.20/时 + 容量单位 $0.008 | 灵活负载均衡每月 $9–41，转发的数据不另收费 |
| 约 1 GB 高可用 Redis（每月） | Valkey 主从 $36.86 | Memorystore 标准层 $46.08 | Azure Managed Redis B1 $46.08 | OCI Cache $55.87 |
| 约 2 核 MySQL 高可用（每月） | RDS Multi-AZ $115.88 | Cloud SQL HA $192.80 | Flexible Server 区域冗余 HA（最小 2 vCore 8 GiB）$272.84 | HeatWave HA $170.11 |
| 日志 | CloudWatch Logs 写入 $0.50/GB | Cloud Logging $0.50/GiB，每项目每月 50 GiB 免费 | Basic Logs $0.50/GB | 写入免费，存储 $0.05/GB·月 |

</details>

### 完整月费

<details>
<summary>自建网关和 Cloudflare（含香港、新加坡）</summary>

机器规模：国内两家每月 1,000 万次用 2 台 2 核 4G，1 亿次用 2 台 4 核 8G，10 亿次用 4 台 8 核 16G，双可用区，没有压测；数据库和 Redis 规格随规模放大。人民币目录价：

| 方案 | 1,000 万次 | 1 亿次 | 10 亿次 |
|---|---|---|---|
| Cloudflare 常规写法（Workers + KV + Durable Objects + Queues + D1） | 140 | 2,756 | 32,574 |
| Cloudflare 优化写法（用量在 Durable Object 里累加，去掉 Queues） | 67 | 2,115 | 25,139 |
| 阿里云 · 深圳 | 1,625 | 5,854 | 45,696 |
| 阿里云 · 香港（境外节点参考） | 1,981 | 6,114 | 40,426 |
| 腾讯云 · 广州 | 1,422 | 5,359 | 45,179 |
| AWS · 美东 / 新加坡 | 2,467 / 3,227 | 6,646 / 8,572 | 47,179 / 53,327 |
| Google Cloud · 美东 / 新加坡 | 3,056 / 4,031 | 7,387 / 8,583 | 43,798 / 48,564 |
| Azure · 美东 / 新加坡 | 4,794 / 6,215 | 9,125 / 11,934 | 49,848 / 57,957 |
| Oracle · 美东 / 新加坡 | 1,973 / 1,973 | 2,388 / 2,388 | 8,832 / 13,237 |

</details>

<details>
<summary>托管网关和 Serverless（同样含 Redis、数据库、日志和出流量）</summary>

| 方案 | 1,000 万次 | 1 亿次 | 10 亿次 |
|---|---|---|---|
| 阿里云 AI 网关（托管） | 5,428 | 10,195 | 60,518 |
| 阿里云函数计算（单实例并发 100） | 1,419 | 7,703 | 68,877 |
| 腾讯云云函数（默认单并发 / 开请求多并发*） | 3,756 / 1,296 | 32,543 / 7,947 | 321,865 / 75,903 |
| AWS Lambda（128 MB Arm，美东，含平台日志） | 4,142 | 28,874 | 278,460 |
| Google Cloud Run（单实例并发 80 / 250，美东，不含自动请求日志**） | 2,672 / 2,405 | 12,556 / 7,752 | 107,676 / 59,634 |
| Azure Container Apps（每副本 100 条流，美东） | 2,916 | 9,596 | 79,376 |
| OCI Functions（Oracle，美东） | 4,071 | 27,445 | 264,894 |

\* 腾讯云的 SSE 文档写「一个实例同一时刻只处理一条 SSE 连接」，多并发文档又把长连接列为主要用途，只举了 WebSocket 的例子；开多并发那组数按每实例 100 并发、装填率 70% 估算，没实测。\*\* Cloud Run 会自动写请求日志、按 $0.50/GiB 计费，可以用排除过滤器关掉；按每条 1 KB 算，10 亿次时两种并发分别多约 ¥3,100。

</details>

<details>
<summary>一个请求的账、每个规模下最大的几项</summary>

按每月 10 亿次时的超量单价，算每百万请求的边际成本：

| Cloudflare 每百万请求 | 美元 | 阿里云深圳每百万请求 | 人民币 |
|---|---|---|---|
| Workers 请求 | 0.30 | 出流量 50 GB × ¥0.75 | 37.5 |
| Workers CPU（10 ms） | 0.20 | ALB 容量单位（处理 50 GB） | 2.45 |
| KV 读 1 次 | 0.50 | SLS 日志 1 GB | 0.40 |
| DO 请求 2 次 | 0.30 | 机器 + Redis + RDS 摊到每百万请求 | 约 4.8 |
| **DO 写 2 行** | **2.00** | | |
| Queues 3 次操作 | 1.20 | | |
| 日志 1 KB | 约 0.27 | | |
| **合计** | **约 4.8（≈ ¥32）** | **合计** | **约 ¥45** |

海外几家按 10 亿次的总价摊到每个请求：AWS 美东约 ¥0.000047，Oracle 美东约 ¥0.000009。

| | 1,000 万次 | 1 亿次 | 10 亿次 |
|---|---|---|---|
| Cloudflare | Queues 55%、Workers 订阅 24% | DO 写行 37%、Queues 29%、KV 读 11% | DO 写行 40%、Queues 25%、KV 读 10% |
| 阿里云自建 · 深圳 | RDS 41%、ECS 25%、流量 24% | **流量 68%**、ECS 13% | **流量 83%**、ECS 7%、ALB 5% |
| 腾讯云自建 · 广州 | MySQL 34%、流量 28%、CVM 22% | **流量 75%** | **流量 89%** |
| AWS 自建 · 美东 | EC2 37%、RDS 32%、流量 10% | **流量 45%**、EC2 27%、RDS 12% | **流量 61%**、EC2 15%、RDS 7%、日志 7% |
| Oracle 自建 · 美东 | MySQL 58%、Redis 19%、机器 19% | MySQL 48%、机器 31% | 机器 33%、**流量 26%**、MySQL 25% |

</details>

<details>
<summary>每个请求的出流量：阿里云深圳的明细和各家的打平点</summary>

| 每请求出流量 | 1,000 万次 | 1 亿次 | 10 亿次 | 对照：Cloudflare 10 亿次（常规 / 优化） |
|---|---|---|---|---|
| 5 KB（短问答） | ¥1,243 | ¥2,033 | **¥9,478** | ¥32,574 / ¥25,139 |
| 20 KB | ¥1,371 | ¥3,307 | ¥21,726 | 同上 |
| 50 KB（本文口径） | ¥1,625 | ¥5,854 | ¥45,696 | 同上 |
| 200 KB（带长上下文的 Agent） | ¥2,899 | ¥18,102 | ¥155,788 | 同上 |
| 500 KB（编码 Agent 常见） | ¥5,446 | ¥42,072 | **¥365,488** | 同上 |

和 Cloudflare 打平的点（每请求出流量，对优化写法到常规写法）：

- **10 亿次**：深圳约 24–34 KB，香港约 24–37 KB；AWS 美东 15–27 KB，Google Cloud 美东 16–30 KB，Azure 美东 10–22 KB；新加坡出流量更贵，打平点更低。Oracle 美东 336–466 KB，它的账单从 5 KB 到 500 KB 只是 ¥6,562 到 ¥34,518，同样区间 AWS 美东是 ¥18,896 到 ¥236,506。
- **1 亿次**：深圳约 6–14 KB。
- **1,000 万次**：云厂商的保底费已经比 Cloudflare 的全部账单还高，没有打平点。

CPU 时间：Cloudflare 从 5 毫秒到 20 毫秒，10 亿次时的月费从 ¥31,902 变到 ¥33,917。日志按官方平均每条 4.84 KB 算，10 亿次时 Cloudflare 常规写法是 ¥39,622、优化写法 ¥32,188。

</details>

<details>
<summary>延迟原始数据</summary>

| 2026-10-09 10:49（北京时间），深圳电信家宽，ICMP 往返 20 次 | 中位数 | P90 |
|---|---|---|
| 阿里云 深圳（ECS API 入口） | 7 ms | 19 ms |
| 阿里云 香港 | 13 ms | 16 ms |
| 腾讯云 广州（CVM API 入口） | 8 ms | 9 ms |
| 腾讯云 香港 | 13 ms | 20 ms |
| Cloudflare 任播地址（博客的 Pages / Functions 入口） | 162–164 ms | 166–186 ms |

同一条线路，11:55 左右再测各家的境外地域（ICMP 20 次，平均值）：

| 新加坡 | 平均 | 美东 | 平均 |
|---|---|---|---|
| 阿里云 新加坡 | 57 ms | 阿里云 弗吉尼亚 | 231 ms |
| 腾讯云 新加坡 | 89 ms | AWS us-east-1（S3 入口） | 224 ms |
| AWS ap-southeast-1（S3 入口） | 203 ms | Oracle us-ashburn-1 | 236 ms |
| Oracle ap-singapore-1 | 230 ms | | |

</details>

---

## 来源与核对日期

全部在 2026-10-09 核对。

- Cloudflare 价格与限制：
  - [Workers 定价](https://developers.cloudflare.com/workers/platform/pricing/)、[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)
  - [Durable Objects 定价](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[DO 设计规则](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
  - [KV 工作原理](https://developers.cloudflare.com/kv/concepts/how-kv-works/)、[Queues 定价](https://developers.cloudflare.com/queues/platform/pricing/)
  - [D1 定价](https://developers.cloudflare.com/d1/platform/pricing/)、[D1 限制](https://developers.cloudflare.com/d1/platform/limits/)
  - [Observability 定价（2026-12-01 起）](https://developers.cloudflare.com/observability/pricing/)
  - [AI Gateway 定价](https://developers.cloudflare.com/ai-gateway/reference/pricing/)、[AI Gateway 限制](https://developers.cloudflare.com/ai-gateway/reference/limits/)
  - [China Network](https://developers.cloudflare.com/china-network/)、[China Network 可用产品](https://developers.cloudflare.com/china-network/reference/available-products/)
- 阿里云（价格来自 aliyun CLI 询价接口，规则来自文档）：
  - [CDT 公网流量](https://help.aliyun.com/zh/cdt/internet-data-transfers/)、[升级至 CDT 计费](https://help.aliyun.com/zh/cdt/user-guide/upgrade-to-cdt-billing)
  - [ALB 计费规则](https://help.aliyun.com/zh/slb/application-load-balancer/product-overview/alb-billing-rules)、[NAT 网关计费](https://help.aliyun.com/zh/nat-gateway/nat-gateway-billing)
  - [函数计算计费](https://help.aliyun.com/zh/functioncompute/fc/product-overview/billing-overview-of-fc)、[单实例多并发](https://help.aliyun.com/zh/functioncompute/fc/configure-the-concurrency-of-a-single-instance)
  - [AI 网关规格与价格](https://help.aliyun.com/zh/api-gateway/ai-gateway/product-overview/free-product-templates)
  - [ESA 函数和 Pages 限制](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/what-is-functions-and-pages)、[ESA 函数计费](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/functions-and-pages-billing)
  - [通过私网连接访问百炼](https://help.aliyun.com/zh/model-studio/access-model-studio-through-privatelink)、[私网连接计费](https://help.aliyun.com/zh/privatelink/private-link-billing-description)、[AI 网关 Serverless 计费](https://help.aliyun.com/zh/api-gateway/ai-gateway/product-overview/overview-of-billing-during-the-serverless-public-preview-of-the)
- 腾讯云（价格来自 tccli 询价接口，规则来自文档）：
  - [公网流量价格](https://cloud.tencent.com/document/product/213/113026)、[CLB LCU 计费](https://cloud.tencent.com/document/product/214/58387)
  - [云函数计费](https://cloud.tencent.com/document/product/583/12281)、[云函数 SSE](https://cloud.tencent.com/document/product/583/90617)、[Web 函数请求多并发](https://cloud.tencent.com/document/product/583/123888)
  - [EdgeOne 套餐](https://cloud.tencent.com/document/product/1552/94158)、[EdgeOne 超额单价](https://cloud.tencent.com/document/product/1552/94159)、[边缘函数限制](https://cloud.tencent.com/document/product/1552/81344)
- 案例与故障：
  - Cloudflare 故障复盘：[2025-06-12](https://blog.cloudflare.com/cloudflare-service-outage-june-12-2025/)、[2025-11-18](https://blog.cloudflare.com/18-november-2025-outage/)
  - [阿里云香港可用区 C 故障说明（2022-12）](https://www.alibabacloud.com/zh/notice/resolved_service_outage_in_zone_c_of_the_china_hong_kong_region_1ae)
  - [Higress](https://github.com/higress-group/higress)、[阿里云 AI 网关产品页](https://www.aliyun.com/product/apigateway)
  - [GreatFire：workers.dev](https://en.greatfire.org/domain/workers.dev)（第三方观测）、[Cloudflare 社区：workers.dev 在大陆被封](https://community.cloudflare.com/t/cloudflare-workers-suspected-of-being-blocked-in-china/382155)
  - [Cloudflare 条款更新（2023）](https://blog.cloudflare.com/updated-tos/)、[Cloudflare 日志数据集（平均条目大小）](https://developers.cloudflare.com/observability/logs/datasets/)
- 海外四家（价格来自公开价格接口或官方价目页，规则来自文档）：
  - AWS：[EC2 按需价（含出流量）](https://aws.amazon.com/ec2/pricing/on-demand/)、[Lambda 定价](https://aws.amazon.com/lambda/pricing/)、[Lambda 响应流式](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html)、[ALB 空闲超时](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-load-balancer-attributes.html)、[AgentCore Gateway 推理目标](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-targets-inference.html)
  - Google Cloud：[网络价格](https://cloud.google.com/vpc/network-pricing)、[Cloud Run 定价](https://cloud.google.com/run/pricing)、[负载均衡超时](https://cloud.google.com/load-balancing/docs/https/request-distribution#timeouts_and_retries)、[Apigee 定价](https://cloud.google.com/apigee/pricing)
  - Azure：[带宽价格](https://azure.microsoft.com/en-us/pricing/details/bandwidth/)、[Application Gateway 与 SSE](https://learn.microsoft.com/en-us/azure/application-gateway/use-server-sent-events)、[Application Gateway 502 排查（超时重试）](https://learn.microsoft.com/en-us/troubleshoot/azure/application-gateway/application-gateway-troubleshooting-502)、[API Management 的 AI 网关能力](https://learn.microsoft.com/en-us/azure/api-management/genai-gateway-capabilities)、[API Management 限制（并发后端连接）](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits#api-management-limits)、[Front Door 与 WebSocket / SSE](https://learn.microsoft.com/en-us/azure/frontdoor/standard-premium/websocket)
  - Oracle：[价目表（网络）](https://www.oracle.com/cloud/price-list/#pricing-networking)、[VCN 价格](https://www.oracle.com/cloud/networking/virtual-cloud-network/pricing/)、[10 TB 按大区计的新闻稿（2021-11-10）](https://www.oracle.com/news/announcement/oracle-joins-cloudflare-bandwidth-alliance-2021-11-10/)
- 模型价格：[DeepSeek 定价](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)、[通义 qwen-flash](https://help.aliyun.com/zh/model-studio/qwen-flash)
- 工具版本：aliyun CLI 3.5.1、tccli 3.1.180.1、wrangler 4.148.0（npm 上最新是 4.149.0）；海外四家没有用 CLI，用的是上文的公开价格接口。
