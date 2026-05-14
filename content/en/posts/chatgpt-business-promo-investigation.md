---
title: "Where Do ChatGPT Business Promo Codes Actually Come From? An OSINT Trace"
description: "Tracing promo codes like codestonegb and thealloynetwork from Stripe partner leaks to Chinese tech communities, revealing OpenAI's invisible promotional infrastructure."
date: 2026-05-14
tags: ["ChatGPT", "OpenAI", "Stripe", "Promo Codes", "OSINT", "Reverse Engineering"]
categories: ["Investigation"]
showToc: true
---

In May 2026, the Chinese AI community went wild over a wave of ChatGPT Business discounts: £11/month for 2 seats in the UK, $20 in the US, AU$25 in Australia, locked in for 48 months. Mysterious codes like `codestonegb`, `thealloynetwork`, and `firstfocus` spread across forums and blogs at breakneck speed.

One question nobody was asking: **where did these codes actually come from?**

I spent several days cross-referencing sources across five platforms and three languages. The answer is messier—and more interesting—than "they leaked on linux.do."

---

## OpenAI Doesn't Publish Promo Codes Publicly

Let's establish the baseline: **OpenAI has never publicly posted these promo codes anywhere.**

I checked every official OpenAI information outlet:
- `openai.com/index/` (blog) — product launches only, zero promo codes
- `help.openai.com` (help center) — generic FAQ about how promotions work, **never lists specific codes**
- `openai.com/pricing` — standard pricing, no promotional entry points
- `@OpenAI` on X — radio silence

OpenAI's own documentation states: promotions are distributed via **targeted emails to eligible users** or surfaced **in-product**. Eligibility is determined by OpenAI per campaign. Not everyone sees them.

So how did these codes get out?

---

## The Real Source: Stripe's Partner Network

OpenAI has used **Stripe Billing + Stripe Checkout** for ChatGPT payments since 2023. That infrastructure supports promo codes passed via the `?promoCode=XXX` URL parameter. Stripe enables partner-specific codes for enterprise channel distribution.

Every code maps to a real company:

| Code | Region | Partner Company |
|------|--------|----------------|
| `codestonegb` | UK | CodeStone (IT services) |
| `thealloynetwork` | US | The Alloy Network |
| `firstfocus` | AU | First Focus IT |
| `THINKTECHNOLOGIESUS` | US | Think Technologies |
| `monicaius` | US | Monica AI |
| `datroaiuk` | UK | Datro AI |
| `geccogb` | UK | GECC |

These are enterprise promo codes, distributed by Stripe to partner organizations for internal use. Then some employee, somewhere, pastes the link into a public forum. That's the ignition event. Everything downstream is just a remix.

**The true origin is the Stripe enterprise partner network—not any single online community.**

---

## Where Each Code Actually Surfaced First

Timestamps from cross-platform tracing tell a clear story: **there is no single point of origin.**

| Code | Earliest Appearance | First Platform |
|------|-------------------|----------------|
| `alongsideus` / `monicaius` | May 1 | mailberry.com.cn (personal blog) |
| `THINKTECHNOLOGIESUS` | May 8 | **linux.do** (topic/2092962, now inaccessible) |
| `codestonegb` | May 9 | X + linux.do, same timeframe |
| `firstfocus` | May 10 | **OzBargain** (Australian deals forum) |
| `thealloynetwork` | May 10 | linux.do deals section |
| `datroaiuk` | May 12 | shuzijumin.com (Chinese expat forum) |
| `geccogb` | May 10 | **OzBargain** |

**May 8 is the true first-appearance date.** By directly accessing linux.do via browser for cross-referencing, the earliest post documenting `THINKTECHNOLOGIESUS` is topic/2092962, titled "[5/8 US新优惠,20刀！！！] ChatGPT Team/Business 买一送一持续48个月！", posted in the welfare section. This topic is now inaccessible (deleted or set to private), but in topic/2141860 (posted May 9 by leon8), user cyfer's reply at post #16 preserves the original quote. **May 9 around 1 AM Beijing time was the mass-diffusion ignition point** — one Chinese tutorial author recorded seeing it "on both X and L站 simultaneously," indicating X (Twitter) reposts and L站 secondary threads broke at roughly the same time.

