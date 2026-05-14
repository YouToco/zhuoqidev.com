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
| `THINKTECHNOLOGIESUS` | May 9, ~1 AM | **X (Twitter) + linux.do simultaneously** |
| `codestonegb` | May 9 | X + linux.do, same timeframe |
| `firstfocus` | May 10 | **OzBargain** (Australian deals forum) |
| `thealloynetwork` | May 10 | linux.do deals section |
| `datroaiuk` | May 12 | shuzijumin.com (Chinese expat forum) |
| `geccogb` | May 10 | **OzBargain** |

**May 9 around 1 AM Beijing time is the critical inflection point.** One Chinese tutorial author recorded this: "At 1 AM on May 9, I saw the ChatGPT Team 48-month buy-one-get-one-free deal on both X and L站 simultaneously." That means two communities, completely independent, caught the leak at roughly the same time.

Key takeaway:
- **linux.do** is the Chinese-language aggregation hub, but not the exclusive first post
- **X (Twitter)** — Japanese and English-speaking bloggers were posting simultaneously
- **OzBargain** — the primary source for Australian and some UK codes
- **shuzijumin.com** — occasionally surfaces niche codes nobody else has

---

## The Full Propagation Map

```
                Stripe Enterprise Partners
                (where codes are born)
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                 ▼
   Employee leaks    X (Twitter)      OzBargain
   (TG/Discord)      JP/EN bloggers   AU deal forum
        │                │                 │
        └────────────────┼─────────────────┘
                         │
                         ▼
                    linux.do
            Chinese aggregation hub
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                 ▼
  80aj.com/Toy        V2EX           Personal blogs
  (early re-poster)   (mass spread)   (xwuxl.com, etc.)
        │                │                 │
        └────────────────┼─────────────────┘
                         ▼
              Bilibili / Zhihu / WeChat
              (long-tail distribution)
```

**The pattern isn't linear—it's parallel multi-source leakage.**

---

## Why linux.do Gets the Credit

1. **Superior curation.** L站 users compile scattered leaks into comprehensive posts with Console scripts and payment guides, all in one place
2. **Clear attribution.** Re-posters like 80aj.com explicitly credit "linux.do community leaks," reinforcing the perception
3. **Traceable timestamps.** Forum thread creation times are precise and permanent. X posts are ephemeral and hard to search
4. **Community path dependency.** Chinese users default to L站 as their information hub, creating a self-reinforcing loop

But the data shows otherwise: Australian codes broke on OzBargain first. Some UK codes first appeared on expat forums. US codes hit X and L站 simultaneously.

---

## Where to Actually Monitor for Early Signals

From fastest to most comprehensive:

| Priority | Platform | Niche | Notes |
|----------|----------|------|-------|
| **P0** | **X (Twitter)** | JP/EN/US new codes | Search `ChatGPT promo code`, near real-time with leaks |
| **P0** | **linux.do** deals section | Global compilation + scripts | Most complete, 1-3 hours behind the fastest |
| **P0** | **OzBargain** | AU/UK codes | `ozbargain.com.au`, search ChatGPT |
| **P1** | **shuzijumin.com** | Occasional niche codes | Chinese expat forum |
| **P2** | **V2EX** | Chinese diffusion | Half to full day behind |
| **P3** | Tech blogs | Tutorial consolidation | Best guides, worst timeliness |

**Rule of thumb: monitor at least 3 platforms. There is no single source of truth.**

---

## The Higher-Order Pattern

What's really happening here:

**OpenAI uses Stripe's Partner Network to subsidize enterprise channel distribution, indirectly acquiring B2B customers through partner organizations.** These aren't consumer promotions—they're a byproduct of enterprise sales motions. Every code represents real partner spend, which means they **can be revoked at any time**, with no announcement and no warning.

Understanding this pattern changes how you play the game. These aren't permanent discounts to milk indefinitely. They're **precision targets: spot early, move fast, expect them to die without notice.**

*This investigation was driven by Claude Code multi-source cross-referencing. Information current as of 2026-05-14.*
