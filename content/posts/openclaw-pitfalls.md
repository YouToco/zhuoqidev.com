---
title: "OpenClaw 生产踩坑：当最先进的记忆系统遇到最静默的失败"
description: "从部署到排障，记录 OpenClaw 从启动失败、飞书消息静默吞回复到 production 稳定的全链路实战经验——compaction safequard、五层排查法、model-harness-fit 与记忆系统对比。"
date: 2026-05-27
tags: ["OpenClaw", "AI Agent", "飞书", "记忆系统", "Compaction", "排障"]
categories: ["AI Agent 实战"]
showToc: true
ShowReadingTime: true
---

## 为什么是 OpenClaw

> 编程 Agent 按能力跃迁分三代：**Gen 1 补全**（Copilot，行级补全，无跨会话记忆）→ **Gen 2 AI-native IDE**（Cursor，对话+编辑+基础 Agent，server-side 自动记忆）→ **Gen 3 自治团队**（Claude Code / Codex CLI / OpenClaw，多 Agent 并行 + 云端沙箱 + 全仓库自主操作，文件记忆 + 自动巩固 + 跨会话持久化）。同一代内，OpenClaw 在记忆架构上走得最远、但生产成熟度最低。

OpenClaw 是 Gen 3 自治编程 Agent，跨模型 CLI，支持 DeepSeek / Anthropic / OpenAI 多后端。它最吸引我的一点是**记忆系统**——在当前所有生产可用的编程 Agent 中，它的记忆架构是最激进的：

- **PPO 认知权重自适应**：唯一的在生产工具中用强化学习调整记忆检索权重的系统。检索信号五维加权（recency 0.35 + frequency 0.25 + semantic 0.25 + saliency 0.15 + procedural 按需），随时间动态衰减
- **三重睡眠巩固**：Light Sleep（Jaccard 去重，零 LLM 成本）→ REM Sleep（置信度评分）→ Deep Sleep（三条件晋升门：score≥0.80 + merge≥3 + recall≥3），自动将短期经验固化为长期记忆
- **向量 + BM25 混合检索**（7:3）：比纯向量检索更鲁棒

但拉上生产环境跑了三周后，我的结论是：**记忆系统有多先进，踩的坑就有多深**。下面按时间线记录从部署到稳定全过程中真正折腾过的问题。

## 第一坑：启动失败三重奏

第一次在 VPS 上启动 OpenClaw Gateway，连续三种报错，每种原因都不一样。

**`gateway token missing`** — 最容易被忽略。OpenClaw 的 Gateway 模式需要独立的 `OPENCLAW_GATEWAY_TOKEN` 环境变量，不是飞书的 App Secret。systemd unit 文件里漏写一个 `Environment=` 就直接 401。

**`No credentials for provider`** — `auth-profiles.json` 里的 `keyRef` 必须和环境变量名精确匹配。一个字符对不上就报这个错，而且错误信息不会告诉你是哪个 keyRef 没匹配到，只能肉眼对。

**`400 InvalidParameter` / 模型不存在** — Omniroute 的模型名必须是 `<provider>/<model>` 格式。写成 `gpt-5.5` 会报 400，必须写 `codex/gpt-5.5`。再加上 OpenClaw 自己的 provider 前缀，最终是 `omniroute/codex/gpt-5.5`。三层前缀嵌套，少一层都不行。

```bash
# 排查时这三步最省时间
systemctl cat openclaw-gateway.service | grep Environment  # 检查环境变量
python3 -c "import json; json.load(open('/home/openclaw/.openclaw/openclaw.json'))"  # JSON 语法
journalctl -u openclaw-gateway.service -n 50 --no-pager | grep -iE "error|unauth"  # 看错误
```

## 第二坑：日志去哪了

OpenClaw 运行时日志**全部走 journald**，不写文件。`/tmp/openclaw/openclaw-*.log` 只在启动阶段有几行，运行时的错误全在 journald 里。我被这个坑了半小时——盯着文件日志 tail 了半天，什么都没看到，最后才意识到：

```bash
# 这才是正确的看日志方式
journalctl -u openclaw-gateway.service -f
```

## 第三坑（最严重）：Compaction 静默吞回复

这是这三周里最严重的一次事故。一条正常的用户消息，Agent 已经生成了完整回复，但**用户什么都没收到**，bot 像死了一样安静。

### 时间线

- `01:43:40` 飞书新闻群用户发消息："失败请求占用到我们账户的请求资源的，麻烦方便的时候检修下程序中错误的请求参数"
- `01:43:57` Agent 生成了完整文本回复（session trajectory 里能看到 `message` event with assistant response）
- `01:44:00` Auto-compaction 触发：session context 已经到了 209K tokens，超过 primary model 的 200K 限制
- `01:44:00` **回复消失**：compaction 输出空摘要 `"Conversation is empty"`，session 结束，回复未投递到飞书
- 用户侧完全感知为"bot 不回复"

### 根因

