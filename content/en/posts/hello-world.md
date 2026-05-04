---
title: "Building a Personal Site with Hugo and Dual-Stack CDN"
description: "How I set up Hugo + PaperMod with Alibaba Cloud OSS/CDN for China and Cloudflare Pages for international visitors — ICP filing, geo-DNS routing, and GitHub Actions all in one go."
date: 2026-05-04
tags: ["Hugo", "Alibaba Cloud", "Cloudflare", "CDN", "ICP Filing"]
categories: ["Dev Log"]
showToc: true
ShowReadingTime: true
---

## Why Hugo

When picking a framework for a personal blog, my top criterion was **low maintenance cost** — I didn't want to abandon writing three months later because of npm dependency hell.

Hugo is a single binary, requires no Node.js, builds thousands of posts in 1-2 seconds, and the PaperMod theme comes with dark mode, full-text search, RSS, Open Graph, and reading time estimates out of the box. Day-to-day writing only requires touching Markdown files.

## Architecture

```
                  ┌─────────────────────────────┐
                  │    DNS Geo-Based Routing      │
                  │  (Alibaba Cloud DNS GeoDB)    │
                  └──────┬──────────────┬────────┘
                         │              │
             CN visitors ▼  Intl. visitors ▼
          ┌──────────────────┐  ┌─────────────────┐
          │  Alibaba CDN     │  │ Cloudflare Pages │
          │  ↓               │  │  (Free, Global)  │
          │  Alibaba OSS     │  └─────────────────┘
          │  (Static Hosting)│
          └──────────────────┘
                  ↑
        GitHub Actions auto-build & dual-stack push
```

Annual cost: approximately ¥206 (~$29 USD):
- Domain `zhuoqidev.com`: ¥85/yr (bought 3 years)
- Function Compute resource pack (ICP filing): ¥101/yr
- Alibaba CDN 100GB traffic pack: ¥14/yr
- OSS storage: ~¥6/yr
- Cloudflare Pages: ¥0

## ICP Filing Without a Server

Websites served to mainland China visitors need an ICP filing, which requires a "filing carrier" (a server IP). Instead of buying a full server, Alibaba Cloud's **Function Compute resource pack** (¥101/yr) works as a filing carrier and provides a filing service code.

Timeline: Alibaba Cloud initial review ~1 day + MIIT review 5-20 business days. Plenty of time to finish the site while waiting.

## Geo-DNS Routing

Alibaba Cloud DNS free tier supports "domestic / international" split routing:
- Domestic → Alibaba CDN CNAME
- International (default) → Cloudflare Pages CNAME

Domestic visitors get the ICP-compliant Alibaba CDN; international visitors get Cloudflare's free global CDN — one domain, two acceleration paths.

## Deployment

Push to GitHub → Actions runs `hugo build` → uploads in parallel to OSS and Cloudflare Pages. The whole process takes 2-3 minutes. Publishing a post is nearly instant.

---

More posts on AI Agent development coming soon. If you need an AI Agent integration developer, reach out: [hello@zhuoqidev.com](mailto:hello@zhuoqidev.com)
