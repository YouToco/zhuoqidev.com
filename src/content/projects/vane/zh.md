---
title: 见微 Vane — 生产级 AI 个性化信息推送系统
description: 独立设计开发的 AI Agent 系统：多信源采集 → LLM 个性化打分 → 飞书推送，带用户画像反馈闭环。Go + Temporal + A2A 协议 + React 全栈。
date: 2026-07-19
---

**见微 Vane** 是我独立设计并开发的 AI 个性化信息推送系统——它持续从多个信源采集内容，用 LLM 按用户画像打分筛选，再通过飞书把"值得看的"推给你，并从反馈中学习、不断校准画像。从产品设计、系统架构到上线运维，一个人全部走通。

> [!NOTE]
> Vane 从 2026-09 起暂停开发，在线服务已关闭；源码仍在 GitHub。下文描述的是暂停前的系统。

[🐙 GitHub 源码](https://github.com/YouToco/vane)

## 它解决什么

信息过载时代，RSS、资讯站、网站更新太多，人工筛选成本极高。Vane 让一个 AI Agent 替你盯着所有信源，只推真正相关的内容，且越用越懂你——把"刷信息"变成"信息来找你"。

## 架构亮点

- **完整 Agent Runtime** — 自建 agent loop + 工具调用（信源增删、画像调整、信源启停等），配合飞书确认卡做「人在环」交互，动作结果回写会话，避免模型对已处理动作产生状态幻觉。
- **A2A 协议接入** — 基于 a2a-go 实现 Agent-to-Agent 互操作，把 Agent 能力做成可被标准化调用的服务。
- **画像 + 反馈闭环** — 用户画像驱动个性化打分，用户反馈实时校准画像，形成「推送 → 反馈 → 画像进化」的自学习闭环。
- **Temporal 工作流编排** — 每日推送调度与抓取流水线由 Temporal 托管，保证可靠、可重放、幂等，长流程不怕中断。
- **多信源采集与去重** — 统一接入 RSS 与网页内容，以 canonical_key 内容身份系统做跨源去重，同一条内容不重复打扰。
- **LLM 成本可观测** — 每次打分的 prompt / completion / token 明细落库，模型开销全程可查、可优化。

## 技术栈

**后端** · Go 1.26 · Temporal · PostgreSQL 18 · 飞书开放平台 · A2A 协议

**前端** · Vite 8 + React 19 + TypeScript 7（信源管理 / 画像编辑 / 推送历史 / 成本监控 Dashboard）

**基建** · Docker（Postgres / Temporal / Caddy）· VPS systemd · 双线 CDN（阿里云 CDN + Cloudflare Pages）· GitHub Actions CI

## 工程实践

- **测试优先** — 核心模块全覆盖单元测试，`make test -race` 是 CI 硬门槛，竞态必须为零。
- **风险分级的对抗审查** — 核心路径（推送 / 打分 / 回调 / 演化）的改动走多 Agent 并行实现 + 双怀疑者审查 + 突变体实验；外围改动单轮 review，把审查成本花在刀刃上。
- **里程碑 Gate** — 每个里程碑收官走真人实测清单 + 服务端探针，全部通过才打 SemVer 版本 tag。
- **契约驱动开发** — 关键链路（Agent loop、画像闭环）先写签名级契约文档，再动手实现，接口先于代码稳定。

## 我的角色

**独立完成**：产品设计 · 系统架构 · Go 后端 · React 前端 · Docker/VPS 基建 · CI/CD 部署——从 0 到生产，全链路一个人打通。

---

*自研项目，源码已公开于 [GitHub](https://github.com/YouToco/vane)。*