Key takeaway:
- **linux.do** is the Chinese-language aggregation hub, and **is confirmed as the earliest public source of THINKTECHNOLOGIESUS** (May 8, ahead of X)
- **X (Twitter)** — Japanese and English-speaking bloggers amplified the leak on May 9, roughly synchronized with L站 secondary threads
- **OzBargain** — the primary source for Australian and some UK codes
- **shuzijumin.com** — occasionally surfaces niche codes nobody else has

---

## Timeline: The Leak Cadence

{{< mermaid >}}
gantt
    title       ChatGPT Business Promo Code Leak Timeline
    dateFormat  YYYY-MM-DD
    axisFormat  %m-%d
    tickInterval 2day

    section Prelude
    Team free trial interface shut down :done,   crit,   a1, 2026-04-28, 1d
    80aj re-posts 2-month free edition   :done,           a2, 2026-04-30, 1d

    section First Wave
    alongsideus / monicaius             :active,         b1, 2026-05-01, 1d
    (first on mailberry blog)           :                 b1a, 2026-05-01, 1d

    section Breakout
    THINKTECHNOLOGIESUS(L站 first)      :done,   crit,   c0, 2026-05-08, 1d
    codestonegb (X + L站 simultaneous)  :done,   crit,   c2, 2026-05-09, 1d
    X + L站 mass diffusion              :done,   crit,   c1, 2026-05-09, 1d

    section Diffusion
    firstfocus (OzBargain first)        :done,           d1, 2026-05-10, 1d
    thealloynetwork (L站 first)         :done,           d2, 2026-05-10, 1d
    geccogb (OzBargain)                 :done,           d3, 2026-05-10, 1d
    xwuxl.com tutorial published        :done,           d4, 2026-05-10, 1d

    section Long Tail
    L站 price comparison post           :done,           e1, 2026-05-11, 1d
    V2EX mass distribution              :done,           e2, 2026-05-11, 1d
    datroaiuk (shuzijumin forum)        :done,           e3, 2026-05-12, 1d
{{< /mermaid >}}

**April 28: GPT Team free trial interface closed → April 30: Chinese community notices the US-IP 2-month free edition → May 1: First Stripe enterprise codes leak → May 8: THINKTECHNOLOGIESUS debuts on linux.do → May 9 ~1 AM: X+L站 mass diffusion ignites → May 10-12: Regional codes appear in rapid succession.**

---

## The Full Propagation Map

{{< mermaid >}}
flowchart TD
    A["🏢 Stripe Enterprise Partners<br/>（where codes are born）"]
    
    A --> B["💬 Employee Leaks<br/>TG / Discord DMs"]
    A --> C["🐦 X (Twitter)<br/>JP / EN bloggers"]
    A --> D["🦘 OzBargain<br/>AU deal forum"]
    
    B --> E["🐧 linux.do<br/>Chinese aggregation hub"]
    C --> E
    D --> E
    
    E --> F["📰 80aj.com / Toy<br/>early re-poster"]
    E --> G["🌐 V2EX<br/>mass spread"]
    E --> H["📝 Personal blogs<br/>xwuxl / mailberry"]
    
    F --> I["📱 Bilibili / Zhihu / WeChat<br/>long-tail distribution"]
    G --> I
    H --> I

    style A fill:#c44020,stroke:#a03018,color:#fff
    style E fill:#2563eb,stroke:#1d4ed8,color:#fff
    style I fill:#6b7280,stroke:#4b5563,color:#fff
{{< /mermaid >}}

**The pattern isn't linear—it's parallel multi-source leakage.**

---

## Actual Monthly Cost by Region

Same plan (2 seats, monthly billing), up to 40% price spread depending on region:

{{< chart >}}
type: 'bar',
data: {
  labels: ['UK codestonegb', 'UK datroaiuk', 'AU firstfocus', 'US thealloynetwork', 'US THINKTECHNOLOGIES'],
  datasets: [{
    label: 'Monthly cost (USD equivalent)',
    data: [14.5, 14.5, 16.8, 20, 20],
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
      title: { display: true, text: 'USD / month' }
    }
  }
}
{{< /chart >}}

