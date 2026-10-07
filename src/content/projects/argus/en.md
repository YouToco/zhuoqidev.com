---
title: Argus — A Browser-Local Long-Video Understanding Agent Harness
description: 'An open-source, frontend-only agent harness for long-video understanding: video never leaves the browser, multi-provider LLMs via Vercel AI SDK, with frame-extraction / memory / sub-agent tools and dual-CDN publishing. Vite + React + TypeScript.'
date: 2026-08-30
---

**Argus** (named after Argus Panoptes, the hundred-eyed giant of Greek myth) is an open-source, long-video understanding agent harness I designed and built solo — **frontend-only, no backend**. Videos are decoded entirely in the browser, and users bring their own API keys and models. A multimodal LLM agent calls tools to "watch" the video itself: extracting frames, zooming into regions, taking notes, and spawning sub-agents. Typical scenarios: counting people in surveillance footage, or finding a specific object.

[🔗 Live Demo](https://argus.zhuoqidev.com)
[🐙 GitHub](https://github.com/YouToco/argus)

## The Problem

The hard part of long-video understanding isn't the model — it's **how you feed it the video**. Uploading everything is prohibitively expensive; blind frame sampling misses the signal. Argus hands that decision to the agent: it inspects video metadata first, then decides which frames to extract, at what rate, and where to zoom in — and when the context is about to explode, it spawns sub-agents to handle segments. Meanwhile the video never leaves the browser: no server, no uploads.

## Architecture Highlights

- **Hand-built Agent Loop** — a manual tool loop on top of Vercel AI SDK `streamText`: tool calls are executed by the harness itself, and extracted frames are injected back as `ImagePart`s until the agent reaches a conclusion.
- **8 Video-Understanding Tools** — `get_video_info` / `extract_frames` (range + rate sampling with timestamps) / `extract_frame_at` / `list_frames` / `inspect_region` (zoom into a region) / `remember` / `recall` (state memory against long-context drift) / `spawn_subagent` (segment very long videos, preventing context blow-up).
- **Browser-Native Hardware-Decoded Frame Extraction** — plain `<video>` + `<canvas>` with seeked + rAF (plus black-frame retries); mediainfo.js (lazy-loaded wasm) is used only for rich metadata like fps/codec/bitrate. Local loading performance first.
- **211 Providers via a Runtime Catalog** — integrates the models.dev catalog, normalized into provider presets with a searchable dropdown; vision models are auto-flagged and selected by default; OpenAI-compatible / Anthropic / Gemini transports are detected automatically, with CORS hints and a connection test.
- **Sub-Agent Context Isolation** — a sub-agent is a nested agent run without the `spawn_subagent` tool, so the intermediate work of segment-level understanding never pollutes the main context.

## Tech Stack

**Frontend** · Vite 8 + React 19 + TypeScript 7 (native tsc) + Tailwind 4 + zustand

**LLM Access** · Vercel AI SDK (`ai` + `@ai-sdk/openai` / `@ai-sdk/anthropic` / `@ai-sdk/google`, all with custom baseURL support) · models.dev provider catalog

**Infra** · GitHub Actions CI/CD · dual-track publishing (Alibaba Cloud CDN + OSS for China, Cloudflare Pages overseas) · Let's Encrypt DNS-01 certificate auto-renewal

## Engineering Practices

- **Zero Backend** — a pure static site; the build artifact is 7 files published to both tracks. User API keys live only in the browser.
- **Same-Artifact Dual Publishing** — China (Alibaba CDN → OSS) and overseas (Cloudflare Pages) are served from a single `dist/` build, with DNS split-horizon routing guaranteeing identical content on both tracks.
- **Certificate Automation** — a weekly job checks the China CDN certificate and renews via DNS-01 when under 30 days remain, with edge verification.

## My Role

**Solo build**: product design · agent harness architecture · frontend implementation · multi-provider integration · CI/CD dual-track deployment — from zero to open-source release, end to end.

---

*Open-source project — see [GitHub](https://github.com/YouToco/argus).*
