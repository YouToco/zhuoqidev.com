---
title: Vane — A Production-Grade AI Personalized Feed System
description: 'A self-built AI Agent system: multi-source ingestion → LLM personalized scoring → Feishu push, with a user-profile feedback loop. Go + Temporal + A2A protocol + React, full-stack.'
date: 2026-07-19
---

**Vane** is an AI-powered personalized feed system I designed and built solo. It continuously ingests content from multiple sources, scores and filters it with an LLM against your profile, then pushes what's worth reading via Feishu — learning from your feedback to keep refining that profile. From product design and system architecture to production ops, one person end to end.

[🔗 Live Demo](https://vane.zhuoqidev.com)
[🐙 GitHub](https://github.com/YouToco/vane)

## The Problem

In an age of information overload, RSS feeds, news sites, and web updates pile up faster than anyone can triage. Vane puts an AI Agent in charge of watching every source, surfacing only what's genuinely relevant, and getting better at it the more you use it — turning "doomscrolling" into "the signal finds you."

## Architecture Highlights

- **Full Agent Runtime** — a hand-built agent loop + tool calling (add/remove sources, adjust profile, enable/disable sources), with Feishu confirmation cards for human-in-the-loop interaction; action results are written back to the session to prevent the model from hallucinating the state of already-handled actions.
- **A2A Protocol** — built on a2a-go for Agent-to-Agent interoperability, exposing agent capabilities as standardized, callable services.
- **Profile + Feedback Loop** — the user profile drives personalized scoring; feedback recalibrates the profile in real time, forming a self-improving "push → feedback → profile evolution" loop.
- **Temporal Workflow Orchestration** — daily push scheduling and the ingestion pipeline run on Temporal for reliability, replayability, and idempotency; long-running flows survive interruption.
- **Multi-Source Ingestion & Dedup** — unifies RSS and web content, with a canonical_key content-identity system for cross-source deduplication so the same item never nags you twice.
- **LLM Cost Observability** — every scoring call's prompt / completion / token breakdown is persisted, keeping model spend fully auditable and optimizable.

## Tech Stack

**Backend** · Go 1.26 · Temporal · PostgreSQL 18 · Feishu Open Platform · A2A protocol

**Frontend** · Vite 8 + React 19 + TypeScript 7 (source management / profile editing / push history / cost monitoring dashboard)

**Infra** · Docker (Postgres / Temporal / Caddy) · VPS systemd · dual-stack CDN (Alibaba Cloud CDN + Cloudflare Pages) · GitHub Actions CI

## Engineering Practices

- **Test-first** — core modules are fully unit-tested; `make test -race` is a hard CI gate, zero tolerance for data races.
- **Risk-tiered adversarial review** — changes on critical paths (push / scoring / callbacks / evolution) go through multi-agent parallel implementation + dual-skeptic review + mutation testing; peripheral changes get a single review round — spending review budget where it matters.
- **Milestone Gates** — each milestone closes with a manual test checklist + server-side probes; a SemVer tag is cut only after everything passes.
- **Contract-driven development** — critical paths (agent loop, profile loop) get signature-level contract docs before implementation, so interfaces stabilize ahead of code.

## My Role

**Solo build**: product design · system architecture · Go backend · React frontend · Docker/VPS infra · CI/CD — from zero to production, the entire stack by one person.

---

*Self-built project, source available on [GitHub](https://github.com/YouToco/vane).*