| Region | Original (2 seats) | After Promo | USD Equivalent | Discount |
|--------|--------------------|-------------|----------------|----------|
| UK | £36 | **£11** | ~$14.5 | £25 off (69%) |
| AU | AU$70 | **AU$25** | ~$16.8 | AU$45 off (64%) |
| US | US$50 | **US$20** | ~$20 | $30 off (60%) |

> UK codes offer the lowest absolute price, roughly 28% cheaper than US codes. Requires UK IP + matching promo code.

---

## Why linux.do Gets the Credit

1. **Superior curation.** L站 users compile scattered leaks into comprehensive posts with Console scripts and payment guides, all in one place
2. **Clear attribution.** Re-posters like 80aj.com explicitly credit "linux.do community leaks," reinforcing the perception
3. **Traceable timestamps.** Forum thread creation times are precise and permanent. X posts are ephemeral and hard to search
4. **Community path dependency.** Chinese users default to L站 as their information hub, creating a self-reinforcing loop

But the data shows a more nuanced picture: **US code THINKTECHNOLOGIESUS is confirmed as a linux.do first post (May 8 topic/2092962), ahead of the X mass diffusion (May 9).** Australian codes broke on OzBargain first. Some UK codes first appeared on expat forums and X. There is no single source, but linux.do's first-mover status in this incident is stronger than previously understood.

---

## Where to Actually Monitor for Early Signals

From fastest to most comprehensive:

| Priority | Platform | Niche | Notes |
|----------|----------|------|-------|
| **P0** | **linux.do** welfare section | Global compilation + scripts | Confirmed first to post THINKTECHNOLOGIESUS (May 8). Requires login to access |
| **P0** | **X (Twitter)** | JP/EN/US new codes | Search `ChatGPT promo code`, near real-time with leaks, no login needed |
| **P0** | **L站 Telegram Channel** | Hot post push notifications | `t.me/linux_do_channel`, more immediate than browsing the forum |
| **P0** | **OzBargain** | AU/UK codes | `ozbargain.com.au`, search ChatGPT |
| **P1** | **shuzijumin.com** | Occasional niche codes | Chinese expat forum |
| **P1** | **TG / Discord private groups** | First stop for Stripe employee leaks | Uncontrollable, depends on your network |
| **P2** | **V2EX** | Chinese diffusion | Half to full day behind |
| **P3** | Tech blogs | Tutorial consolidation | Best guides, worst timeliness |

**Rule of thumb: monitor at least 3 platforms. There is no single source of truth.**

---

## When Did It Actually End

THINKTECHNOLOGIESUS had a brutally short lifespan: **first posted May 8, dead by May 9 — under 48 hours.** On the same day it went viral, a linux.do user posted "4年team活動剛開始但是好像剛結束了" (The 4-year team promo just started but looks like it's over). Whether you had a qualified account or a fresh one, the result was the same: "Unable to use this offer."

By May 14, people were still asking "Are the team promo codes gone?" — confirmed dead across the board. One user described it as **"a 4-hour flash event."** A bit of an exaggeration, but it reflects reality: every Stripe partner code has a **fixed redemption quota**. When it's gone, it's gone — no connection to any calendar date.

The regional codes followed the same pattern:
- **UK codes** (codestonegb / datroaiuk): Lasted a couple of days longer than the US code, then quota exhausted
- **AU codes** (firstfocus): Same story
- **Will there be more**: The community consensus is "definitely, same 48-month deals will come again." OpenAI's SMB partnership program is ongoing, and new partner codes can surface anytime.

The pattern is clear: **codes die by quota, not by date.** When you spot one, act immediately. "I'll bookmark it and come back later" doesn't work here.

---

## The Higher-Order Pattern

What's really happening here:

**OpenAI uses Stripe's Partner Network to subsidize enterprise channel distribution, indirectly acquiring B2B customers through partner organizations.** These aren't consumer promotions—they're a byproduct of enterprise sales motions. Every code represents real partner spend, which means they **can be revoked at any time**, with no announcement and no warning.

Understanding this pattern changes how you play the game. These aren't permanent discounts to milk indefinitely. They're **precision targets: spot early, move fast, expect them to die without notice.**

*Information current as of 2026-05-14, cross-referenced across multiple sources.*
