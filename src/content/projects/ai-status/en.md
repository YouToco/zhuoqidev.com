---
title: AI vendor status — every official status page on one page
description: What the official status pages of OpenAI, Claude, Gemini, xAI, Mistral, Groq, Amazon Bedrock, DeepSeek, Kimi, MiniMax and others say right now, set as a newspaper front page — the worst one makes the headline, every vendor gets a weather, open one for components and incidents in progress; vendors without a status page are listed too, with the reason. A Cloudflare Pages Function reads each vendor at most once a minute and never calls a model.
date: 2026-10-27
glyph: status-board
---

When an API suddenly starts failing, the first question is "is it me or the vendor?" Every vendor has a status page, but you open them one by one; among Chinese vendors some have one and some don't, and no two look alike. This page puts them together as a front page reprinted every minute: the headline is the worst vendor right now, the lead story says what each one reports, the weather box gives every vendor a weather (sunny, cloudy, showers, thunder, storm), and the classifieds list them all.

[🚦 Open AI vendor status](/en/status/)

## What it reads

Only what the vendors publish themselves; it doesn't measure them:

| Vendor | Where the data comes from |
| --- | --- |
| OpenAI, Claude, Mistral, Cohere, Groq, Fireworks, Cerebras, Perplexity, Kimi, MiniMax | The status page's standard API (`/api/v2/summary.json`) |
| xAI | The status page's RSS, keeping api.x.ai items only (the same page posts Cursor and Grok app incidents) |
| Amazon Bedrock | AWS Health Dashboard RSS for 6 regions |
| Azure OpenAI | Azure's status RSS, keeping items that mention Azure OpenAI / AI Foundry |
| DeepSeek | Its status page has no API, so components and open events are read from the data the page carries, falling back to its RSS |
| Gemini (Vertex AI) | Google Cloud's incident list, keeping the Vertex Gemini API entries |
| Google AI Studio / Gemini API | Its status page only renders in a browser (the data comes from an internal Google API), so it is a link only |
| Zhipu, Alibaba Model Studio, Volcengine Ark | No public status page for their models, so a link to their notices only |

Each vendor's weather is the worst level among its components and open incidents: operational is sunny, maintenance cloudy, degraded showers, partial outage thunder, major outage storm. A vendor that can't be read is "Fog · Couldn't read", never sunny by default.

## How it runs

The page is static: the vendor list and links are in the HTML, so it works without JavaScript. Once open, the browser asks `api.zhuoqidev.com/api/ai-status`, a Cloudflare Pages Function that reads every vendor at once, turns the answers into one shape and keeps the result in Cloudflare's cache for a minute. However many people are looking, each data centre reads each vendor at most once a minute; readers on the mainland line use the same endpoint instead of reaching overseas status pages themselves.

## Limits

- Status pages only list incidents the vendor admits to, usually 10–30 minutes after users notice.
- They don't cover problems in one region, one account or one relay line: sunny doesn't promise your request will succeed.
- Incident text is the vendor's own words, untranslated.
