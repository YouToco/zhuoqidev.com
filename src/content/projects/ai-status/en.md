---
title: AI vendor status — every official status page on one page
description: What the official status pages of OpenAI, Claude, Gemini, Mistral, Cohere, DeepSeek, Kimi, MiniMax and others say right now, on one page — one light per vendor, open it for components and incidents in progress; vendors without a status page are listed too, with the reason. A Cloudflare Pages Function reads each vendor at most once a minute and never calls a model.
date: 2026-10-27
glyph: status-board
---

When an API suddenly starts failing, the first question is "is it me or the vendor?" Every vendor has a status page, but you open them one by one; among Chinese vendors some have one and some don't, and no two look alike. This page puts them together.

[🚦 Open AI vendor status](/en/status/)

## What it reads

Only what the vendors publish themselves; it doesn't measure them:

| Vendor | Where the data comes from |
| --- | --- |
| OpenAI, Claude, Mistral, Cohere, Kimi, MiniMax | The status page's standard API (`/api/v2/summary.json`) |
| DeepSeek | Its status page has no API, so components and open events are read from the data the page carries |
| Gemini | Google Cloud's incident list, keeping entries that touch Gemini (Vertex AI) |
| xAI | Its status page refuses automated reads, so it is a link only |
| Zhipu, Alibaba Model Studio, Volcengine Ark | No public status page for their models, so a link to their notices only |

Each vendor's light is the worst level among its components and open incidents: operational, maintenance, degraded, partial outage, major outage. A vendor that can't be read shows "Couldn't read", never a green light by default.

## How it runs

The page is static: the vendor list and links are in the HTML, so it works without JavaScript. Once open, the browser asks `api.zhuoqidev.com/api/ai-status`, a Cloudflare Pages Function that reads every vendor at once, turns the answers into one shape and keeps the result in Cloudflare's cache for a minute. However many people are looking, each data centre reads each vendor at most once a minute; readers on the mainland line use the same endpoint instead of reaching overseas status pages themselves.

## Limits

- Status pages only list incidents the vendor admits to, usually 10–30 minutes after users notice.
- They don't cover problems in one region, one account or one relay line: a green light doesn't promise your request will succeed.
- Incident text is the vendor's own words, untranslated.
