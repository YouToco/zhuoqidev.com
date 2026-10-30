---
title: 插件到底是什么——图解 Agent 插件，和它走过的三代
short: 图解 Agent 插件
seoTitle: 图解 Agent 插件：由什么组成、走过哪三代
description: Claude Code、Codex、Cowork 都有了「插件」，但这一代插件和 2023 年 ChatGPT 那批插件几乎是两种东西。这是入门图解版：不讲配置文件和协议，只讲插件里装了什么、它从哪一代演变过来、我装上一个插件实测它占了多少地方、对用 agent 的人意味着什么。
date: 2026-10-30
updated: 2026-10-30
glyph: plugin-box
lead: 插件没有给 agent 新本事。它是一个**盒子**：把 agent 本来就会用的几样零件（说明书、工具、自动触发的小脚本）装在一起，带上名字和版本号，方便一次装好、递给别人。2023 年那一代插件三年里就退场了，这一代换了思路，活了下来。我装上自己公开的一个插件测了一下：**每次对话只多占 332 个 token，不到一次空对话的 1%**。这篇用图讲清来龙去脉，细节在详细版里。
tags:
  - AI Agent
  - 插件
  - Skills
  - MCP
  - Claude Code
  - 入门
series: Agent 架构深度
seriesOrder: 5
categories:
  - AI Agent 工程
---

> [!NOTE]
> 这是**入门图解版**，不需要会写代码。想看每个零件什么时候加载、协议里传了什么、实验插件的源码和全部测量数据，看详细版[《拆开一个 Agent 插件》](/posts/agent-plugins-inside/)。

```chart
{
  "type": "stats",
  "items": [
    {"label": "每次对话多占", "value": "332", "note": "token，装上我的检测插件后", "color": "seal"},
    {"label": "用到时才读", "value": "约 6,600", "note": "token，技能正文平时不进对话", "color": "gray"},
    {"label": "占比", "value": "0.8%", "note": "一次空对话本身约 42,500 token", "color": "gray"}
  ],
  "caption": "Claude Code 2.1.310，2026-10-30 实测，每种情况跑两遍，结果一致。"
}
```

---

## 来龙去脉：先有零件，后有盒子

agent 是「大模型 + 一套工具」。想让它按你们团队的办法做事，就要往里加东西：一份「这件事我们怎么做」的说明书，一个能查公司数据库的工具，一段每次改完代码自动跑格式化的小脚本。

这些东西早就有了，各自能用。麻烦在**递给别人**：同事要一样一样拷进自己的项目，你改了一版，他那边不会跟着变。**插件就是为这件事出现的盒子。**

### 盒子里装了什么

点每个零件，看它是什么、什么时候起作用、平时占不占对话：

