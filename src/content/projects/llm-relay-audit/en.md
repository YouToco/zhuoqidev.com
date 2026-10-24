---
title: llm-relay-audit — An Agent Skill for Checking Relay APIs Before You Buy
description: 'An open-source Agent skill that compares an AI API relay (new-api / one-api / sub2api) with the official API item by item: real model or swapped, injected prompts, official original video, swallowed parameters, real charges. Every raw request is logged, and it ends with an external evidence PDF and an internal decision card. Python + the Agent Skills spec, one-line npx install.'
date: 2026-10-23
glyph: vs-sheets
---

**llm-relay-audit** is the audit procedure I use at work when choosing upstream suppliers for a platform, stripped of everything internal and open-sourced as an Agent skill. Give a relay's base URL and key to an Agent such as Claude Code, Codex or Cursor; it compares the relay with the official API item by item following a fixed procedure, and hands you two reports: one you can send straight to the vendor, one for whoever makes the call.

[🐙 GitHub](https://github.com/YouToco/llm-relay-audit)
[📖 How to use it: check a relay API before you buy](/en/posts/verify-llm-relay-api/)

```bash
npx skills add YouToco/llm-relay-audit
```

## What it solves

Cheap Claude, GPT and Seedance relays keep multiplying, with groups labelled "official" or "official key", but a group name is not evidence. Across the 30-odd relays I tested, the most common problem was a real model coming through a different channel than advertised, billing tokens you never see and dropping your parameters. All of it can be found before you pay; it just has to be done item by item for every relay and turned into a report someone else can read, which is exactly the kind of work to hand to an Agent.

![The six questions llm-relay-audit answers, how it checks them, and what it produces](./hero-en.png "How each of the six questions is checked, and the two reports you get.")

## How it works

The procedure is fixed: set up → free probes → **a price quote and your OK** → minimal paid matrix → verification (authenticity, video originality, field-by-field comparison with the official docs) → fill in `findings.json` → the generator writes two reports. Seventeen numbered rules constrain every step the Agent takes, for example:

- **Quote before spending**: every request that may be billed is listed with unit price, count and cap first; every tier is measured, never extrapolated.
- **"Identical" must be computed**: fields, response headers and streaming event names are diffed by a program before anyone writes "same".
- **Every raw request goes to JSONL**: reports cite only what was logged, never hand-copied text.
- **Stop on other people's data**: if a probe exposes another tenant's data, record only that it is reachable, and read nothing.

It ships official baselines for 10 vendors: Claude (incl. Bedrock), OpenAI (incl. Azure), Grok, Gemini, Kimi, GLM and DeepSeek for text; Alibaba wan3, MiniMax H3 and Seedance for video; plus notes on how the new-api and sub2api relay programs behave.

## The output

![Pages produced by the report generator](./gallery-en.png "All rendered straight from the repository's fictional examples by the generator.")

- **External evidence PDF**: only "this relay vs the official API": claims vs measurements, authenticity evidence, differences ranked by customer impact, what the vendor should fix, and an appendix with official and relay raw requests side by side.
- **Internal decision card**: one A4 page with the verdict (primary / backup / fix first / reject), cost and success rate against your existing lines, and what your gateway would need to change.
- Write `"lang": "en"` for an English report; individuals who only want to know whether a relay is genuine can add `--external-only` to get the external report alone.

## Engineering worth mentioning

- **Money and keys**: the probe library masks keys everywhere it writes (environment, headers, URLs, echoed bodies, raw streams); a paid request that may already have reached the server is never resent, so you never buy one video three times; keys are never sent to a different domain.
- **Video authenticity is more than "signature valid"**: anyone can self-sign a certificate carrying a vendor's name, and the signature will still validate. The C2PA check compares the signing certificate's fingerprint and calls a file official only if it matches an original fetched from the official API.
- **No leaks in the external report**: the generator refuses to write it if an internal line name, another vendor or anything key-like appears, whether hidden by letter case, escaping, markdown, image captions or file names.
- **Verifiable**: 84 unit tests; CI runs the tests, example validation, Agent Skills spec validation (`skills-ref`), npx discoverability and a secret scan; every GitHub Action is pinned to a commit SHA.
- **Reviewed three ways before release**: before v0.3.0, three independent Agents looked for problems as a new user, a content reviewer and a code auditor; 30-plus issues were fixed before publishing.

## Tech stack

**Skill** · Agent Skills spec (SKILL.md + references + scripts + assets), works with Claude Code, Codex, Cursor and Gemini CLI; also installable from the Claude Code plugin marketplace

**Scripts** · Python 3.10+ (the report generator and probe library use only the standard library) · headless Chrome for PDFs · c2pa-python · ffmpeg / ffprobe

**Engineering** · unittest · GitHub Actions · detect-secrets · MIT license

## My role

**Solo**: the audit method (from integration tests of 30-odd relays at work) · rules and procedure design · report generator · sanitizing for open source · testing and release.

---

*Open source; code on [GitHub](https://github.com/YouToco/llm-relay-audit).*
