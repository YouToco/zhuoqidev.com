---
title: 'Cloudflare, a Chinese Cloud or a Global Hyperscaler for Your LLM Gateway? Real Prices from Seven Clouds, from 10 Million to 1 Billion Requests a Month'
short: 'Where to run an LLM gateway'
description: "A request through an LLM gateway hangs on for 20 seconds while the upstream model streams tokens, yet the gateway does only about 10 ms of real work. Cloudflare bills those milliseconds and charges nothing for egress, but bills every read and write of state; Alibaba Cloud, Tencent Cloud, AWS, Google Cloud and Azure make state almost free but bill every byte of the prompts the gateway forwards; Oracle, with its first 10 TB of egress free each month, is the one exception. This article queries prices as of 2026-10-09 with the aliyun CLI, tccli, the clouds' public pricing APIs and official pricing pages, works out the bill line by line for seven providers at 10 million, 100 million and 1 billion requests a month, adds latency, reachability and real-world cases, and ends with when to choose which."
date: 2026-10-09
updated: 2026-10-09
lead: "At small volumes Cloudflare is an order of magnitude cheaper than self-hosting on any cloud. At 1 billion requests a month most clouds' self-hosted setups cost only 30% to a little over 100% more than Cloudflare, and Oracle, with almost free egress, comes out cheapest of all. **What decides it is not compute but three questions: who bills you for waiting, who bills you for carrying bytes, and who bills you for state.**"
tags:
- LLM Gateway
- Cloudflare Workers
- Durable Objects
- Alibaba Cloud
- Tencent Cloud
- Cost Modeling
- Architecture
categories:
- Deep Dives
---