```html demo height=470 caption="一个插件里的零件（点一下看说明）"
<style>
  .box { width: 100%; max-width: 580px; padding: 14px; font: 14px/1.55 system-ui, sans-serif; color: var(--ink); }
  .lid { border: 1.5px dashed var(--line); border-radius: 10px; padding: 8px 12px; margin-bottom: 10px; color: var(--ink-2); font-size: 13px; }
  .lid b { color: var(--ink); }
  .parts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .parts button { font: inherit; text-align: left; padding: 9px 10px; border-radius: 9px; cursor: pointer;
    border: 1.5px solid var(--line); background: var(--paper); color: var(--ink); }
  .parts button small { display: block; color: var(--ink-3); font-size: 12px; }
  .parts button[data-k="know"] { border-left: 5px solid var(--seal); }
  .parts button[data-k="auto"] { border-left: 5px solid var(--gold); }
  .parts button[data-k="link"] { border-left: 5px solid var(--blue); }
  .parts button[aria-pressed="true"] { border-color: var(--ink); background: var(--card); }
  .card { margin-top: 12px; border-radius: 10px; padding: 12px 14px; background: var(--card); border: 1.5px solid var(--line); min-height: 132px; }
  .card h3 { margin: 0 0 6px; font-size: 16px; }
  .card p { margin: 3px 0; }
  .card .k { color: var(--ink-3); font-size: 12px; display: inline-block; min-width: 72px; }
  .legend { display: flex; gap: 14px; margin-top: 10px; font-size: 12px; color: var(--ink-3); flex-wrap: wrap; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
  @media (max-width: 460px) { .box { padding: 10px 6px; font-size: 13px; } .parts { gap: 6px; } .parts button { padding: 7px 7px; } .card { padding: 10px; } .card .k { display: block; min-width: 0; } }
</style>
<div class="box">
  <div class="lid">箱子标签 <b>plugin.json</b>：名字、版本、一句介绍</div>
  <div class="parts" id="parts"></div>
  <div class="card" id="card"></div>
  <div class="legend"><span><i style="background:var(--seal)"></i>教它怎么做</span><span><i style="background:var(--gold)"></i>自动做事</span><span><i style="background:var(--blue)"></i>连外部</span></div>
</div>
<script>
  const P = [
    { k: "know", name: "技能", file: "skills/", what: "一份「这件事我们怎么做」的说明书，可以附带脚本和参考资料。", when: "你说的话和它那句描述对上时，agent 才把全文读进来。", cost: "平时只占名字和一句描述。我测的检测插件：332 token。" },
    { k: "auto", name: "子代理", file: "agents/", what: "一个带着自己说明的小助手，另开一段对话去干一件事，干完把结果交回来。", when: "agent 觉得这件事该交给它时。", cost: "平时只占名字和一句描述，Claude Code 估算约 40 token。" },
    { k: "auto", name: "钩子", file: "hooks/", what: "在固定时刻自动跑的一段命令：开工时、每次用工具之前、收工时……", when: "到点就跑，由 Claude Code 自己执行，不用模型决定。", cost: "0。它不进对话，模型看不见它。" },
    { k: "link", name: "MCP 工具", file: ".mcp.json", what: "在旁边跑着的一个小程序，给 agent 加新工具：查数据库、发消息、读表格。", when: "开工时就启动；要用某个工具时，agent 才去取它的说明书。", cost: "实测一个工具只多 12 token，够放一个名字。" },
    { k: "link", name: "命令", file: "bin/", what: "随插件带来的命令行小工具，装上就能直接叫。", when: "agent 在终端里用到它时。", cost: "0。只是多了一个能用的命令。" },
    { k: "link", name: "代码助手", file: ".lsp.json", what: "像编辑器一样「跳到定义、看报错」的语言服务。", when: "agent 读写代码时。", cost: "这项我没测，只读了文档。" }
  ];
  const parts = document.getElementById("parts"), card = document.getElementById("card");
  function show(i) {
    const p = P[i];
    card.innerHTML = "<h3></h3><p><span class='k'>是什么</span><span class='a'></span></p><p><span class='k'>什么时候</span><span class='b'></span></p><p><span class='k'>平时占多少</span><span class='c'></span></p>";
    card.querySelector("h3").textContent = p.name + " · " + p.file;
    card.querySelector(".a").textContent = p.what;
    card.querySelector(".b").textContent = p.when;
    card.querySelector(".c").textContent = p.cost;
    parts.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-pressed", i === j));
  }
  P.forEach((p, i) => {
    const b = document.createElement("button");
    b.dataset.k = p.k;
    b.innerHTML = "<span></span><small></small>";
    b.querySelector("span").textContent = p.name;
    b.querySelector("small").textContent = p.file;
    b.onclick = () => show(i);
    parts.append(b);
  });
  show(0);
</script>
```

> [!TIP]
> 盒子里每样东西都**不是插件发明的**：技能、MCP、钩子、子代理，在插件出现之前都能单独用。插件自己只添了一样东西，就是那张写着名字和版本的标签。

### 走过的三代

「插件」这个词，三年里换过一次内涵。点「下一步」往下看：

