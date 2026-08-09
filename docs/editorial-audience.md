# Editorial audience and technical-writing contract

Profile ID: `agent-engineer-source-transition`

This document is the durable audience contract for zhuoqidev.com. It applies
to Chinese and English articles unless a post explicitly declares a different
audience and explains why.

## Core reader

Write for an engineer who:

- understands what an LLM, prompt, context window, API, and basic tool/function
  call are;
- normally works in Python, TypeScript, Java, Go, or a similar application
  language;
- has built or configured an Agent, but has not systematically read the target
  project's source;
- wants source-level understanding and engineering trade-offs, not a marketing
  summary;
- is willing to read real code after receiving a correct mental model;
- is not assumed to know Rust syntax, repository-specific architecture,
  internal type names, feature flags, or protocol wire formats.

The primary reader is transitioning from “I can use an Agent” to “I can reason
about an Agent implementation.” The site should serve as the translation layer
between product behavior and verifiable source code.

## Readers who are not the default

- A complete AI beginner may need a linked prerequisite article.
- A project maintainer or expert Rust contributor may skip the conceptual
  layer and follow source links.
- Do not flatten a source investigation into generic beginner content to serve
  the first group, and do not require maintainer knowledge to serve the second.

## Reader promise

Every deep technical article must let the core reader answer:

1. What problem is the system solving?
2. What are the few moving parts and how do they relate?
3. What crosses the actual protocol or process boundary?
4. Which part is confirmed by source, which part is inference, and which part
   is only an illustrative example?
5. Where can the reader verify every material implementation claim?

Rust or project-specific names are evidence, not explanations. A sentence such
as “`ToolSearchHandlerCache` reuses the index” is incomplete until the article
first explains what is cached, why reuse is safe, and when it is rebuilt.

## Required teaching order

Use this order unless the subject genuinely demands another one:

1. Lead with the outcome and version scope.
2. State prerequisites and what the reader does not need to know.
3. Introduce a small glossary or architecture map before dense internal terms.
4. Explain the behavior in product or protocol language.
5. Show pseudocode or a data-flow diagram.
6. Show the real source with a plain-language reading guide.
7. Walk one concrete input through the full path to its observable output.
8. Separate implementation facts, engineering inference, examples, and known
   limitations.
9. End with takeaways and pinned source links.

Do not use this order:

`internal function name -> internal type -> feature flag -> reader infers the architecture`.

## Code rules

- Before the first nontrivial Rust excerpt, say that Rust knowledge is not a
  prerequisite and translate iterator chains into list operations.
- Mark excerpts as exact, abridged, or pseudocode.
- Explain generics such as `usize`, ownership wrappers such as `Arc`, and custom
  types only when they carry meaning in the data flow.
- A code block must answer a question posed immediately before it.
- Prefer one end-to-end example over several disconnected snippets.
- When a library performs the core algorithm, distinguish application glue
  code from library internals and link both versions exactly.
- Never invent numeric scores, benchmarks, wire payloads, or defaults for an
  illustration. Label synthetic IDs and rankings as illustrative.

## Terminology rules

- Define every project-specific term on first use.
- Classify important terms by layer: model metadata, client configuration,
  runtime registry, request protocol, handler implementation, or external
  library.
- Avoid introducing more than three new internal terms in one paragraph.
- Do not present an internal selector as a familiar user-facing switch. If an
  experimental override exists, distinguish automatic model selection,
  configuration, and UI controls.

## Visual rules

- Every image must teach a relationship that prose alone would make harder to
  see.
- Captions must state whether the image shows current behavior, intended
  design, or a simplified example.
- Tool lists must be labeled as examples when they depend on model, provider,
  feature, account, or environment.
- A solid arrow means the path works in the pinned implementation. Use a
  dashed arrow, barrier, or explicit annotation for a design path that is not
  exposed in the described mode.
- Lexical search graphics must not imply synonym, semantic, or cross-language
  understanding.
- If an image shows Top-K results other than the real default, label the number
  as illustrative.
- Validate spelling, mobile readability, and consistency with the surrounding
  paragraph before publication.

## Bilingual parity

Chinese and English editions must agree on:

- title promise and version/date scope;
- prerequisites and glossary;
- architecture, code, and complete example;
- current-state caveats and uncertainty;
- image semantics and captions;
- source links and check date.

Localization may change metaphors and sentence structure, but not technical
claims.

## Pre-publication checklist

- [ ] The core reader is named in front matter with
      `audience_profile: agent-engineer-source-transition`.
- [ ] The title does not promise a timeless answer to a versioned question.
- [ ] The first screen states version scope and the most important caveat.
- [ ] A reader who knows Tool Calling but not Rust can understand the first
      architecture section without opening another tab.
- [ ] Internal terms are defined before they carry the explanation.
- [ ] Pseudocode or a diagram precedes nontrivial source excerpts.
- [ ] One input is traced end to end.
- [ ] Application glue and dependency internals are distinguished.
- [ ] Facts, inference, and illustrative values are visibly separated.
- [ ] Images do not contradict the pinned implementation.
- [ ] Chinese and English versions have equivalent claims.
- [ ] Source tag, commit, dependency version, and check date are pinned.
- [ ] Local build, link/content checks, and repository tests pass.

## 中文摘要

默认读者是：懂 LLM 与基础 Tool Calling、会 Python/TypeScript 等应用开发，
但不预设会 Rust、读过目标项目源码或认识内部函数名的 Agent 工程师。文章的
任务不是降低技术深度，而是按“问题 → 心智模型 → 术语 → 伪代码/数据流 →
真实源码 → 完整实例 → 边界与证据”的顺序，为读者搭好进入源码的台阶。
