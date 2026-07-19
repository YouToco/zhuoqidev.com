---
title: "Building a Personal Site with Hugo and Dual-Stack CDN"
description: "How I set up Hugo + Blowfish with Alibaba Cloud OSS/CDN for China and Cloudflare Pages for international visitors — ICP filing, geo-DNS routing, and GitHub Actions dual-stack deployment."
date: 2026-05-04
aliases: ["/en/posts/hello-world/"]
tags: ["Hugo", "Alibaba Cloud", "Cloudflare", "CDN", "ICP Filing"]
categories: ["Tinkering"]
showToc: true
ShowReadingTime: true
---

## Why Hugo

When picking a framework for a personal blog, my top criterion was **low maintenance cost** — I didn't want to abandon writing three months later because of npm dependency hell.

Hugo is a single binary, requires no Node.js, builds thousands of posts in 1-2 seconds, and the Blowfish theme comes with dark mode, full-text search, multilingual support, RSS, Open Graph, and reading time estimates out of the box. Day-to-day writing only requires touching Markdown files.

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

Annual cost: approximately ¥212 (~$30 USD):
- Domain `zhuoqidev.com`: ¥85/yr (bought 3 years)
- Function Compute resource pack (ICP filing): ¥101/yr (¥126 annual pack with 20% ongoing discount)
- Alibaba CDN 100GB traffic pack: ¥20/yr
- OSS storage: ~¥6/yr
- Cloudflare Pages: ¥0

## ICP Filing Without a Server

Websites served to mainland China visitors need an ICP filing, which requires a "filing carrier" (a server IP). Instead of buying a full server, Alibaba Cloud's **Function Compute resource pack** (¥101/yr) works as a filing carrier and provides a filing service code.

Timeline: Alibaba Cloud initial review 1-5 working days + MIIT review 10-20 business days, about 3-6 weeks total. Plenty of time to finish the site while waiting.

## Geo-DNS Routing

Alibaba Cloud DNS free tier supports "domestic / international" split routing:
- Domestic → Alibaba CDN CNAME
- International (default) → Cloudflare Pages CNAME

Domestic visitors get the ICP-compliant Alibaba CDN; international visitors get Cloudflare's free global CDN — one domain, two acceleration paths.

## Deployment

Push to GitHub → Actions runs `hugo build` → uploads in parallel to OSS and Cloudflare Pages. The whole process takes 2-3 minutes. Publishing a post is nearly instant.

---

Upcoming posts will dive into Agent architecture design, memory layer selection, and multi-agent orchestration.