```steps
{
  "steps": [
    {"title": "2023-03 · ChatGPT 插件", "text": "第一代：一个插件 = 一个网址 + 一份接口说明。开发者把服务架在自己的服务器上，过了审核才能上架，**只有 ChatGPT 能用**。首批有 Expedia、Wolfram、Zapier 等。"},
    {"title": "2023-06 · 函数调用", "text": "模型学会了直接「填表」去调工具，调得准多了。但每家的表格式不一样，换一个模型就要重写一遍。"},
    {"title": "2024-04 · 第一代退场", "text": "ChatGPT 插件停用，让位给 2023-11 上线的 GPTs。问题主要在三处：只认一家、要审核、模型常常不知道该什么时候调用。"},
    {"title": "2024-11 · MCP：通用插座", "text": "Anthropic 开源 MCP，规定工具怎么接到 agent 上。一个工具写一次，各家 agent 都能接。2025-03 OpenAI 也用上了。"},
    {"title": "2025 · 零件越来越多", "text": "Claude Code 里陆续有了命令、钩子、子代理。每样都好用，但只能一个个拷进项目，**分享起来很麻烦**。"},
    {"title": "2025-10 · 插件 + 技能", "text": "10-09 Claude Code 插件公测：把零件装进一个文件夹，**一个 git 仓库就是一个市场**。10-16 技能（Skills）发布，很快成了插件里最常用的零件。"},
    {"title": "2025-12 → 2026-01 · 走出一家", "text": "技能成了开放标准，Codex、Gemini CLI、Cursor 都能读同一份说明书。MCP 捐给 Linux 基金会。2026-01-30，面向不写代码的人的 Cowork 也支持插件。"},
    {"title": "2026 · 连盒子也想统一", "text": "3 月 Codex 上了插件市场，目录布局几乎照搬 Claude Code。8 月，Amazon、Cursor、微软、OpenAI、Vercel 维护的 Agent Plugins 1.0 发布，想把「盒子」的格式也统一，Google 随后加入。"}
  ],
  "caption": "来源：各家官方公告和当时的科技媒体报道，链接都在详细版里。"
}
```

两代插件名字一样，做法几乎处处相反：

```html demo height=330 caption="2023 年的插件和今天的插件"
<style>
  .vs { width: 100%; max-width: 580px; padding: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    font: 14px/1.5 system-ui, sans-serif; color: var(--ink); }
  .col { border-radius: 10px; padding: 12px 14px; border: 1.5px solid var(--line); background: var(--paper); }
  .col.now { border-color: var(--seal); }
  .col h3 { margin: 0 0 8px; font-size: 15px; }
  .old h3 { color: var(--ink-3); }
  .now h3 { color: var(--seal); }
  .col dl { margin: 0; }
  .col dt { font-size: 12px; color: var(--ink-3); margin-top: 7px; }
  .col dd { margin: 0; }
  @media (max-width: 440px) { .vs { padding: 10px 6px; gap: 6px; font-size: 13px; } .col { padding: 10px; } }
</style>
<div class="vs">
  <div class="col old">
    <h3>2023 · ChatGPT 插件</h3>
    <dl>
      <dt>装的是什么</dt><dd>一个网上的接口</dd>
      <dt>放在哪</dt><dd>开发者自己的服务器</dd>
      <dt>怎么上架</dt><dd>交给平台审核</dd>
      <dt>谁能用</dt><dd>只有 ChatGPT</dd>
    </dl>
  </div>
  <div class="col now">
    <h3>今天 · Agent 插件</h3>
    <dl>
      <dt>装的是什么</dt><dd>一个文件夹，主要是说明书</dd>
      <dt>放在哪</dt><dd>一个 git 仓库</dd>
      <dt>怎么上架</dt><dd>仓库里放一份目录就是市场</dd>
      <dt>谁能用</dt><dd>技能多家都能读，盒子各家还不一样</dd>
    </dl>
  </div>
</div>
```

最大的变化在**装的东西**。2023 年的插件是「一个接口，等模型来调」；今天的插件主要是「一份说明书，告诉 agent 你们团队怎么做事」，工具只是顺带装进来的。

---

## 我做了什么测试

一句话：**开一次空对话，看装插件前后各占多少 token；再让插件真跑一遍，看每个零件什么时候被叫醒。**

我准备了两个插件：一个是我公开的「中转站检测」插件，里面就一个技能；另一个是专门搭的实验插件，技能、子代理、钩子、MCP 工具、命令每样放一个。下面是装上之后，**每次对话多出来的 token**：

```chart
{
  "type": "bars",
  "fmt": {"digits": 0},
  "rows": [
    {"label": "钩子、命令", "sub": "不进对话", "value": 0, "color": "gray"},
    {"label": "一个 MCP 工具", "sub": "只放了名字", "value": 12, "color": "gray"},
    {"label": "一个技能 + 一个子代理", "sub": "实验插件", "value": 84, "color": "gray"},
    {"label": "检测插件", "sub": "一个 17 KB 的技能", "value": 332, "color": "seal"}
  ],
  "caption": "单位：token。空对话本身约 42,530 token，每种情况跑两遍，差别不超过 5 个 token。"
}
```

检测插件的说明书全文有 17 KB，装上后却只多了 332 个 token：**平时进对话的只有一张目录**，也就是每个零件的名字和一句描述。全文要等用到的时候才读进来。

### 跑一遍，看零件什么时候醒

我对实验插件说了一句「lab hello」，然后看日志：