**Version scope**: prices are public list prices as of 2026-10-09, excluding discounts and promotions. The two Chinese clouds were priced through the pricing APIs of their official command-line tools, the others through public pricing APIs or official pricing pages; exchange rate 1 USD = 6.7153 CNY. The commands, tool versions and full tables are in the [appendix](#appendix-how-the-prices-were-queried-and-the-full-numbers) at the end.

> [!NOTE]
> **Every bill rests on a set of illustrative assumptions**: each request lasts 20 seconds, the gateway computes for 10 ms, 50 KB goes out, and the machine sizes were not load-tested. The most sensitive of these is the last one, the bytes per request. [This chart](#how-many-bytes-a-request-carries-decides-who-is-cheaper) shows which side your workload falls on.

---

## The conclusion first

First, what each self-hosted setup and Cloudflare cost per month at three volumes (switch volumes with the tabs on top):

```chart
{
 "type": "bars",
 "fmt": {"pre": "¥"},
 "legend": [
   {"color": "seal", "label": "Cloudflare"},
   {"color": "green", "label": "Oracle"},
   {"color": "gray", "label": "other clouds, self-hosted"}
 ],
 "panels": [
   {
    "title": "10M requests / month",
    "rows": [
      {"label": "Cloudflare", "sub": "plain design", "value": 140, "color": "seal"},
      {"label": "Cloudflare", "sub": "optimized design", "value": 67, "color": "seal"},
      {"label": "Alibaba Cloud · Shenzhen", "value": 1625},
      {"label": "Tencent Cloud · Guangzhou", "value": 1422},
      {"label": "AWS · US East", "value": 2467},
      {"label": "Google Cloud · US East", "value": 3056},
      {"label": "Azure · US East", "value": 4794},
      {"label": "Oracle · US East", "value": 1973, "color": "green"}
    ]
   },
   {
    "title": "100M / month",
    "rows": [
      {"label": "Cloudflare", "sub": "plain design", "value": 2756, "color": "seal"},
      {"label": "Cloudflare", "sub": "optimized design", "value": 2115, "color": "seal"},
      {"label": "Alibaba Cloud · Shenzhen", "value": 5854},
      {"label": "Tencent Cloud · Guangzhou", "value": 5359},
      {"label": "AWS · US East", "value": 6646},
      {"label": "Google Cloud · US East", "value": 7387},
      {"label": "Azure · US East", "value": 9125},
      {"label": "Oracle · US East", "value": 2388, "color": "green"}
    ]
   },
   {
    "title": "1B / month",
    "rows": [
      {"label": "Cloudflare", "sub": "plain design", "value": 32574, "color": "seal"},
      {"label": "Cloudflare", "sub": "optimized design", "value": 25139, "color": "seal"},
      {"label": "Alibaba Cloud · Shenzhen", "value": 45696},
      {"label": "Tencent Cloud · Guangzhou", "value": 45179},
      {"label": "AWS · US East", "value": 47179},
      {"label": "Google Cloud · US East", "value": 43798},
      {"label": "Azure · US East", "value": 49848},
      {"label": "Oracle · US East", "value": 8832, "color": "green"}
    ]
   }
 ],
 "caption": "Monthly bill in CNY at list prices (2026-10-09). Self-hosted = load balancer + machines in two zones + Redis + MySQL + logs + egress. Hong Kong, Singapore and the managed and serverless options are in the appendix."
}
```

Six judgments:

1. **At small volumes, Cloudflare is an order of magnitude cheaper.** At 10 million requests a month Cloudflare costs a little over ¥100, while the cheapest self-hosted setup costs about ¥1,400. With a cloud provider you pay for the floor: two machines, a high-availability database and a Redis instance cost the same with or without traffic.
2. **At volume, the two sides spend their money in different places.** Cloudflare spends it on state, billing every key lookup and every bookkeeping write; the other clouds spend it on egress, billing every byte the gateway forwards for its customers. At 1 billion requests a month, self-hosting on Alibaba Cloud, Tencent Cloud or the three big Western clouds costs only 30% to a little over 100% more than Cloudflare.
3. **Oracle is the exception.** Its first 10 TB of egress each month is free, so at volume self-hosting in Oracle US East is about three times cheaper than Cloudflare. The price is running your own machines.
4. **What matters most is not the number of requests but the bytes each one carries.** For small requests such as short Q&A, self-hosting beats Cloudflare; for coding agents, whose requests often carry hundreds of kilobytes, Cloudflare is several times cheaper.
5. **At volume, serverless billed by wall-clock time is the most expensive choice.** Function Compute, SCF, Lambda and the like all bill the 20 seconds spent waiting upstream, with no exception among the six cloud providers.
6. **Beyond the bill, it matters where your users are.** From Shenzhen, the Chinese clouds are about 10 ms away and Cloudflare 160 ms. **If your users are mostly in mainland China, run on a Chinese cloud; if they are overseas, run on Cloudflare while small, and consider self-hosting on Oracle when large and egress-heavy.**

---

## Who this is for

- You know how to call an LLM API and that streamed output arrives piece by piece over SSE. You have written or configured a reverse proxy or an API gateway.
- You **do not** need to have used Cloudflare Workers or Alibaba Cloud load balancers; the glossary below explains every product the article relies on.
- The article **does not** cover model inference itself (GPUs, inference engines), and it touches compliance only where it shapes the architecture.

### Glossary

| Term | In one sentence |
|---|---|
| Wall-clock time | The real time from when a request arrives until it ends, including time spent waiting on others |
| CPU time | The time the program is actually computing; waiting on the network or a database does not count |
| SSE (server-sent events) | The format of streamed model output: one HTTP response stays open and a `data: …` line is pushed for each small piece generated |
| Self-hosted | Running the gateway process yourself on cloud servers: load balancer + machines in two zones + Redis + MySQL + logs |
| Workers | Cloudflare's edge functions; they run in data centers worldwide and are billed by requests and CPU time |
| Durable Object (DO) | Cloudflare's "named single-threaded mini-server": one name maps to exactly one instance worldwide, which suits per-API-key counters and balances |
| KV / Queues / D1 | Cloudflare's global key-value cache (eventually consistent) / message queue / SQLite database |
| Edge functions | Alibaba Cloud ESA's "Functions and Pages" and Tencent Cloud EdgeOne's edge functions, the Chinese counterparts of Workers |
| ICP filing | The registration with China's Ministry of Industry and Information Technology that a site needs before serving from mainland servers or nodes |

---

## From first principles: what an LLM gateway request looks like

Stripped down, an LLM gateway does six things:

```mermaid
flowchart TD
    C(["Client"]) --> A["1 Look up the API key<br>who is it, which models"]
    A --> B["2 Take a concurrency slot, hold balance<br>return 429 if over the limit"]
    B --> R["3 Pick an upstream line"]
    R --> U["4 Forward the request body upstream"]
    U --> S["5 Relay the SSE stream as is<br>about 20 s, almost no CPU"]
    S --> F["6 Read usage, release the slot<br>settle actual usage, write one log"]
    classDef wait fill:#d0ebff,stroke:#1971c2
    classDef work fill:#fff3bf,stroke:#f08c00
    class S wait
    class A,B,R,U,F work
```

*Figure: the minimal causal chain of one LLM gateway request (illustrative, not any product's implementation). The yellow steps compute, but each takes only milliseconds; the blue step waits, for anything from ten-odd seconds to several minutes.*

These six steps make an LLM gateway differ from an ordinary API gateway in three ways:

| Trait | Value used here (illustrative) | Why it matters |
|---|---|---|
| Long wall-clock time | 20 s | Most of it is spent waiting for the upstream model to generate tokens; reasoning models take longer |
| Short CPU time | 10 ms | Authentication, routing, relaying SSE chunk by chunk, finding the usage. Cloudflare's limits page gives as reference about 2.2 ms for an average Worker and typically 10–20 ms for heavier work such as authentication or parsing large payloads |
| Heavy egress | 50 KB per request | 30 KB is the customer's prompt forwarded upstream and 20 KB is the SSE stream sent back to the client. **For a gateway, forwarding the prompt is outbound traffic too** |

10 ms out of 20 s is 0.05%. In other words, the gateway spends 99.95% of its time waiting.

That is what sets the three kinds of billing apart. Think of the gateway as a switchboard operator: connecting a call takes seconds, but the call itself lasts twenty.

- **Billed by CPU time (Workers)**: you pay only for the seconds the operator's hands are busy.
- **Billed by active instance time (Function Compute, SCF, DO)**: you pay for the whole call, including the operator sitting idle.
- **Billed by reserved capacity (cloud servers, load balancers)**: you pay for how many operators you hire, busy or not.

Add one more item where the providers differ completely: **traffic**. Cloudflare charges nothing for egress; Alibaba Cloud and Tencent Cloud charge ¥0.5–1 per GB.

The pseudocode below maps the six steps onto Workers, with comments marking which lines wait and which compute. It is illustrative, not any platform's real source:

```ts
// Pseudocode (illustrative): one request through a Workers-based LLM gateway
export default {
  async fetch(req, env, ctx) {
    const key = await env.KEYS.get(apiKeyOf(req), "json");         // 1 KV read: waits on the network, no CPU
    if (!key) return new Response("invalid key", { status: 401 });

    const limiter = env.LIMITER.get(env.LIMITER.idFromName(key.id)); // one DO per API key
    const slot = await limiter.acquire(estimateCost(req));           // 2 take a slot + hold balance (1 row written)
    if (!slot.ok) return new Response("too many requests", { status: 429 });

    const upstream = await fetch(pickLine(key), forward(req));       // 3, 4 wait for the upstream's first bytes, no CPU
    const { readable, writable } = new TransformStream();
    ctx.waitUntil(pipeAndFindUsage(upstream.body, writable, async (usage) => {
      await limiter.release(slot.id, usage);                         // 6 release the slot + settle (1 row written)
      await env.USAGE.send({ key: key.id, usage });                  // 6 usage message; a consumer sums per minute into D1
    }));
    return new Response(readable, upstream);                         // 5 a 20-second stream; CPU only for copying chunks
  },
};
```

On Alibaba Cloud or Tencent Cloud the same six steps become one long-running process (a Higress plugin or your own Go service) plus a Redis instance:

- Step 1, key lookup: an in-process cache, falling back to Redis on a miss;
- Step 2, concurrency slot and balance hold: Redis `INCR` / `DECR` plus a Lua script;
- Step 6, usage: batched in the process, then written to the database in bulk or sent to a message queue.

**The architecture is the same; what differs is how each step is billed.**

---

## The bill taken apart: where the money goes

The three volumes are 10 million, 100 million and 1 billion requests a month, with the peak at 3× the average. Each request makes one key lookup, two bookkeeping writes (taking a slot at the start, settling at the end), one usage message and one log line of about 1 KB. Here is the bill at 1 billion requests a month, split into three parts:

```chart
{
 "type": "stack",
 "fmt": {"pre": "¥"},
 "series": [
   {"key": "state", "label": "State (key lookups, counters, balances, usage store)", "color": "blue"},
   {"key": "egress", "label": "Egress", "color": "gold"},
   {"key": "rest", "label": "Everything else (machines, load balancer, logs)", "color": "gray"}
 ],
 "rows": [
   {"label": "Cloudflare", "sub": "plain design", "values": {"state": 27462.09, "egress": 0, "rest": 5111.91}},
   {"label": "Cloudflare", "sub": "optimized design", "values": {"state": 20027.24, "egress": 0, "rest": 5111.91}},
   {"label": "Alibaba Cloud · Shenzhen", "values": {"state": 1730.0, "egress": 37997.0, "rest": 5968.64}},
   {"label": "Tencent Cloud · Guangzhou", "values": {"state": 2008.0, "egress": 40000.0, "rest": 3170.65}},
   {"label": "AWS · US East", "values": {"state": 4625.9, "egress": 28826.77, "rest": 13726.01}},
   {"label": "Oracle · US East", "values": {"state": 2954.46, "egress": 2269.5, "rest": 3607.73}}
 ],
 "caption": "The monthly bill at 1B requests a month, in three parts (CNY). Cloudflare charges for state per operation; the self-hosted Redis and MySQL are paid per instance."
}
```

**More than 80% of Cloudflare's bill is state; 60–90% of the Alibaba Cloud, Tencent Cloud and AWS bills is egress; Oracle's three parts are about the same size.** The next two sections explain why: Cloudflare bills every read and write of state, while a cloud's Redis is paid per instance and costs the same at ten times the requests; conversely, Cloudflare charges nothing for egress, and the clouds charge for every gigabyte.

### How many bytes a request carries decides who is cheaper

Cloudflare's bill does not depend on bytes; a self-hosted bill scales almost linearly with them. Here is egress per request taken from 5 KB to 100 KB:

```chart
{
 "type": "line",
 "fmt": {"pre": "¥"},
 "x": {"label": "Egress per request (KB)", "min": 0, "max": 100, "ticks": [0, 20, 40, 60, 80, 100]},
 "y": {"label": "Monthly bill at 1B requests a month (CNY)", "max": 100000, "ticks": [0, 20000, 40000, 60000, 80000, 100000]},
 "series": [
   {"label": "Alibaba Cloud Shenzhen, self-hosted", "color": "blue", "points": [[5, 9478], [10, 13723], [15, 17731], [20, 21726], [25, 25721], [30, 29716], [35, 33711], [40, 37706], [50, 45696], [60, 53247], [70, 60737], [80, 68227], [90, 75717], [100, 83207]]},
   {"label": "AWS US East, self-hosted", "color": "gray", "points": [[5, 18896], [10, 22186], [15, 25320], [20, 28443], [25, 31566], [30, 34688], [35, 37811], [40, 40933], [50, 47179], [60, 52548], [70, 57785], [80, 63023], [90, 68261], [100, 73499]]},
   {"label": "Oracle US East, self-hosted", "color": "green", "points": [[5, 6562], [10, 6562], [15, 6834], [20, 7119], [25, 7405], [30, 7690], [35, 7975], [40, 8261], [50, 8832], [60, 9402], [70, 9973], [80, 10544], [90, 11115], [100, 11686]]},
   {"label": "Cloudflare, plain design", "color": "seal", "points": [[0, 32574], [100, 32574]]},
   {"label": "Cloudflare, optimized design", "color": "seal", "dash": true, "points": [[0, 25139], [100, 25139]]}
 ],
 "marks": [
   {"x": 33.6, "y": 32574, "label": "break-even ≈ 34 KB", "color": "seal", "side": "left"},
   {"x": 50, "y": 45696, "label": "this article's 50 KB", "color": "blue"}
 ],
 "caption": "Cloudflare does not charge for egress, so it is two flat lines. A 500 KB coding-agent request is off the chart: Alibaba Cloud self-hosted ¥365,488, AWS ¥236,506, Oracle ¥34,518."
}
```

- **Small requests: self-hosting is cheaper.** Below about 34 KB out per request, self-hosting on Alibaba Cloud beats Cloudflare (about 24 KB against Cloudflare's optimized design). Short Q&A is around 5 KB, where self-hosting costs about a third of Cloudflare.
- **Large requests: Cloudflare is cheaper.** Coding agents' requests often carry hundreds of kilobytes, and there Cloudflare is several times cheaper. AWS breaks even at a lower point than Alibaba Cloud.
- **Oracle is cheapest across the whole range**, only drawing level with Cloudflare at three to four hundred kilobytes.
- **The smaller the volume, the lower the break-even point.** At 10 million requests a month the clouds' fixed floor already costs more than Cloudflare's whole bill, so they never break even.

So "Cloudflare is cheaper" **holds only when volume is small or requests are large**.

There is also a lever only the Chinese clouds have: **if the upstream model lives on the same cloud's internal network** (calling Alibaba Cloud Model Studio from Alibaba Cloud, for example), the forwarded prompt need not cross the public internet. Model Studio's private connection is currently offered only in Beijing and Hong Kong. With the gateway in the same region, at 1 billion requests a month the egress line drops from about ¥38,000 to about ¥19,000 (private-connection fees included); a gateway in Shenzhen reaching Beijing across regions saves almost nothing.

### CPU time barely moves the bill

Doubling the gateway's CPU time from 5 ms to 20 ms changes Cloudflare's monthly bill by only 6%, and a self-hosted setup still fits on four 8-vCPU machines. **When you are billed by CPU time, the 20 seconds spent waiting upstream cost almost nothing.**

### The gateway is small change next to the model bill

Per request, Cloudflare costs about ¥0.00003 and self-hosting on Alibaba Cloud about ¥0.000045. Compare that with the model: a call with 7,500 input tokens and 300 output tokens costs about ¥0.017 at DeepSeek V4.1-Flash peak prices, so the gateway is only 0.2–0.3% of it; even with the far cheaper Qwen qwen-flash it is just 2–3% (both vendors' prices checked 2026-10-08). **So the bill alone should not decide the platform; latency, reachability and stability matter at least as much.**

---

## On Cloudflare: free egress, state billed per operation

**The savings come from two things, both stated on the official pricing pages.** First, billing is by CPU time: waiting on `fetch()`, KV or a database does not count, and wall-clock duration is neither billed nor capped, so a 20-second stream costs the same as a 0.2-second one. Second, egress and bandwidth are free, and so are the subrequests a Worker makes, so forwarding a prompt costs nothing. Nor do the terms cap bandwidth: since Cloudflare's 2023 terms update, the limit on serving large amounts of non-web content applies only to the CDN, not to the developer platform ([terms update](https://blog.cloudflare.com/updated-tos/)).

**Where it gets expensive: every read and write of state is billed.**

1. **The largest item is DO row writes**, about ¥13,000 a month at 1 billion requests. Concurrency slots and balances must be written to the DO's built-in SQLite rather than kept only in memory: a DO idle for about 10 seconds may hibernate and lose its in-memory counts, while a stream lasts 20 seconds. The optimized design sums usage inside the DO, flushes it once a minute and drops Queues, which cuts the bill by more than a fifth.
2. **A DO is single-threaded.** The official soft limit for one object is about 1,000 requests a second, lower with storage writes, and the official design rules page explicitly warns against using a single DO for global rate limiting. The right pattern is one DO per API key, with large customers' keys split into shards.
3. **KV is eventually consistent.** Other locations may take 60 seconds or more to see a change, so revoking a key or changing a balance cannot rely on KV alone. Pydantic's open-source AI gateway admits in its old README that with state cached in KV, spending limits can only be "soft".
4. **A D1 database is capped at 10 GB, and the cap cannot be raised.** A usage table summed per minute fills up in just over a month at 1 billion requests a month. So you summarize periodically, split databases by month (an account can have 50,000 of them) and archive cold data to R2.

**Three traps that multiply the bill several times over:**

- **Keeping a DO active for the whole stream.** Route the stream through the DO, or arm a `setTimeout` in it as a lease timeout, and the DO is billed by wall-clock duration, adding up to about ¥215,000 a month at 1 billion requests. Use `setAlarm` for lease timeouts. Since 2026-10-01, pending outbound calls and `waitUntil` in a DO also keep it active (for up to 15 minutes), which makes this easier to hit.
- **AI Gateway logs the full prompt and response by default.** Accounts that create their first AI Gateway on or after 2026-09-24 pay for logs at Workers Logs prices, about ¥94,000 a month at 1 billion requests. Turn off payload logging or logging altogether. Also, with Cloudflare's Unified Billing each gateway allows only 200 requests a minute, which the average rate at 10 million requests a month already exceeds, so a reseller has to bring its own upstream keys (BYOK).
- **The default log settings.** New Workers have logs on by default and write an invocation log for every call, and by the docs each DO RPC writes one too, so one request makes about 4 log entries. At Cloudflare's own average of 4.84 KB per entry, the log bill grows about twentyfold. Turn off invocation logs or sample them on the gateway and DO Workers.

**One date to watch**: Workers Logs switches from per-event to per-GB pricing on 2026-12-01 (announced in Cloudflare's 2026-10-02 blog post), and this article uses the new prices. Metering includes the fields Cloudflare adds automatically, so 1 KB per entry is a lower bound; at 4.84 KB per entry, the plain design at 1 billion requests a month goes from about ¥33,000 to about ¥40,000.

---

## On the Chinese clouds: state almost free, egress billed per byte

**The savings come from state being paid per instance.** A 1 GB two-replica Redis costs ¥77 a month and is rated at 100,000 operations a second; the peak at 1 billion requests a month needs only about 4,600. Key lookups, counters and balances all sit on it, and **ten times the requests cost the same**.

**Where it gets expensive: egress.**

1. **Forwarding prompts counts as egress.** Of the 50 KB per request, 30 KB is the gateway sending the customer's prompt upstream.
2. **Offshore nodes have cheaper egress, but the tiered price must be switched on by hand.** Alibaba Cloud Hong Kong, Singapore and Tokyo charge less per GB than Shenzhen, so at 1 billion requests a month Hong Kong comes out cheaper than Shenzhen even though its machines cost nearly twice as much. But since 2024-12-12, ECS and EIP **are no longer billed on the tiered price** (Alibaba Cloud calls it CDT) automatically; you must "upgrade to CDT billing" by hand (free, and irreversible). Without it, Hong Kong costs about ¥21,000 more a month at 1 billion requests. Singapore and Tokyo are the other way round: without the upgrade their base price is below the first tier, so within a range of volumes not upgrading is cheaper.
3. **Do not send upstream traffic through NAT.** Since 2025-09-26 Alibaba Cloud's NAT gateway bills processed traffic, so routing upstream requests through NAT adds about 23% on top of egress. A pay-by-traffic public IP on each ECS instance is cheaper.
4. **Long-lived connections do not make the load balancer expensive, but timeouts can cut them.** Alibaba Cloud ALB's capacity charge is driven by bytes processed, and 23,000 long-lived connections come to fewer than 8 capacity units; Tencent Cloud's shared CLB does not bill capacity at all. But **ALB's request timeout defaults to 60 seconds**, so raise it before long reasoning streams start returning 504.

**Managed AI gateway** (the AI Gateway in Alibaba Cloud's cloud-native API Gateway, built on the open-source Higress): it has multi-model routing, fallback, consumer API keys and token rate limits, and its billing items show no separate charge for those features, but the smallest size costs about ¥4,000 a month (documented price). You still need your own Redis and database for per-customer balances and usage, so at small volumes it costs more than three times as much as the whole self-hosted setup. The Serverless edition, billed from 2026-09-01, has no size floor in the thousands (the enterprise edition's instance fee is about ¥176 a month), so at small volumes it costs about the same as self-hosting; but it bills public traffic in both directions at ¥0.8/GB, outside the tiered prices, so it gets more expensive at volume.

---

## The four Western clouds: the big three keep the same books as the Chinese clouds, Oracle is the exception

**The big three's egress prices are in the same range as the Chinese clouds'.** AWS, Google Cloud and Azure charge the equivalent of ¥0.6–0.8 per GB in the first tier, dropping to a little over ¥0.5 at volume, slightly below Alibaba Cloud.

**Machines, databases and logs cost more.** At small volumes AWS US East costs 50% more than Alibaba Cloud Shenzhen, and Azure US East nearly three times as much. Logs stand out: all three charge $0.50 per GB, more than 8× Alibaba Cloud's log service. The two effects cancel out, and at volume the big three and the Chinese clouds end up with similar bills.

If your clients are in mainland China, the traffic Google Cloud sends back to them falls under the price list's "to mainland China" rate, $0.20–0.23 per GiB (Google does not say how the destination is determined). Pricing all egress that way (an upper bound) raises US East at 1 billion requests a month from about ¥44,000 to about ¥81,000.

**Oracle's egress is almost free.** Its price list states that the first 10 TB of egress each month is free, and beyond that it costs $0.0085/GB in North America and $0.025/GB in Asia-Pacific. Traffic within a region (including across availability domains) is free, data handled by the load balancer is not billed separately, and log ingestion is free, with only storage billed. So at 1 billion requests a month, 50 TB of egress costs about ¥2,300 in US East, against about ¥38,000 for the same traffic on Alibaba Cloud Shenzhen. The costs show up elsewhere:

- The 10 TB free tier applies per source region group: Oracle's 2021 [press release](https://www.oracle.com/news/announcement/oracle-joins-cloudflare-bandwidth-alliance-2021-11-10/) and a 2025 official white paper both say "each regional zone". US East (North America) and Singapore (Asia-Pacific) each get 10 TB, and regions in the same group share one.
- Singapore has only one availability domain (Oracle's term for an availability zone), so you cannot spread across zones, only across fault domains.
- A pay-as-you-go account gets only 6 OCPUs per availability domain and one region by default, so at volume you must request a quota increase first.
- The NAT gateway caps concurrent connections to the same destination address and port, about 20,000 per availability domain in US East. 23,000 streams in one availability domain going to one upstream would hit it, so machines are better off exiting through their own public IPs (reserved public IPs are officially free).
- The smallest high-availability MySQL is billed as 3 instances, $170 a month, the largest item at small volumes.

**Default load balancer timeouts are the easiest trap before launch:**

| | Default | Effect on SSE |
|---|---|---|
| Alibaba Cloud ALB | 60 s request timeout, counted as time without data between ALB and the backend (per the WebSocket docs; SSE is not covered) | A reasoning model that thinks for over 60 s before its first token gets a 504; raise it first |
| AWS ALB | 60 s idle timeout, up to 4,000 s | A reasoning model that thinks for over 60 s before its first token gets cut off; raise it or send SSE heartbeats |
| Google Cloud external Application Load Balancer | 30 s backend service timeout, **counting the whole response** | Not an idle timeout: streams over 30 s are cut off; global load balancers can go up to 86,400 s, so raise it before launch |
| Azure Application Gateway v2 | 20 s request timeout, counted as time without data | The troubleshooting docs say that after a timeout it resends the request to another backend, with no exception for POST; if POST is retried too, a request whose first token takes over 20 s **may be forwarded twice and billed twice upstream** (inference, not tested); SSE also needs the response buffer, on by default, switched off |
| Oracle flexible load balancer | 60 s idle timeout, up to 7,200 s | Sending data does not reset the receive timer |

---

## Serverless and edge functions: neither works at volume

Serverless billed by wall-clock time pays for the 20 seconds of waiting for upstream tokens, with no exception among the six cloud providers. Only at small volumes, with several requests per instance, are Function Compute, Cloud Run and Container Apps slightly cheaper than self-hosting, because they skip the always-on machines and load balancer; as volume grows it flips:

```chart
{
 "type": "bars",
 "fmt": {"pre": "¥"},
 "ref": {"value": 45696, "label": "Alibaba Cloud Shenzhen, self-hosted"},
 "rows": [
   {"label": "Cloudflare Workers", "sub": "billed by CPU time", "value": 32574, "color": "seal"},
   {"label": "Google Cloud Run", "sub": "250 requests per instance", "value": 59634},
   {"label": "Alibaba Cloud AI Gateway", "sub": "managed", "value": 60518},
   {"label": "Alibaba Cloud Function Compute", "sub": "100 requests per instance", "value": 68877},
   {"label": "Tencent Cloud SCF", "sub": "multi-request mode, estimated", "value": 75903},
   {"label": "Azure Container Apps", "sub": "100 streams per replica", "value": 79376},
   {"label": "Google Cloud Run", "sub": "80 requests per instance", "value": 107676},
   {"label": "OCI Functions", "sub": "Oracle", "value": 264894},
   {"label": "AWS Lambda", "sub": "128 MB Arm", "value": 278460},
   {"label": "Tencent Cloud SCF", "sub": "default, one stream per instance", "value": 321865}
 ],
 "caption": "Monthly bill at 1B requests a month (CNY, including Redis, database, logs and egress). The dashed line is Alibaba Cloud Shenzhen, self-hosted. Wall-clock billing pays for the 20 seconds of waiting on the upstream; Cloudflare Workers bills CPU time only."
}
```

Each platform's limits:

- **Alibaba Cloud Function Compute**: it bills the configured size, not actual use, so the vCPU is billed in full for the 20 seconds spent waiting upstream and never enters the "light sleep" state in which vCPU is free. The only saving is concurrency per instance: at 1 request per instance the compute charge is about 95 times that at 100.
- **Tencent Cloud SCF**: its SSE documentation states that by default one function instance handles only one SSE connection at a time, and at volume the peak also exceeds the default concurrency quota per region. Web functions can turn on multi-concurrency, whose docs list long-lived connections as the main use case but only give WebSocket as an example; the chart's figure assumes 100 concurrent requests per instance at 70% fill and was not tested.
- **AWS Lambda**: one execution environment handles one request at a time, and a streamed response is billed until the whole stream ends, even if the client disconnects; default concurrency is 1,000, so volume needs a quota increase.
- **Google Cloud Run**: one instance can handle up to 1,000 requests at once, the best fit for long-lived connections of the lot, but it still bills instance wall-clock time. It also writes request logs automatically at $0.50 per GiB (an exclusion filter can turn them off), which the chart leaves out.
- **Azure**: Functions Flex defaults to 16 concurrent requests per instance, so 1 billion requests a month would need 1,447 instances, above the 1,000-instance cap; Container Apps runs once concurrency is raised to 100.
- **OCI Functions**: one instance handles one request at a time, synchronous calls last at most 300 seconds, and the result only comes back after the function finishes, so it cannot stream.

**Edge functions cannot serve as a general LLM gateway**, because of their limits rather than their price:

| | Cloudflare Workers | Alibaba Cloud ESA functions | Tencent Cloud EdgeOne edge functions |
|---|---|---|---|
| Billing | Requests + CPU time | Per invocation, ¥5 per million | Requests ¥1.7 per million + CPU ¥0.11 per million ms |
| Total duration per invocation | Unlimited (while the client stays connected) | **120 s** (waiting counts) | No limit documented; `fetch` timeout configurable up to 300 s |
| First byte | No limit documented | **504 if no data within 10 s** | No limit documented |
| Request body | 100 MB and up (depends on the zone's plan) | Not in the function docs; site upload limit 300 MB by default | **1 MB** |
| CPU per invocation | 30 s by default, configurable up to 5 min | No figure documented | **200 ms** |
| Subrequests | 10,000 by default | **4** (the Chinese docs say 4 per invocation, the English docs 4 concurrent and raisable on request) | 64 |
| Strongly consistent state | Durable Objects | None (KV is eventually consistent, up to 300 s) | KV in beta, Enterprise only, 1 million reads per namespace per day |
| Mainland China nodes | Only via China Network (Enterprise + ICP) | Yes, with ICP filing | Yes, with ICP filing |

Reasoning models often take more than 10 seconds to the first token and more than 120 seconds for long outputs, and agents' long-context requests easily exceed 1 MB. Neither Chinese product has strongly consistent state like a DO, so rate limits and balances still have to go back to a central region. Overseas, neither CloudFront Functions nor Lambda@Edge can relay a 20-second SSE stream, and Azure Front Door's docs state that it does not support SSE. **Edge functions can sit in front of a gateway for caching and authentication pre-checks; they cannot replace it.**

**Managed AI gateways overseas** exist at the big three, not at Oracle, and none is built for reselling:

- **Azure API Management**: all three v2 tiers pass SSE through and offer per-token rate-limit policies such as `llm-token-limit`; at small volumes Basic v2 costs about $148 a month (Microsoft positions it for development and testing). The bottleneck is the cap of 2,048 concurrent backend connections per upstream host: one SSE stream holds one connection, so the peak at 100 million requests a month already exceeds it. The classic tiers state the cap per unit while v2 just says 2,048; read per unit, 1 billion requests a month needs 12 units at about $18,000 a month, and read literally, 12 separate instances plus an extra layer to split traffic. HTTP/2 to the upstream is still in preview in v2.
- **AWS**: Bedrock AgentCore Gateway (inference targets since 2026-07) can proxy OpenAI, Anthropic and compatible endpoints, passing SSE through unchanged, and since 2026-08 can cap RPM, TPM and concurrency per user identity. But built-in authentication is only IAM, JWT or none; custom checks need an interceptor, which the docs say does not yet work in streaming mode; and there are no per-customer API keys, per-customer usage bills or prepaid balances. API Gateway REST APIs have supported streamed responses since 2025-11, but cannot read usage from the stream.
- **Google**: Apigee passes SSE through, but its per-token rate-limit policy only works on the most expensive proxy type, about $73,000 a month in call fees alone at 1 billion requests.
- **Oracle**: no general LLM gateway; its generative AI service only calls models in its own catalog.

---

## Beyond the bill: latency and reachability

```chart
{
 "type": "bars",
 "fmt": {"suf": " ms"},
 "rows": [
   {"label": "Alibaba Cloud · Shenzhen", "value": 7, "color": "gray"},
   {"label": "Tencent Cloud · Guangzhou", "value": 8, "color": "gray"},
   {"label": "Alibaba Cloud · Hong Kong", "value": 13, "color": "gray"},
   {"label": "Tencent Cloud · Hong Kong", "value": 13, "color": "gray"},
   {"label": "Alibaba Cloud · Singapore", "value": 57, "color": "gray"},
   {"label": "Tencent Cloud · Singapore", "value": 89, "color": "gray"},
   {"label": "Cloudflare", "value": 162, "color": "seal", "sub": "anycast, lands in Los Angeles"},
   {"label": "AWS · Singapore", "value": 203, "color": "gray"},
   {"label": "AWS · US East", "value": 224, "color": "gray"},
   {"label": "Oracle · Singapore", "value": 230, "color": "gray"},
   {"label": "Alibaba Cloud · Virginia", "value": 231, "color": "gray"},
   {"label": "Oracle · US East", "value": 236, "color": "gray"}
 ],
 "caption": "Ping from a China Telecom home line in Shenzhen, 2026-10-09, 20 probes each. Mainland regions and Cloudflare are the 10:49 median, the overseas regions the 11:55 average. Azure and Google Cloud answer on global anycast addresses, so no region can be measured."
}
```

A few notes:

- **Method**: my local network transparently proxies every TCP connection, so any handshake takes 2–3 ms; that is why I used ping. This is one line at one time of day; two evenings earlier, a TCP handshake test to Cloudflare from the same network measured 193 ms.
- **Route**: `mtr` shows packets to Cloudflare jumping from about 9 ms to about 160 ms on China Telecom's 163 backbone, which is where they leave China, and ending at a Cloudflare address in Los Angeles.
- **Singapore is not necessarily close**: in the same city, Alibaba Cloud is 57 ms away while AWS and Oracle take over 200 ms, about as much as US East. Chinese clouds' overseas regions usually interconnect far better with Chinese carriers.

**Effect on time to first token**: a new HTTPS connection needs at least three round trips (TCP, TLS 1.3, sending the request). At 162 ms per round trip that adds about 0.45 seconds before the first token; with a reused connection it adds about 0.15 seconds. Chat users will notice; long agent tasks barely will.

**Three more things:**

- **This architecture cannot move into China Network.** Cloudflare states that without China Network, users in mainland China connect to data centers outside the mainland. China Network needs the Enterprise plan, a separate subscription, an ICP filing or license for every apex domain, and content review by JD Cloud; its product list includes Workers, KV and R2 but **not DO, D1 or Queues** (Cloudflare does not say whether these fail on JD Cloud nodes or fall back to overseas). `*.workers.dev` is blocked in mainland China: a Cloudflare employee confirmed it in the [official community](https://community.cloudflare.com/t/cloudflare-workers-suspected-of-being-blocked-in-china/382155), and GreatFire's third-party monitoring still shows it fully blocked as of 10-07, so you must use your own domain.
- **For overseas models, the long hop cannot be avoided.** Neither OpenAI's nor Anthropic's list of supported API regions includes mainland China or Hong Kong ([OpenAI](https://developers.openai.com/api/docs/supported-countries), [Anthropic](https://www.anthropic.com/supported-countries), checked 2026-10-09). A gateway that calls them must exit from a supported region such as Singapore, Japan or the United States; a Hong Kong node can only relay. Seen from a mainland user, the long hop happens either on "user → Cloudflare Los Angeles" or on "offshore gateway → US upstream". So when calling overseas models, Cloudflare's latency handicap shrinks a lot, and the difference is mostly line quality.
- **Both sides have had major outages, of different shapes.** On 2025-06-12 a third-party cloud that KV depended on went down and AI Gateway's error rate peaked at 97%; on 2025-11-18 a core proxy failure made KV return many 5xx errors too. A gateway that reads KV or a DO synchronously on every request goes down with the whole world, with no other zone to fail over to. Alibaba Cloud Hong Kong Zone C was down for more than ten hours on 2022-12-18 after a cooling failure, but the failure was confined to one zone, so a multi-zone deployment had a way out.

---

## Who really runs an LLM gateway on Workers

I accepted only first-hand evidence: official blogs, official docs, deployment configs in repositories and articles signed by founders.

| Platform | Cloudflare components used | Evidence | Strength |
|---|---|---|---|
| **Cloudflare AI Gateway** | Workers; logs first in D1, then moved to R2, then to DOs sharded by account + gateway | [Official blog, 2024-10-24](https://blog.cloudflare.com/billions-and-billions-of-logs-scaling-ai-gateway-with-the-cloudflare/) | Confirmed |
| **Helicone** (hosted proxy and hosted AI Gateway) | Workers + DO (rate limiters, plus one wallet per organization that holds the worst-case cost at the start and settles actual usage at the end) + KV + Queues; request bodies over 20 MiB go to Containers; backend on AWS | [`worker/wrangler.toml`](https://github.com/Helicone/helicone/blob/main/worker/wrangler.toml), [wallet DO](https://github.com/Helicone/helicone/blob/main/worker/src/lib/durable-objects/Wallet.ts), [official docs](https://docs.helicone.ai/references/availability) | Confirmed (edge request path) |
| **OpenRouter** | Edge layer on Workers, caching user and API key data at the edge; when a balance runs low it checks the database more often and latency rises | [Official docs](https://openrouter.ai/docs/guides/best-practices/latency-and-performance) | Confirmed (edge layer only) |
| **Portkey** | The open-source gateway repo ships a production `wrangler.toml`, and the official docs say the hosted version runs on "edge workers" worldwide | [wrangler.toml](https://github.com/Portkey-AI/gateway/blob/main/wrangler.toml) | Indirect evidence |
| **Unkey** (moved away) | Used Workers + DO for API key verification and rate limiting; in 2025-08 moved to a stateful Go service on AWS | [Co-founder's post, 2025-08-01](https://www.unkey.com/blog/serverless-exit) | Confirmed |
| **Braintrust** (moved away) | Its AI Proxy ran on Workers in 2023; the hosted entry point is now a Gateway on AWS, for reasons not made public | [2023 blog post](https://www.braintrust.dev/blog/ai-proxy), [current docs](https://www.braintrust.dev/docs/deploy/gateway) | Confirmed that it moved |

Three things stand out:

1. **Apart from Cloudflare itself, none of them is "all Cloudflare".** The closest is Helicone: Workers, DO, KV and Queues on the request path are all on Cloudflare, while analytics and the billing backend are on AWS. This article's Cloudflare side keeps even billing in D1, which is more aggressive than what these companies actually do.
2. **Everyone's pain is in the state layer, not compute.** AI Gateway's log storage, Helicone's wallet holds, OpenRouter's database checks on low balances, the Pydantic gateway's soft KV limits.
3. **Unkey left for reasons specific to its workload.** Its reasons: cache reads had to go over the network, with p99 above 30 ms; to work around statelessness it stacked up DO, Queues, Workflows and more; exporting data was painful; customers could not self-host. After moving, latency fell to one sixth. But Unkey has to finish key verification within 10 ms per request, whereas an LLM gateway request lasts 20 seconds anyway, so tens of milliseconds of state reads weigh far less, and that conclusion does not carry over as is.

On the Chinese side the mainstream approach is **a long-running gateway process plus Redis**, not edge functions:

- **Higress**: the gateway open-sourced by Alibaba, accepted into the CNCF Sandbox on 2026-03-15, about 9,500 stars. The project says it powers the Qwen app, Model Studio's model API and PAI, but publishes no traffic figures. Its token rate limiting uses Redis for global counters, the same design point as the DO counters on the Cloudflare side.
- **Alibaba Cloud AI Gateway**: in an official customer case, all of China Pacific Property Insurance's LLM traffic goes through the AI Gateway, close to 100 million tokens a day.
- **Chinese edge functions**: I found no named LLM gateway customer.

---

## How to choose

```mermaid
flowchart LR
    %% layout: tree
    Q(["Where are your paying users?"])
    Q --> CN["Mainland China"] --> CN1["Mostly Chinese models<br>→ Alibaba / Tencent Cloud mainland: long-running gateway (Higress or your own) + Redis<br>avoid Function Compute / SCF; edge functions only in front"]
    CN --> CN2["Overseas models too<br>→ mainland entry + offshore node for overseas models<br>exit from a region OpenAI / Anthropic support (e.g. Singapore, Tokyo)<br>upgrade Hong Kong nodes to CDT; work out Singapore and Tokyo first"]
    Q --> OS["Overseas"] --> OS1["Small, no machines to run<br>→ Cloudflare Workers + one DO per key<br>billing split by month or an external database; logs without payloads"]
    OS --> OS2["Large and egress-heavy<br>→ self-host on Oracle (first 10 TB of egress free each month)<br>already on AWS / GCP / Azure: egress bill similar to Chinese clouds"]
    Q --> BOTH["Both"] --> BOTH1["→ two entry points, each close to its users<br>billing in one place only, no dual writes"]
    classDef q fill:#fff3bf,stroke:#f08c00
    classDef pick fill:#d3f9d8,stroke:#2f9e44
    class Q q
    class CN1,CN2,OS1,OS2,BOTH1 pick
```

*Figure: a decision tree for choosing by where users are (this article's judgment, not official advice).*

**When to choose Cloudflare:**

- Your users are mostly overseas, or they are developers calling overseas models;
- You are still small (tens of millions of requests a month or fewer) and want a near-zero floor with no machines to run; no self-hosted setup at the six cloud providers can match it;
- Your requests are large (agents, long context, multimodal), so egress would dominate a cloud provider's bill;
- Your team can accept state-driven design work such as one DO per key and periodic D1 archiving.

**When not to use Cloudflare:**

- Your users are mostly in mainland China and sensitive to time to first token (chat products);
- You are at around 1 billion requests a month with short requests (under about 30 KB out per request), where self-hosting on a Chinese cloud or one of the big three is cheaper;
- Your users are overseas, you are large, and you are willing to run your own machines: self-hosting on Oracle is about three times cheaper;
- You need strongly consistent global state (global concurrency, a credit pool across keys) and do not want to shard it yourself;
- You need nodes in mainland China but cannot afford Enterprise, or you rely on DO, D1 or Queues.

---

## Closing

An LLM gateway is not compute-bound. It is **bound by waiting, by carrying bytes and by state**. Comparing two clouds on CPU price compares the smallest line on the bill.

> **Rule: first ask three questions — who bills you for waiting, who bills you for carrying bytes, who bills you for state. Then look at which side your users are closer to.**

---

## Appendix: how the prices were queried, and the full numbers

Every number in the main text comes from here. "10M / 100M / 1B" in the table headers are requests per month.

### How the prices were queried

- **The two Chinese clouds were priced through their official command-line tools.** Alibaba Cloud through aliyun CLI 3.5.1 (`DescribePrice`, `GetPayAsYouGoPrice`), Tencent Cloud through tccli 3.1.180.1 (`InquiryPrice*`, `DescribeDBPrice`). Every call is a read-only pricing query, and no resource was created.
- **All Cloudflare numbers come from the official pricing and limits pages.** Cloudflare has no pricing API; wrangler 4.148.0 and the Cloudflare API only report your own account's usage.
- **The four Western clouds were priced through public pricing APIs that need no login** (AWS Price List, Azure Retail Prices API, Oracle's price list API); Google Cloud's pricing API needs an API key, so its numbers come from the official pricing pages. US East and Singapore, all on-demand, 720-hour months. Reserved instances or Savings Plans can save another 30–50%, but only on machines, not on egress.
- **List prices only.** Alibaba Cloud's pricing APIs also return account discounts (my account, for example, gets 15% off load balancers and NAT), which are left out. Where no API works, the documented price is used and marked; Alibaba Cloud's AI Gateway, for example, has no pricing module in the billing system.
- **Two verification rounds on the same day**: every item the first rounds had marked unverified was checked against official sources; what could be confirmed is now in the text, and what still cannot (mostly things that need an account, a load test or a real bill) is still marked.

<details>
<summary>A few representative pricing queries (the full command list and raw output were kept)</summary>

```bash open
# Alibaba Cloud: ECS monthly price (40 GB ESSD PL0 system disk, no bandwidth)
aliyun ecs DescribePrice --RegionId cn-shenzhen --ResourceType instance \
  --InstanceType ecs.c9i.xlarge --PriceUnit Month --Period 1 \
  --SystemDisk.Category cloud_essd --SystemDisk.PerformanceLevel PL0 --SystemDisk.Size 40

# Alibaba Cloud: total price of 50,000 GB of public egress on CDT tiers
aliyun bssopenapi GetPayAsYouGoPrice --region cn-hangzhou --ProductCode cdt \
  --ProductType cdt_DataTransfer_public_cn --SubscriptionType PayAsYouGo --Region cn-shenzhen \
  --ModuleList.1.ModuleCode internet_traffic --ModuleList.1.PriceType Usage \
  --ModuleList.1.Config 'Region:cn-shenzhen,internet_traffic:50000,charge_type:PayByTraffic,isp:BGP'

# Alibaba Cloud: Redis (Tair) and RDS monthly prices
aliyun r-kvstore DescribePrice --RegionId cn-shenzhen --ZoneId cn-shenzhen-c \
  --InstanceClass redis.shard.large.ce --OrderType BUY --ChargeType PrePaid --Period 1 --NodeType MASTER_SLAVE
aliyun rds DescribePrice --RegionId cn-shenzhen --ZoneId cn-shenzhen-c --Engine MySQL --EngineVersion 8.0 \
  --DBInstanceClass mysql.n4.large.2c --DBInstanceStorage 100 --DBInstanceStorageType cloud_essd \
  --PayType Prepaid --UsedTime 1 --TimeType Month --Quantity 1 --OrderType BUY --CommodityCode rds

# Tencent Cloud: CVM monthly price (50 GB general-purpose SSD, bandwidth set to 0)
TENCENTCLOUD_REGION=ap-guangzhou tccli cvm InquiryPriceRunInstances --cli-unfold-argument \
  --Placement.Zone ap-guangzhou-6 --ImageId img-mmytdhbn --InstanceType SA9.LARGE8 \
  --InstanceChargeType PREPAID --InstanceChargePrepaid.Period 1 \
  --SystemDisk.DiskType CLOUD_BSSD --SystemDisk.DiskSize 50 \
  --InternetAccessible.InternetChargeType TRAFFIC_POSTPAID_BY_HOUR \
  --InternetAccessible.InternetMaxBandwidthOut 0 --InstanceCount 1
```

```bash open
# AWS: egress tiers from us-east-1 to the internet (public Price List file, AWSDataTransfer service)
curl -s https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSDataTransfer/current/us-east-1/index.json

# Azure: egress tiers in eastus (Retail Prices API)
curl -s "https://prices.azure.com/api/retail/prices?\$filter=serviceName%20eq%20'Bandwidth'%20and%20armRegionName%20eq%20'eastus'%20and%20meterName%20eq%20'Standard%20Data%20Transfer%20Out'"

# Oracle: egress originating in North America (price list API, B88327 = Outbound Data Transfer - Originating in North America, Europe, and UK)
curl -s "https://apexapps.oracle.com/pls/apex/cetools/api/v1/products/?currencyCode=USD&partNumber=B88327"
```

</details>

### Key unit prices

<details>
<summary>Cloudflare, Alibaba Cloud (Shenzhen), Tencent Cloud (Guangzhou)</summary>

| | Cloudflare (USD) | Alibaba Cloud (Shenzhen, CNY) | Tencent Cloud (Guangzhou, CNY) |
|---|---|---|---|
| Compute | Workers $5/month including 10M requests and 30M CPU ms; then $0.30 per million requests and $0.02 per million CPU ms; **no charge for wall-clock duration** | ECS c9i monthly: 2c4g ¥205.91, 4c8g ¥391.82, 8c16g ¥763.64 (system disk included) | CVM SA9 monthly: 2c4g ¥156.2, 4c8g ¥287.4, 8c16g ¥549.8 (system disk included) |
| Load balancer | Not needed | ALB instance ¥0.049/hour + capacity units (LCU) ¥0.049 per LCU-hour; an LCU is the largest of four dimensions: new connections, concurrent connections, bytes processed and rule evaluations | CLB shared ¥0.2/hour, **no capacity charge** |
| Egress | **Free** | CDT tiers: ¥0.80/GB up to 10 TB, ¥0.75 for 10–50 TB, ¥0.70 for 50–150 TB, ¥0.65 beyond; 20 GB free per month | ¥0.80/GB flat, no tiers and no free quota |
| Counters / balance | DO: requests $0.15 per million; SQLite writes $1.00 per million rows (50M rows included) | Tair, two replicas: 1 GB ¥76.98/month, 4 GB ¥360/month | Redis primary-replica: 1 GB ¥76/month, 4 GB ¥304/month |
| Key lookup | KV reads $0.50 per million (10M included) | The same Redis | The same Redis |
| Usage / billing database | Queues $0.40 per million operations (3 per message); D1 writes $1.00 per million rows, **10 GB max per database** | RDS MySQL high-availability: 2c4g ¥660/month, 4c16g ¥1,370/month | MySQL two-node: 2c4g ¥480/month, 4c16g ¥1,704/month |
| Logs | Workers Logs, **from 2026-12-01** $0.25/GB ingested + $0.10 per GB-month stored | SLS ¥0.4/GB (indexing and 30 days of storage included) | CLS billed by feature, about ¥0.83/GB |

</details>

<details>
<summary>AWS, Google Cloud, Azure, Oracle (US East, USD)</summary>

| | AWS | Google Cloud | Azure | Oracle |
|---|---|---|---|---|
| Egress | 100 GB free per month; $0.09/GB up to 10 TB, $0.085 for 10–50 TB (Singapore first tier $0.12) | Premium Tier to North America: $0.12/GiB up to 1 TiB, $0.11 up to 10 TiB, $0.08 beyond (Singapore to Asia first tier $0.12) | 100 GB free per month; $0.087/GB up to 10 TB, $0.083 for 10–50 TB (Singapore first tier $0.12) | **First 10 TB free per month**, then $0.0085/GB (Singapore $0.025) |
| 4 vCPU 8 GiB machine (monthly) | c8i.xlarge $134.94 | c4-highcpu-4 $122.47 | F4als_v7 $174.24 | E6.Flex 2 OCPU $54.72 |
| Load balancer | ALB $16.20/month + LCU (about $0.008/GB processed) | Forwarding rule $18/month + $0.008/GiB | Application Gateway v2 $0.20/hour + $0.008 per capacity unit | Flexible LB $9–41/month, no charge for data handled |
| ~1 GB high-availability Redis (monthly) | Valkey primary-replica $36.86 | Memorystore Standard $46.08 | Azure Managed Redis B1 $46.08 | OCI Cache $55.87 |
| ~2-vCPU high-availability MySQL (monthly) | RDS Multi-AZ $115.88 | Cloud SQL HA $192.80 | Flexible Server zone-redundant HA (smallest: 2 vCore 8 GiB) $272.84 | HeatWave HA $170.11 |
| Logs | CloudWatch Logs ingestion $0.50/GB | Cloud Logging $0.50/GiB, 50 GiB free per project per month | Basic Logs $0.50/GB | Ingestion free, storage $0.05 per GB-month |

</details>

### The full monthly bills

<details>
<summary>Self-hosted gateways and Cloudflare (Hong Kong and Singapore included)</summary>

Machines on the Chinese clouds: 2 × 2 vCPU/4 GB at 10M, 2 × 4 vCPU/8 GB at 100M, 4 × 8 vCPU/16 GB at 1B, across two zones, not load-tested; database and Redis sizes grow with volume. CNY at list prices:

| Option | 10M | 100M | 1B |
|---|---|---|---|
| Cloudflare, plain design (Workers + KV + Durable Objects + Queues + D1) | 140 | 2,756 | 32,574 |
| Cloudflare, optimized design (usage summed inside the Durable Object, no Queues) | 67 | 2,115 | 25,139 |
| Alibaba Cloud · Shenzhen | 1,625 | 5,854 | 45,696 |
| Alibaba Cloud · Hong Kong (reference for an offshore node) | 1,981 | 6,114 | 40,426 |
| Tencent Cloud · Guangzhou | 1,422 | 5,359 | 45,179 |
| AWS · US East / Singapore | 2,467 / 3,227 | 6,646 / 8,572 | 47,179 / 53,327 |
| Google Cloud · US East / Singapore | 3,056 / 4,031 | 7,387 / 8,583 | 43,798 / 48,564 |
| Azure · US East / Singapore | 4,794 / 6,215 | 9,125 / 11,934 | 49,848 / 57,957 |
| Oracle · US East / Singapore | 1,973 / 1,973 | 2,388 / 2,388 | 8,832 / 13,237 |

Divide by 6.7153 for USD: Cloudflare at 1B is about $4,851, AWS US East about $7,026, Oracle US East about $1,315.

</details>

<details>
<summary>Managed gateways and serverless (also including Redis, database, logs and egress)</summary>

| Option | 10M | 100M | 1B |
|---|---|---|---|
| Alibaba Cloud AI Gateway (managed) | 5,428 | 10,195 | 60,518 |
| Alibaba Cloud Function Compute (100 concurrent requests per instance) | 1,419 | 7,703 | 68,877 |
| Tencent Cloud SCF (default single concurrency / multi-concurrency on*) | 3,756 / 1,296 | 32,543 / 7,947 | 321,865 / 75,903 |
| AWS Lambda (128 MB Arm, US East, platform logs included) | 4,142 | 28,874 | 278,460 |
| Google Cloud Run (80 / 250 concurrent requests per instance, US East, automatic request logs excluded**) | 2,672 / 2,405 | 12,556 / 7,752 | 107,676 / 59,634 |
| Azure Container Apps (100 streams per replica, US East) | 2,916 | 9,596 | 79,376 |
| OCI Functions (Oracle, US East) | 4,071 | 27,445 | 264,894 |

\* Tencent Cloud's SSE docs say one instance handles one SSE connection at a time, while its multi-concurrency docs list long-lived connections as the main use case with WebSocket as the only example; the multi-concurrency figures assume 100 concurrent requests per instance at 70% fill and were not tested. \*\* Cloud Run writes request logs automatically, billed at $0.50/GiB, and an exclusion filter can turn them off; at 1 KB each they add about ¥3,100 at 1B for either concurrency.

</details>

<details>
<summary>The bill for one request, and the largest items at each volume</summary>

Marginal cost per million requests at the overage prices of 1 billion requests a month:

| Cloudflare per million requests | USD | Alibaba Cloud Shenzhen per million requests | CNY |
|---|---|---|---|
| Workers requests | 0.30 | Egress, 50 GB × ¥0.75 | 37.5 |
| Workers CPU (10 ms) | 0.20 | ALB capacity units (50 GB processed) | 2.45 |
| 1 KV read | 0.50 | SLS logs, 1 GB | 0.40 |
| 2 DO requests | 0.30 | Machines + Redis + RDS spread per million requests | about 4.8 |
| **2 DO rows written** | **2.00** | | |
| 3 Queues operations | 1.20 | | |
| 1 KB of logs | about 0.27 | | |
| **Total** | **about 4.8 (≈ ¥32)** | **Total** | **about ¥45** |

Spreading the 1B bill over every request for the Western clouds: AWS US East about ¥0.000047, Oracle US East about ¥0.000009.

| | 10M | 100M | 1B |
|---|---|---|---|
| Cloudflare | Queues 55%, Workers subscription 24% | DO row writes 37%, Queues 29%, KV reads 11% | DO row writes 40%, Queues 25%, KV reads 10% |
| Alibaba Cloud self-hosted · Shenzhen | RDS 41%, ECS 25%, egress 24% | **Egress 68%**, ECS 13% | **Egress 83%**, ECS 7%, ALB 5% |
| Tencent Cloud self-hosted · Guangzhou | MySQL 34%, egress 28%, CVM 22% | **Egress 75%** | **Egress 89%** |
| AWS self-hosted · US East | EC2 37%, RDS 32%, egress 10% | **Egress 45%**, EC2 27%, RDS 12% | **Egress 61%**, EC2 15%, RDS 7%, logs 7% |
| Oracle self-hosted · US East | MySQL 58%, Redis 19%, machines 19% | MySQL 48%, machines 31% | Machines 33%, **egress 26%**, MySQL 25% |

</details>

<details>
<summary>Egress per request: Alibaba Cloud Shenzhen in detail, and every provider's break-even point</summary>

| Egress per request | 10M | 100M | 1B | For comparison: Cloudflare at 1B (plain / optimized) |
|---|---|---|---|---|
| 5 KB (short Q&A) | ¥1,243 | ¥2,033 | **¥9,478** | ¥32,574 / ¥25,139 |
| 20 KB | ¥1,371 | ¥3,307 | ¥21,726 | Same |
| 50 KB (this article's assumption) | ¥1,625 | ¥5,854 | ¥45,696 | Same |
| 200 KB (agents with long context) | ¥2,899 | ¥18,102 | ¥155,788 | Same |
| 500 KB (common for coding agents) | ¥5,446 | ¥42,072 | **¥365,488** | Same |

Break-even with Cloudflare (egress per request, against the optimized to the plain design):

- **1B**: Shenzhen about 24–34 KB, Hong Kong about 24–37 KB; AWS US East 15–27 KB, Google Cloud US East 16–30 KB, Azure US East 10–22 KB; Singapore egress costs more, so its break-even points are lower. Oracle US East 336–466 KB: from 5 KB to 500 KB its bill only moves from ¥6,562 to ¥34,518, while AWS US East moves from ¥18,896 to ¥236,506 over the same range.
- **100M**: Shenzhen about 6–14 KB.
- **10M**: the clouds' fixed floor already costs more than Cloudflare's whole bill, so there is no break-even point.

CPU time: from 5 ms to 20 ms, Cloudflare at 1B moves from ¥31,902 to ¥33,917. With logs at the official average of 4.84 KB per entry, Cloudflare at 1B costs ¥39,622 for the plain design and ¥32,188 for the optimized one.

</details>

<details>
<summary>Raw latency data</summary>

| 2026-10-09 10:49 (Beijing time), China Telecom home broadband in Shenzhen, 20 ICMP round trips | Median | P90 |
|---|---|---|
| Alibaba Cloud Shenzhen (ECS API endpoint) | 7 ms | 19 ms |
| Alibaba Cloud Hong Kong | 13 ms | 16 ms |
| Tencent Cloud Guangzhou (CVM API endpoint) | 8 ms | 9 ms |
| Tencent Cloud Hong Kong | 13 ms | 20 ms |
| Cloudflare anycast address (this blog's Pages / Functions endpoint) | 162–164 ms | 166–186 ms |

Each provider's overseas regions, measured again on the same line at about 11:55 (20 ICMP round trips, average):

| Singapore | Average | US East | Average |
|---|---|---|---|
| Alibaba Cloud Singapore | 57 ms | Alibaba Cloud Virginia | 231 ms |
| Tencent Cloud Singapore | 89 ms | AWS us-east-1 (S3 endpoint) | 224 ms |
| AWS ap-southeast-1 (S3 endpoint) | 203 ms | Oracle us-ashburn-1 | 236 ms |
| Oracle ap-singapore-1 | 230 ms | | |

</details>

---

## Sources and check dates

All checked on 2026-10-09.

- Cloudflare pricing and limits:
  - [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
  - [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
  - [How KV works](https://developers.cloudflare.com/kv/concepts/how-kv-works/), [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
  - [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
  - [Observability pricing (from 2026-12-01)](https://developers.cloudflare.com/observability/pricing/)
  - [AI Gateway pricing](https://developers.cloudflare.com/ai-gateway/reference/pricing/), [AI Gateway limits](https://developers.cloudflare.com/ai-gateway/reference/limits/)
  - [China Network](https://developers.cloudflare.com/china-network/), [China Network available products](https://developers.cloudflare.com/china-network/reference/available-products/)
- Alibaba Cloud (prices from aliyun CLI pricing APIs, rules from the docs; pages in Chinese):
  - [CDT public egress](https://help.aliyun.com/zh/cdt/internet-data-transfers/), [Upgrade to CDT billing](https://help.aliyun.com/zh/cdt/user-guide/upgrade-to-cdt-billing)
  - [ALB billing rules](https://help.aliyun.com/zh/slb/application-load-balancer/product-overview/alb-billing-rules), [NAT Gateway billing](https://help.aliyun.com/zh/nat-gateway/nat-gateway-billing)
  - [Function Compute billing](https://help.aliyun.com/zh/functioncompute/fc/product-overview/billing-overview-of-fc), [Concurrency per instance](https://help.aliyun.com/zh/functioncompute/fc/configure-the-concurrency-of-a-single-instance)
  - [AI Gateway sizes and prices](https://help.aliyun.com/zh/api-gateway/ai-gateway/product-overview/free-product-templates)
  - [ESA Functions and Pages limits](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/what-is-functions-and-pages), [ESA function billing](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/functions-and-pages-billing)
  - [Model Studio over a private connection](https://help.aliyun.com/zh/model-studio/access-model-studio-through-privatelink), [PrivateLink billing](https://help.aliyun.com/zh/privatelink/private-link-billing-description), [AI Gateway Serverless billing](https://help.aliyun.com/zh/api-gateway/ai-gateway/product-overview/overview-of-billing-during-the-serverless-public-preview-of-the)
- Tencent Cloud (prices from tccli pricing APIs, rules from the docs; pages in Chinese):
  - [Public egress prices](https://cloud.tencent.com/document/product/213/113026), [CLB LCU billing](https://cloud.tencent.com/document/product/214/58387)
  - [SCF billing](https://cloud.tencent.com/document/product/583/12281), [SCF SSE](https://cloud.tencent.com/document/product/583/90617), [Web function multi-concurrency](https://cloud.tencent.com/document/product/583/123888)
  - [EdgeOne plans](https://cloud.tencent.com/document/product/1552/94158), [EdgeOne overage prices](https://cloud.tencent.com/document/product/1552/94159), [Edge function limits](https://cloud.tencent.com/document/product/1552/81344)
- Cases and outages:
  - Cloudflare post-mortems: [2025-06-12](https://blog.cloudflare.com/cloudflare-service-outage-june-12-2025/), [2025-11-18](https://blog.cloudflare.com/18-november-2025-outage/)
  - [Alibaba Cloud Hong Kong Zone C outage notice (2022-12)](https://www.alibabacloud.com/zh/notice/resolved_service_outage_in_zone_c_of_the_china_hong_kong_region_1ae)
  - [Higress](https://github.com/higress-group/higress), [Alibaba Cloud AI Gateway product page](https://www.aliyun.com/product/apigateway)
  - [GreatFire: workers.dev](https://en.greatfire.org/domain/workers.dev) (third-party monitoring), [Cloudflare community: workers.dev blocked in China](https://community.cloudflare.com/t/cloudflare-workers-suspected-of-being-blocked-in-china/382155)
  - [Cloudflare terms update (2023)](https://blog.cloudflare.com/updated-tos/), [Cloudflare log datasets (average entry size)](https://developers.cloudflare.com/observability/logs/datasets/)
- The four Western clouds (prices from public pricing APIs or official pricing pages, rules from the docs):
  - AWS: [EC2 on-demand pricing (including data transfer)](https://aws.amazon.com/ec2/pricing/on-demand/), [Lambda pricing](https://aws.amazon.com/lambda/pricing/), [Lambda response streaming](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html), [ALB idle timeout](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-load-balancer-attributes.html), [AgentCore Gateway inference targets](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-targets-inference.html)
  - Google Cloud: [Network pricing](https://cloud.google.com/vpc/network-pricing), [Cloud Run pricing](https://cloud.google.com/run/pricing), [Load balancer timeouts](https://cloud.google.com/load-balancing/docs/https/request-distribution#timeouts_and_retries), [Apigee pricing](https://cloud.google.com/apigee/pricing)
  - Azure: [Bandwidth pricing](https://azure.microsoft.com/en-us/pricing/details/bandwidth/), [Application Gateway and SSE](https://learn.microsoft.com/en-us/azure/application-gateway/use-server-sent-events), [Application Gateway 502 troubleshooting (timeout retries)](https://learn.microsoft.com/en-us/troubleshoot/azure/application-gateway/application-gateway-troubleshooting-502), [API Management AI gateway capabilities](https://learn.microsoft.com/en-us/azure/api-management/genai-gateway-capabilities), [API Management limits (concurrent backend connections)](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits#api-management-limits), [Front Door, WebSocket and SSE](https://learn.microsoft.com/en-us/azure/frontdoor/standard-premium/websocket)
  - Oracle: [Price list (networking)](https://www.oracle.com/cloud/price-list/#pricing-networking), [VCN pricing](https://www.oracle.com/cloud/networking/virtual-cloud-network/pricing/), [Press release on 10 TB per regional zone (2021-11-10)](https://www.oracle.com/news/announcement/oracle-joins-cloudflare-bandwidth-alliance-2021-11-10/)
- Model prices: [DeepSeek pricing](https://api-docs.deepseek.com/zh-cn/quick_start/pricing), [Qwen qwen-flash](https://help.aliyun.com/zh/model-studio/qwen-flash)
- Tool versions: aliyun CLI 3.5.1, tccli 3.1.180.1, wrangler 4.148.0 (latest on npm: 4.149.0); no CLI was used for the four Western clouds, only the public pricing APIs above.