Compaction 是一个**隐式中间层**。正常情况下它压缩上下文；但当上下文本身已经超过模型限制（209K > 200K），compaction prompt 也装不下完整上下文时，**模型输出空字符串**。OpenClaw 默认没有对此做保护——不报错、不降级、不通知，只是悄悄地把已生成的回复扔掉了。

这是 `middleware-semantic-leak` 的教科书级案例：中间层在极端情况下从"压缩上下文"变成了"丢弃回复"，语义完全翻转，且没有任何信号。

### 修复

两步，缺一不可：

```json
// openclaw.json
"compaction": {
  "mode": "safeguard",
  "reserveTokens": 20000,
  "keepRecentTokens": 16000
},
"model": {
  "fallbacks": ["deepseek/deepseek-v4-flash"]
}
```

`safeguard` 模式为 compaction 后的总结保留 token 预算，防止占用满窗口。而 fallback 到 `deepseek-v4-flash`（1M context window）则保证了即使主模型窗口不够，compaction 任务本身永不会超限。

### 通用教训

这不是 OpenClaw 专属的问题。任何带自动上下文压缩的 Agent 系统，都面临同样的风险：**compaction 的失败模式是静默的**。如果你的 Agent 突然不回复了，第三个要检查的就是 compaction——在 session trajectory 里找 compaction event 的 content 是否为空。

## 飞书消息不响应：五层排查法

这次事故之后，我沉淀了一套从外到内、按概率排序的排查链路。下次 bot 不回复，按这个顺序查：

| 层 | 检查点 | 怎么看 |
|---|---|---|
| L1 飞书应用层 | Bot 是否收到消息 | `lark-cli im +chat-list --as bot` 确认群在 allowlist |
| L2 事件接收层 | 消息是否到达 Gateway | 检查 dedup 记录是否有最近条目 |
| **L3 Session 层** | Agent 是否处理了消息 | **看 session trajectory 的最后 event**——这步最关键 |
| L4 模型调用层 | 模型是否正常响应 | journalctl grep 429/401/500/timeout |
| L5 投递层 | 飞书发送是否成功 | 用 CLI 直接发一条测试消息验证权限 |

L3 是黄金排查点。trajectory 的最后一条 event 直接告诉你发生了什么：
- 最后是 `message(assistant text)` → 回复生成了但投递失败
- 最后是 `compaction` 且内容为空 → **就是本文说的事故**
- 最后是 `error` → agent 处理失败

以后遇到消息不响应，先 cat session trajectory 的最后 10 行，八成问题都在这。

## Model-Harness-Fit：模型和工具框架有"化学反应"

一个反直觉的发现：OpenClaw + DeepSeek-R1-0528 在 Terminal-Bench 2.0 排名第一。不是最强的模型，也不是最强的框架，但**组合起来反而是最优**。

这意味着选 Agent 框架时，"框架支持哪个模型"比"框架本身有多强"更关键。如果你的主力模型和框架之间存在不匹配——比如框架设计假设了某个 API 协议族但你的模型用另一套——debug 成本会远超框架本身带来的收益。

具体到 OpenClaw：它同时支持 DeepSeek / Anthropic / OpenAI 多后端，但也因此带来了"用哪个模型"的决策负担。每个模型的 context window、reasoning profile、API 行为都不一样，compaction 配置需要针对 primary model 的窗口大小来调。

## OpenClaw vs Claude Code：记忆系统的路线分歧

跑了一段时间后，两个系统可以并排对比：

| 维度 | OpenClaw | Claude Code |
|---|---|---|
| 检索机制 | 向量+BM25 混合 (7:3) | LLM 语义判断 (Sonnet) |
| 权重进化 | **PPO 自适应** | 人工固定分类 |
| 巩固机制 | 三重睡眠 | 三门四阶段 AutoDream |
| 模型锁定 | 多模型 | 仅 Claude |
| 记忆分类 | 按时间（长期蒸馏/短期流水） | 按类型（user/feedback/project/reference） |
| 生产成熟度 | 早期 | 百万级 Agent 验证 |

OpenClaw 在记忆架构上更"学术正确"——PPO 自适应权重、三重睡眠、混合检索，每一层都接近前沿论文。但**架构先进性和生产稳定性之间有一条鸿沟**。Claude Code 的记忆分类是手工的四类标签，检索也只是 LLM 语义判断，不 fancy，但在百万级 Agent 中验证过"不会丢记忆、不会静默失败"。

## 总结

1. **Compaction 是 Agent 系统中最危险的隐式中间层**——它失败时不会报错，只会悄悄丢东西。任何带自动压缩的系统上线前都必须配 safequard 模式 + 大窗口 fallback
2. **消息不响应时先看 session trajectory 的最后 10 行**——不要从权限开始排查，先看 agent 到底有没有生成回复
3. **模型名格式、环境变量、JSON 语法**——这三个问题的排查成本接近于零，但犯错的概率远高于预期
4. **记忆系统选型不只是"谁架构更先进"**——OpenClaw 的记忆架构比 Claude Code 先进，但生产稳定性是另一维度的考量。选型时至少看三个维度：检索准确率、不丢记忆、失败有信号