```steps
{
  "steps": [
    {"title": "开工", "text": "钩子先响一次；MCP 小程序被启动起来，报上自己有哪些工具。对话里只多了几个名字。"},
    {"title": "认出是哪个技能", "text": "我另装了一个插件，里面也有个叫 hello 的技能。agent 看描述，选了实验插件那个；两个插件各管各的名字，不会撞。"},
    {"title": "这时才读说明书", "text": "技能全文到这一步才进对话，按里面写的先回了一句话。"},
    {"title": "要用工具，先取说明书", "text": "说明书让它调用 MCP 工具。工具的用法平时不在对话里，agent 先查到它，再调用。"},
    {"title": "小程序回话", "text": "旁边那个小程序收到请求，回了一行「stamp ok」，agent 原样转给我。"},
    {"title": "钩子全程在旁边", "text": "每次用工具前钩子都会响，这一轮一共响了 3 次，对话里一个字都看不到它。"}
  ],
  "caption": "2026-10-30 实测，日志和实验插件的源码都在详细版里。"
}
```

---

## 意味着什么

**影响一：插件装多了也不太占地方，难的是那句描述。** 每个零件平时只留名字和一句描述，所以装十个插件，常驻的也就几千 token。反过来，**agent 靠这一句话决定用不用你的零件**，描述写得含糊，全文写得再好也叫不出来。

**影响二：说明书能带走，盒子还不行。** 技能已经是多家通用的格式，可插件这个盒子各家还没统一。我把一个按通用格式（Agent Plugins 1.0）打的包交给 Claude Code，它只认出了里面的技能：

```html demo height=180 caption="同一个按通用格式打的包，Claude Code 2.1.310 认出了什么"
<style>
  .got { width: 100%; max-width: 580px; padding: 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
    font: 14px/1.45 system-ui, sans-serif; color: var(--ink); }
  .g { border-radius: 10px; padding: 12px 10px; text-align: center; border: 1.5px solid var(--line); background: var(--paper); }
  .g b { display: block; font-size: 15px; }
  .g i { display: block; font-style: normal; font-size: 24px; margin: 4px 0; }
  .g span { font-size: 12px; color: var(--ink-3); }
  .g.ok { border-color: var(--seal); }
  .g.no { background: var(--paper-2); }
  @media (max-width: 420px) { .got { padding: 10px 6px; gap: 6px; font-size: 13px; } .g { padding: 10px 6px; } }
</style>
<div class="got">
  <div class="g ok"><b>技能</b><i>✓</i><span>装上了<br>能用</span></div>
  <div class="g no"><b>MCP 工具</b><i>✗</i><span>没装上<br>文件名不一样</span></div>
  <div class="g no"><b>名字标签</b><i>✗</i><span>没读<br>用了文件夹名</span></div>
</div>
```

想让别人在不同的 agent 里都能用，先把技能写好，它走得最远。

> [!WARNING]
> **装插件，就是让别人的代码在你的电脑上跑。** 钩子到点自动执行，不会每次问你（我的测试里一轮就响了 3 次）；MCP 小程序一开工就被启动；带来的命令直接能用。只装信得过的来源，装之前花一分钟看看里面的钩子和工具配置。

**影响三：会写说明书的人，也能「做插件」了。** 2023 年做插件要写服务、过审核；今天一个插件可以只有一份说明书。我把工作里两个检测流程做成插件发给同事，里面除了说明书，主要是几个现成的脚本。Cowork 那批按岗位做的插件（销售、法务、财务）也是这个思路：**把团队的做事方法写下来，比写一个新接口更有用。**

---

## 想看细节

详细版[《拆开一个 Agent 插件》](/posts/agent-plugins-inside/)讲了这些，这篇都没展开：

- 每个零件由谁执行、什么时候加载、进不进模型的上下文，一张总表
- 那句「lab hello」从输入到输出的完整日志，包括 MCP 小程序收发的每一条消息
- 两个插件里同名技能为什么不撞、版本和市场怎么写
- 通用格式、Claude Code、Codex 各认什么，以及什么时候该做插件、什么时候只发一个技能
- 实验插件的全部源码和复现命令

同系列的上一篇[《让 Agent 自己验收、自己整理记忆》](/posts/managed-agents-outcomes-dreaming/)讲的是另一件事：agent 怎么检查自己的活、整理自己的记忆。

**一句话收尾：插件没有教会 agent 新本事，它把本事装进了一个能递给别人的盒子。**
