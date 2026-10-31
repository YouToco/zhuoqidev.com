---
title: 插件到底是什么——图解 Agent 插件，和它走过的三代
short: 图解 Agent 插件
seoTitle: 图解 Agent 插件：由什么组成、走过哪三代
description: Claude Code、Codex、Cowork 都有了「插件」，但这一代插件和 2023 年 ChatGPT 那批插件几乎是两种东西。这是入门图解版：不讲配置文件和协议，只用四张图讲清插件是什么、你说一句话之后它在哪几步起作用、它走过哪三代、装之前要知道哪三件事。
date: 2026-10-30
updated: 2026-10-31
glyph: plugin-box
lead: 插件是一个**盒子**：把 agent（会自己动手干活的 AI 助手）本来就会用的几样零件装在一起，贴上名字和版本，方便一次装好、递给别人。你说一句话，它先看每份说明书的「名片」（名字加一句介绍），对上了才把全文读进来。我实测，平时只多占 **332 个 token**（AI 计算读了多少字的单位），不到一次空对话（什么都还没说时 AI 已经要读的内容）的 1%。
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

先认识三个词：

- **Agent**：会自己动手的 AI 助手。ChatGPT 主要陪你聊天；agent 能自己读文件、跑程序、调用别的软件，把一件事做完。Claude Code（Anthropic 出的，就是做 Claude 的公司）和 Codex（OpenAI 出的，就是做 ChatGPT 的公司）是写代码的人用的 agent，Cowork 是 Anthropic 给不写代码的人用的桌面应用。
- **Token**：AI 计算「读了多少字」的单位。按它计费，一次对话能装多少内容也按它算。
- **插件**：把几样零件一起装好、递给别人的安装包。

---

## 1 插件是什么：一个装零件的盒子

想让 agent 按你们团队的办法做事，要给它几样零件：一份「这件事我们怎么做」的**说明书**，一个能连飞书、数据库的**外接工具**，一段到点自动运行的**小脚本**。这些零件早就有了，麻烦在递给别人。

```html demo height=380 caption="没有插件和有插件：同样三样零件（示意）"
<style>
  .fx { --bg:#fafaf8; --ink:#15171c; --ink2:#3a3e46; --mute:#5a606c; --line:#c8c6be; --panel:#ffffff; --soft:#e7e6e1; --soft2:#f1f0eb;
    --r:#e5533d; --r-sh:#9b2d1c; --r-t:#fbe3dd; --r-ink:#5a1a10;
    --y:#ffe066; --y-sh:#d9b520; --y-t:#fff3b8; --y-ink:#3a3000;
    --b:#8fc9f0; --b-sh:#4f8fbf; --b-t:#cfe8f8; --b-ink:#0d2b44;
    --g:#9fdcae; --g-sh:#5fae74; --g-t:#d6f0dd; --g-ink:#0f3a22;
    --p:#cdbdf4; --p-sh:#9a85d6; --p-t:#ece6fb; --p-ink:#2a1a5a;
    width: 100%; max-width: 680px; background: var(--bg); color: var(--ink); border-radius: 12px; padding: 16px; font: 13px/1.5 system-ui, sans-serif; display: grid; gap: 12px; }
  :root[data-theme="dark"] .fx { --bg:#1b1e23; --ink:#f2efe8; --ink2:#d3d5da; --mute:#a9adb6; --line:#3f434b; --panel:#23262c; --soft:#2f333a; --soft2:#272a30;
    --r-t:#4a231c; --r-ink:#ffd9cf; --y-t:#463b10; --y-ink:#fff1b0; --b-t:#18364d; --b-ink:#d6ecfb; --g-t:#173a24; --g-ink:#d2f2db; --p-t:#2f2650; --p-ink:#e6defc; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .fx { --bg:#1b1e23; --ink:#f2efe8; --ink2:#d3d5da; --mute:#a9adb6; --line:#3f434b; --panel:#23262c; --soft:#2f333a; --soft2:#272a30;
    --r-t:#4a231c; --r-ink:#ffd9cf; --y-t:#463b10; --y-ink:#fff1b0; --b-t:#18364d; --b-ink:#d6ecfb; --g-t:#173a24; --g-ink:#d2f2db; --p-t:#2f2650; --p-ink:#e6defc; } }
  .fx .tt { font-size: 17px; font-weight: 600; line-height: 1.35; }
  .fx .tt em { font-style: normal; color: var(--r); }
  .fx .tag { display: inline-block; font-size: 11px; font-weight: 400; border-radius: 999px; padding: 1px 8px; background: var(--soft); color: var(--ink2); margin-left: 6px; vertical-align: 2px; }
  .fx .foot { font-size: 11.5px; color: var(--mute); }
  .fx .yl { background: var(--y); color: #3a3000; box-shadow: 0 4px 0 var(--y-sh); }
  .fx .rd { background: var(--r); color: #fff; box-shadow: 0 4px 0 var(--r-sh); }
  .fx .sk { background: var(--b); color: #0d2b44; box-shadow: 0 4px 0 var(--b-sh); }
  .fx .mn { background: var(--g); color: #0f3a22; box-shadow: 0 3px 0 var(--g-sh); }
  .fx .lc { background: var(--p); color: #2a1a5a; box-shadow: 0 3px 0 var(--p-sh); }
  .fx .gy { background: var(--soft); color: var(--ink); box-shadow: 0 4px 0 var(--line); }
  .fx .ty { background: var(--y-t); color: var(--y-ink); }
  .fx .tb { background: var(--b-t); color: var(--b-ink); }
  .fx .tp { background: var(--p-t); color: var(--p-ink); }
  .fx .tg { background: var(--g-t); color: var(--g-ink); }
  .fx .win { border-radius: 10px; background: var(--panel); border: 1.5px solid var(--line); box-shadow: 0 4px 0 var(--line); overflow: hidden; }
  .fx .win > .bar { padding: 6px 9px; background: var(--soft); font-size: 11.5px; color: var(--ink); }
  .fx .win > .rows { padding: 8px; display: grid; gap: 6px; }
  .fx .win.hot { border-color: var(--r); box-shadow: 0 4px 0 var(--r-sh); }
  .fx .win.hot > .bar { background: var(--r-t); color: var(--r-ink); }
  .fx .chip { border-radius: 6px; padding: 3px 8px; font-size: 11.5px; font-weight: 600; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .side { border-radius: 12px; padding: 12px; display: grid; gap: 9px; align-content: start; }
  .side .h { font-size: 14px; font-weight: 600; }
  .old { background: var(--soft2); border: 2px dashed var(--line); }
  .new { background: var(--r-t); border: 2px solid var(--r); }
  .part { border-radius: 9px; padding: 6px 10px; font-size: 12px; display: flex; justify-content: space-between; gap: 8px; align-items: center; }
  .cp { font-size: 11px; font-weight: 600; white-space: nowrap; opacity: .8; }
  .box { border-radius: 12px; background: var(--panel); border: 2px solid var(--r); box-shadow: 0 5px 0 var(--r-sh); padding: 9px; display: grid; gap: 7px; }
  .label { border-radius: 8px; padding: 6px 10px; font-size: 12.5px; font-weight: 600; display: flex; justify-content: space-between; gap: 8px; }
  .label small { font-weight: 400; opacity: .9; }
  .note { font-size: 12px; }
  .old .note { color: var(--ink2); }
  .new .note { color: var(--r-ink); font-weight: 600; }
  @media (max-width: 520px) { .two { grid-template-columns: 1fr; } }
</style>
<div class="fx">
  <div class="tt">零件早就有，<em>插件只是把它们装进一个盒子</em></div>
  <div class="two">
    <div class="side old"><div class="h">没有插件</div>
      <div class="part yl">说明书：会议纪要怎么写<span class="cp">拷一份</span></div>
      <div class="part sk">外接工具：发飞书<span class="cp">再配一次</span></div>
      <div class="part lc">自动脚本：查敏感词<span class="cp">再拷一份</span></div>
      <div class="note">同事要一样样装；你改了说明书，他那份不会跟着变</div>
    </div>
    <div class="side new"><div class="h" style="color: var(--r-ink)">有插件</div>
      <div class="box">
        <div class="label rd">团队纪要插件<small>v1.2</small></div>
        <div class="part yl">说明书：会议纪要怎么写</div>
        <div class="part sk">外接工具：发飞书</div>
        <div class="part lc">自动脚本：查敏感词</div>
      </div>
      <div class="note">同事装一次，三样都有了；你改了就发新版本</div>
    </div>
  </div>
  <div class="foot">零件在插件出现之前都能单独用。插件唯一新加的，是盒子上那张写着名字和版本的标签。</div>
</div>
```

盒子里常见的零件有五种：说明书（技能）、外接工具（MCP）、自动脚本（钩子）、能另开一段对话替它干活的小助手（子代理）、随插件带来、装上就能运行的小工具（命令）。

---

## 2 你说一句话之后，发生了什么

```html demo height=440 caption="你说一句话之后，插件在哪几步起作用（场景是示意，顺序来自实测）"
<style>
  .fx { --bg:#fafaf8; --ink:#15171c; --ink2:#3a3e46; --mute:#5a606c; --line:#c8c6be; --panel:#ffffff; --soft:#e7e6e1; --soft2:#f1f0eb;
    --r:#e5533d; --r-sh:#9b2d1c; --r-t:#fbe3dd; --r-ink:#5a1a10;
    --y:#ffe066; --y-sh:#d9b520; --y-t:#fff3b8; --y-ink:#3a3000;
    --b:#8fc9f0; --b-sh:#4f8fbf; --b-t:#cfe8f8; --b-ink:#0d2b44;
    --g:#9fdcae; --g-sh:#5fae74; --g-t:#d6f0dd; --g-ink:#0f3a22;
    --p:#cdbdf4; --p-sh:#9a85d6; --p-t:#ece6fb; --p-ink:#2a1a5a;
    width: 100%; max-width: 680px; background: var(--bg); color: var(--ink); border-radius: 12px; padding: 16px; font: 13px/1.5 system-ui, sans-serif; display: grid; gap: 12px; }
  :root[data-theme="dark"] .fx { --bg:#1b1e23; --ink:#f2efe8; --ink2:#d3d5da; --mute:#a9adb6; --line:#3f434b; --panel:#23262c; --soft:#2f333a; --soft2:#272a30;
    --r-t:#4a231c; --r-ink:#ffd9cf; --y-t:#463b10; --y-ink:#fff1b0; --b-t:#18364d; --b-ink:#d6ecfb; --g-t:#173a24; --g-ink:#d2f2db; --p-t:#2f2650; --p-ink:#e6defc; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .fx { --bg:#1b1e23; --ink:#f2efe8; --ink2:#d3d5da; --mute:#a9adb6; --line:#3f434b; --panel:#23262c; --soft:#2f333a; --soft2:#272a30;
    --r-t:#4a231c; --r-ink:#ffd9cf; --y-t:#463b10; --y-ink:#fff1b0; --b-t:#18364d; --b-ink:#d6ecfb; --g-t:#173a24; --g-ink:#d2f2db; --p-t:#2f2650; --p-ink:#e6defc; } }
  .fx .tt { font-size: 17px; font-weight: 600; line-height: 1.35; }
  .fx .tt em { font-style: normal; color: var(--r); }
  .fx .tag { display: inline-block; font-size: 11px; font-weight: 400; border-radius: 999px; padding: 1px 8px; background: var(--soft); color: var(--ink2); margin-left: 6px; vertical-align: 2px; }
  .fx .foot { font-size: 11.5px; color: var(--mute); }
  .fx .yl { background: var(--y); color: #3a3000; box-shadow: 0 4px 0 var(--y-sh); }
  .fx .rd { background: var(--r); color: #fff; box-shadow: 0 4px 0 var(--r-sh); }
  .fx .sk { background: var(--b); color: #0d2b44; box-shadow: 0 4px 0 var(--b-sh); }
  .fx .mn { background: var(--g); color: #0f3a22; box-shadow: 0 3px 0 var(--g-sh); }
  .fx .lc { background: var(--p); color: #2a1a5a; box-shadow: 0 3px 0 var(--p-sh); }
  .fx .gy { background: var(--soft); color: var(--ink); box-shadow: 0 4px 0 var(--line); }
  .fx .ty { background: var(--y-t); color: var(--y-ink); }
  .fx .tb { background: var(--b-t); color: var(--b-ink); }
  .fx .tp { background: var(--p-t); color: var(--p-ink); }
  .fx .tg { background: var(--g-t); color: var(--g-ink); }
  .fx .win { border-radius: 10px; background: var(--panel); border: 1.5px solid var(--line); box-shadow: 0 4px 0 var(--line); overflow: hidden; }
  .fx .win > .bar { padding: 6px 9px; background: var(--soft); font-size: 11.5px; color: var(--ink); }
  .fx .win > .rows { padding: 8px; display: grid; gap: 6px; }
  .fx .win.hot { border-color: var(--r); box-shadow: 0 4px 0 var(--r-sh); }
  .fx .win.hot > .bar { background: var(--r-t); color: var(--r-ink); }
  .fx .chip { border-radius: 6px; padding: 3px 8px; font-size: 11.5px; font-weight: 600; }
  .lay { display: grid; grid-template-columns: minmax(0, 1fr) 170px; gap: 14px; }
  .path { display: grid; gap: 10px; position: relative; padding-left: 22px; }
  .path::before { content: ""; position: absolute; left: 8px; top: 6px; bottom: 6px; width: 3px; background: var(--line); border-radius: 2px; }
  .st { position: relative; border-radius: 10px; padding: 8px 12px; display: grid; gap: 2px; }
  .st::before { content: ""; position: absolute; left: -19px; top: 12px; width: 11px; height: 11px; border-radius: 50%; background: var(--bg); border: 3px solid var(--mute); }
  .st b { font-size: 13.5px; font-weight: 600; }
  .st span { font-size: 12px; }
  .plug { border: 2px dashed var(--r); background: var(--r-t); border-radius: 12px; padding: 10px; display: grid; gap: 8px; }
  .plug .lb { font-size: 11.5px; font-weight: 600; color: var(--r-ink); }
  .plug .st::before { border-color: var(--r); }
  .bgl { border: 2px dashed var(--p-sh); border-radius: 12px; padding: 10px; display: grid; align-content: start; gap: 10px; }
  .bgl .h { font-size: 11.5px; font-weight: 600; color: var(--ink); }
  .bx { border-radius: 9px; padding: 7px 10px; font-size: 12px; line-height: 1.4; }
  @media (max-width: 540px) { .lay { grid-template-columns: 1fr; } }
</style>
<div class="fx">
  <div class="tt">你说一句话，<em>插件在中间三步出场</em>，另有零件在后台跑<span class="tag">示意</span></div>
  <div class="lay">
    <div class="path">
      <div class="st gy"><b>你说</b><span>「把今天的会议纪要整理好，发到项目群」</span></div>
      <div class="plug"><span class="lb">插件的说明书和外接工具在这三步出场</span>
        <div class="st yl"><b>① 对名片，选说明书</b><span>AI 拿你的话去比每份说明书的名片（名字 + 一句介绍），选中「会议纪要怎么写」</span></div>
        <div class="st rd"><b>② 读全文，照着写</b><span>说明书全文这时才读进来，AI 按团队的格式整理：结论、待办、负责人</span></div>
        <div class="st sk"><b>③ 叫外接工具，发出去</b><span>说明书写着发到哪个群，AI 叫飞书工具把纪要发出去</span></div>
      </div>
      <div class="st gy"><b>AI 回你</b><span>「已发到项目群」，附上纪要摘要</span></div>
    </div>
    <div class="bgl"><span class="h">后台 · 也是插件里的零件，AI 看不见</span>
      <div class="bx mn">对话一开始：连飞书的外接工具程序先启动，等着被叫</div>
      <div class="bx lc">发出之前：自动脚本先查一遍有没有敏感词，有就拦下</div>
      <span class="foot">它们在你的电脑上运行，对话里一个字都没有</span>
    </div>
  </div>
</div>
```

关键在第 ①② 步：**平时对话里只放每份说明书的名片（外接工具只放名字），全文要等用到才读进来**。所以装了插件几乎不占地方。我装上自己公开的「中转站检测」插件（教 agent 检查一家转卖 AI 模型的商家卖的是不是真货）量了一下：

```chart
{
  "type": "stats",
  "items": [
    {"label": "平时多占", "value": "332", "note": "token：只放名字和一句介绍", "color": "seal"},
    {"label": "用到时才读进来", "value": "约 6,600", "note": "token：说明书全文", "color": "gray"},
    {"label": "占一次空对话", "value": "0.8%", "note": "空对话本身约 42,500 token", "color": "gray"}
  ],
  "caption": "Claude Code 2.1.310，2026-10-30 实测，每种情况跑两遍，结果一致。"
}
```

一次什么都没说的对话也有约 42,500 token，那是 agent 每次都要带上的自带说明和工具清单。图里的步骤顺序（先看名片、用到才读全文、用工具前后台脚本先跑）我用一个专门搭的实验插件跑过，完整日志在详细版里。

---

## 3 它从哪来：三代，每代卡在哪

给 AI 装扩展这件事，三年里换过三种做法（按我的划分；第二代当时没人叫它「插件」），每一代都在补上一代卡住的地方：

```html demo height=360 caption="三代插件，你装的时候看到的东西（界面是示意，日期来自各家官方公告）"
<style>
  .fx { --bg:#fafaf8; --ink:#15171c; --ink2:#3a3e46; --mute:#5a606c; --line:#c8c6be; --panel:#ffffff; --soft:#e7e6e1; --soft2:#f1f0eb;
    --r:#e5533d; --r-sh:#9b2d1c; --r-t:#fbe3dd; --r-ink:#5a1a10;
    --y:#ffe066; --y-sh:#d9b520; --y-t:#fff3b8; --y-ink:#3a3000;
    --b:#8fc9f0; --b-sh:#4f8fbf; --b-t:#cfe8f8; --b-ink:#0d2b44;
    --g:#9fdcae; --g-sh:#5fae74; --g-t:#d6f0dd; --g-ink:#0f3a22;
    --p:#cdbdf4; --p-sh:#9a85d6; --p-t:#ece6fb; --p-ink:#2a1a5a;
    width: 100%; max-width: 680px; background: var(--bg); color: var(--ink); border-radius: 12px; padding: 16px; font: 13px/1.5 system-ui, sans-serif; display: grid; gap: 12px; }
  :root[data-theme="dark"] .fx { --bg:#1b1e23; --ink:#f2efe8; --ink2:#d3d5da; --mute:#a9adb6; --line:#3f434b; --panel:#23262c; --soft:#2f333a; --soft2:#272a30;
    --r-t:#4a231c; --r-ink:#ffd9cf; --y-t:#463b10; --y-ink:#fff1b0; --b-t:#18364d; --b-ink:#d6ecfb; --g-t:#173a24; --g-ink:#d2f2db; --p-t:#2f2650; --p-ink:#e6defc; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .fx { --bg:#1b1e23; --ink:#f2efe8; --ink2:#d3d5da; --mute:#a9adb6; --line:#3f434b; --panel:#23262c; --soft:#2f333a; --soft2:#272a30;
    --r-t:#4a231c; --r-ink:#ffd9cf; --y-t:#463b10; --y-ink:#fff1b0; --b-t:#18364d; --b-ink:#d6ecfb; --g-t:#173a24; --g-ink:#d2f2db; --p-t:#2f2650; --p-ink:#e6defc; } }
  .fx .tt { font-size: 17px; font-weight: 600; line-height: 1.35; }
  .fx .tt em { font-style: normal; color: var(--r); }
  .fx .tag { display: inline-block; font-size: 11px; font-weight: 400; border-radius: 999px; padding: 1px 8px; background: var(--soft); color: var(--ink2); margin-left: 6px; vertical-align: 2px; }
  .fx .foot { font-size: 11.5px; color: var(--mute); }
  .fx .yl { background: var(--y); color: #3a3000; box-shadow: 0 4px 0 var(--y-sh); }
  .fx .rd { background: var(--r); color: #fff; box-shadow: 0 4px 0 var(--r-sh); }
  .fx .sk { background: var(--b); color: #0d2b44; box-shadow: 0 4px 0 var(--b-sh); }
  .fx .mn { background: var(--g); color: #0f3a22; box-shadow: 0 3px 0 var(--g-sh); }
  .fx .lc { background: var(--p); color: #2a1a5a; box-shadow: 0 3px 0 var(--p-sh); }
  .fx .gy { background: var(--soft); color: var(--ink); box-shadow: 0 4px 0 var(--line); }
  .fx .ty { background: var(--y-t); color: var(--y-ink); }
  .fx .tb { background: var(--b-t); color: var(--b-ink); }
  .fx .tp { background: var(--p-t); color: var(--p-ink); }
  .fx .tg { background: var(--g-t); color: var(--g-ink); }
  .fx .win { border-radius: 10px; background: var(--panel); border: 1.5px solid var(--line); box-shadow: 0 4px 0 var(--line); overflow: hidden; }
  .fx .win > .bar { padding: 6px 9px; background: var(--soft); font-size: 11.5px; color: var(--ink); }
  .fx .win > .rows { padding: 8px; display: grid; gap: 6px; }
  .fx .win.hot { border-color: var(--r); box-shadow: 0 4px 0 var(--r-sh); }
  .fx .win.hot > .bar { background: var(--r-t); color: var(--r-ink); }
  .fx .chip { border-radius: 6px; padding: 3px 8px; font-size: 11.5px; font-weight: 600; }
  .gens { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .g { display: grid; gap: 8px; align-content: start; }
  .g .d { font-size: 12px; font-weight: 600; }
  .g .d span { color: var(--mute); font-weight: 400; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 12px; }
  .ic { width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; font-size: 11px; font-weight: 600; flex: none; }
  .nm { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .btn { border-radius: 7px; padding: 3px 9px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
  .inst { background: var(--ink); color: var(--bg); }
  .done { background: var(--soft); color: var(--ink); }
  .cap { font-size: 12px; line-height: 1.5; }
  .cap b { font-weight: 600; }
  .mini { display: grid; gap: 6px; }
  .big { border-radius: 10px; text-align: center; padding: 8px; font-size: 14px; font-weight: 600; }
  @media (max-width: 640px) { .gens { grid-template-columns: 1fr; } }
</style>
<div class="fx">
  <div class="tt">三代，<em>你装的时候看到的东西</em>完全不一样</div>
  <div class="gens">
    <div class="g"><div class="d">第一代 <span>2023-03 → 2024-04</span></div>
      <div class="win"><div class="bar">ChatGPT · 插件商店</div>
        <div class="rows">
          <div class="row"><span class="nm"><span class="ic tb">E</span>Expedia</span><span class="btn inst">安装</span></div>
          <div class="row"><span class="nm"><span class="ic" style="background: var(--r-t); color: var(--r-ink)">W</span>Wolfram</span><span class="btn done">已安装</span></div>
          <div class="row"><span class="nm"><span class="ic ty">Z</span>Zapier</span><span class="btn inst">安装</span></div>
        </div></div>
      <div class="cap"><b>只能在 ChatGPT 里用</b>，上架要审核。2024-04 停用。</div>
    </div>
    <div class="g"><div class="d">第二代 <span>2024-11 → 2025</span></div>
      <div class="mini">
        <div class="win"><div class="bar">Claude Code · 设置</div><div class="rows">
          <div class="row">外接工具：飞书<span class="chip tb">手动配</span></div>
          <div class="row">说明书<span class="chip ty">复制粘贴</span></div>
        </div></div>
        <div class="win"><div class="bar">另一个 AI 工具 · 设置</div><div class="rows">
          <div class="row">外接工具：飞书<span class="chip tb">再配一次</span></div>
          <div class="row">说明书<span class="chip ty">再贴一次</span></div>
        </div></div>
      </div>
      <div class="cap"><b>工具能通用了</b>（MCP），可每样零件都要自己一样样配。</div>
    </div>
    <div class="g"><div class="d">第三代 <span>2025-10 起</span></div>
      <div class="win hot"><div class="bar">插件 · 团队纪要 v1.2</div>
        <div class="rows">
          <div class="row"><span class="chip ty">说明书：会议纪要怎么写</span></div>
          <div class="row"><span class="chip tb">外接工具：飞书</span></div>
          <div class="row"><span class="chip tp">自动脚本：查敏感词</span></div>
          <div class="big rd">安装</div>
        </div></div>
      <div class="cap"><b>点一次，三样都装好。</b>Codex、Cowork 后来也支持。</div>
    </div>
  </div>
</div>
```

- **第一代（2023）**：ChatGPT 插件是一个架在网上的服务，开发者过了审核才能上架，只有 ChatGPT 能用，AI 也常常不知道什么时候该用它。2024-04 停用，让位给 GPTs（ChatGPT 里的定制助手）。
- **第二代（2024-11 → 2025）**：Anthropic 公开了 MCP，外接工具写一次、各家 agent 都能接，2025-03 OpenAI 也用上了。但零件只能一样样配，团队分享很麻烦。这一代其实没人叫它「插件」，可今天盒子里的零件就是那时成形的。
- **第三代（2025-10 起）**：Claude Code 推出插件，零件装进一个贴着名字和版本的文件夹，一次装好；一周后（2025-10-16）说明书（技能）发布，成了盒子里最常用的零件。之后技能成了多家通用的格式；Cowork（2026-01）、Codex（2026-03）也有了插件；2026-08 几家公司还联合发布了一个通用盒子格式 Agent Plugins 1.0。

---

## 4 装之前要知道的三件事

```html demo height=330 caption="装插件之前要知道的三件事（场景是示意，第 2 件的结果是实测）"
<style>
  .fx { --bg:#fafaf8; --ink:#15171c; --ink2:#3a3e46; --mute:#5a606c; --line:#c8c6be; --panel:#ffffff; --soft:#e7e6e1; --soft2:#f1f0eb;
    --r:#e5533d; --r-sh:#9b2d1c; --r-t:#fbe3dd; --r-ink:#5a1a10;
    --y:#ffe066; --y-sh:#d9b520; --y-t:#fff3b8; --y-ink:#3a3000;
    --b:#8fc9f0; --b-sh:#4f8fbf; --b-t:#cfe8f8; --b-ink:#0d2b44;
    --g:#9fdcae; --g-sh:#5fae74; --g-t:#d6f0dd; --g-ink:#0f3a22;
    --p:#cdbdf4; --p-sh:#9a85d6; --p-t:#ece6fb; --p-ink:#2a1a5a;
    width: 100%; max-width: 680px; background: var(--bg); color: var(--ink); border-radius: 12px; padding: 16px; font: 13px/1.5 system-ui, sans-serif; display: grid; gap: 12px; }
  :root[data-theme="dark"] .fx { --bg:#1b1e23; --ink:#f2efe8; --ink2:#d3d5da; --mute:#a9adb6; --line:#3f434b; --panel:#23262c; --soft:#2f333a; --soft2:#272a30;
    --r-t:#4a231c; --r-ink:#ffd9cf; --y-t:#463b10; --y-ink:#fff1b0; --b-t:#18364d; --b-ink:#d6ecfb; --g-t:#173a24; --g-ink:#d2f2db; --p-t:#2f2650; --p-ink:#e6defc; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .fx { --bg:#1b1e23; --ink:#f2efe8; --ink2:#d3d5da; --mute:#a9adb6; --line:#3f434b; --panel:#23262c; --soft:#2f333a; --soft2:#272a30;
    --r-t:#4a231c; --r-ink:#ffd9cf; --y-t:#463b10; --y-ink:#fff1b0; --b-t:#18364d; --b-ink:#d6ecfb; --g-t:#173a24; --g-ink:#d2f2db; --p-t:#2f2650; --p-ink:#e6defc; } }
  .fx .tt { font-size: 17px; font-weight: 600; line-height: 1.35; }
  .fx .tt em { font-style: normal; color: var(--r); }
  .fx .tag { display: inline-block; font-size: 11px; font-weight: 400; border-radius: 999px; padding: 1px 8px; background: var(--soft); color: var(--ink2); margin-left: 6px; vertical-align: 2px; }
  .fx .foot { font-size: 11.5px; color: var(--mute); }
  .fx .yl { background: var(--y); color: #3a3000; box-shadow: 0 4px 0 var(--y-sh); }
  .fx .rd { background: var(--r); color: #fff; box-shadow: 0 4px 0 var(--r-sh); }
  .fx .sk { background: var(--b); color: #0d2b44; box-shadow: 0 4px 0 var(--b-sh); }
  .fx .mn { background: var(--g); color: #0f3a22; box-shadow: 0 3px 0 var(--g-sh); }
  .fx .lc { background: var(--p); color: #2a1a5a; box-shadow: 0 3px 0 var(--p-sh); }
  .fx .gy { background: var(--soft); color: var(--ink); box-shadow: 0 4px 0 var(--line); }
  .fx .ty { background: var(--y-t); color: var(--y-ink); }
  .fx .tb { background: var(--b-t); color: var(--b-ink); }
  .fx .tp { background: var(--p-t); color: var(--p-ink); }
  .fx .tg { background: var(--g-t); color: var(--g-ink); }
  .fx .win { border-radius: 10px; background: var(--panel); border: 1.5px solid var(--line); box-shadow: 0 4px 0 var(--line); overflow: hidden; }
  .fx .win > .bar { padding: 6px 9px; background: var(--soft); font-size: 11.5px; color: var(--ink); }
  .fx .win > .rows { padding: 8px; display: grid; gap: 6px; }
  .fx .win.hot { border-color: var(--r); box-shadow: 0 4px 0 var(--r-sh); }
  .fx .win.hot > .bar { background: var(--r-t); color: var(--r-ink); }
  .fx .chip { border-radius: 6px; padding: 3px 8px; font-size: 11.5px; font-weight: 600; }
  .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .c { display: grid; gap: 8px; align-content: start; }
  .c .n { font-size: 13.5px; font-weight: 600; line-height: 1.4; }
  .c .n span { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--ink); color: var(--bg); font-size: 11.5px; margin-right: 6px; }
  .say { border-radius: 9px; background: var(--ink); color: var(--bg); padding: 6px 10px; font-size: 12px; justify-self: end; }
  .card { border-radius: 8px; padding: 6px 9px; font-size: 12px; line-height: 1.4; }
  .card b { font-weight: 600; }
  .pick { background: var(--y-t); color: var(--y-ink); border: 2px solid var(--y-sh); box-shadow: 0 3px 0 var(--y-sh); }
  .skip { background: var(--soft2); color: var(--ink2); border: 2px dashed var(--line); }
  .tagx { float: right; font-size: 11px; font-weight: 600; }
  .it { display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 12px; border-radius: 7px; padding: 5px 9px; }
  .it b { font-size: 15px; font-weight: 600; }
  .yes { background: var(--g-t); color: var(--g-ink); border: 1.5px solid var(--g-sh); }
  .no { background: var(--soft2); color: var(--ink2); border: 1.5px solid var(--line); }
  .lk { border-radius: 7px; padding: 5px 9px; font-size: 12px; display: flex; gap: 7px; align-items: center; }
  .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  .cap { font-size: 12px; line-height: 1.5; }
  @media (max-width: 640px) { .cards { grid-template-columns: 1fr; } }
</style>
<div class="fx">
  <div class="tt">装插件之前，知道这三件事</div>
  <div class="cards">
    <div class="c"><div class="n"><span>1</span>AI 只看名片上那一句</div>
      <div class="win"><div class="bar">你装了两个插件</div><div class="rows">
        <div class="say">帮我整理周会纪要</div>
        <div class="card pick"><span class="tagx">✓ 选中</span><b>会议纪要</b><br>整理会议记录，列出结论和待办</div>
        <div class="card skip"><span class="tagx">没选</span><b>效率助手</b><br>帮你更高效</div>
      </div></div>
      <div class="cap">介绍写得含糊，内容再好也叫不出来。</div>
    </div>
    <div class="c"><div class="n"><span>2</span>说明书能带走，盒子还不行</div>
      <div class="win"><div class="bar">按通用格式打的包 → 交给 Claude Code</div><div class="rows">
        <div class="it yes">说明书<b>✓</b></div>
        <div class="it no">外接工具<b>✗</b></div>
        <div class="it no">名字标签<b>✗</b></div>
      </div></div>
      <div class="cap">想多家 AI 都能用，先把说明书写好。</div>
    </div>
    <div class="c"><div class="n"><span>3</span>装之前，打开盒子看一眼</div>
      <div class="win hot"><div class="bar">这个插件会在你的电脑上</div><div class="rows">
        <div class="lk tp"><span class="dot" style="background: var(--p-sh)"></span>到点自动跑脚本，不先问你</div>
        <div class="lk tg"><span class="dot" style="background: var(--g-sh)"></span>对话一开始就启动外接工具的程序</div>
        <div class="lk tb"><span class="dot" style="background: var(--b-sh)"></span>加几个装上就能运行的小工具（命令）</div>
      </div></div>
      <div class="cap">只装信得过的来源。</div>
    </div>
  </div>
</div>
```

1. **名片上那一句最要紧。** 装十个插件，平时常驻的也就几千 token；可 agent 只靠那一句介绍决定用不用你的说明书，写得含糊就叫不出来。
2. **说明书走得最远。** 技能已经是多家通用的格式，插件这个盒子各家还没统一：我按通用格式（Agent Plugins 1.0）打了个包交给 Claude Code 2.1.310，它只认出了说明书，外接工具没装上，名字也没读（用了文件夹名）。
3. **装插件，就是让别人的程序在你电脑上跑。** 自动脚本到点就执行、不会每次问你（我的测试里一轮就响了 3 次），外接工具的程序在对话一开始就启动。只装信得过的来源，装之前看看里面有哪些自动脚本和外接工具。

今天在哪能装：Claude Code、Codex 都有插件市场；不写代码的人可以用 Cowork，2026-01 起它能装按岗位做好的插件。

反过来，会写说明书的人也能「做插件」了：2023 年做插件要写服务、过审核，今天一个插件可以只有一份说明书。我把工作里两个检测流程做成插件发给同事，里面除了说明书，主要是几个现成的脚本。

---

## 想看细节

详细版[《拆开一个 Agent 插件》](/posts/agent-plugins-inside/)讲了这些，这篇都没展开：

- 每个零件由谁执行、什么时候加载、进不进对话，一张总表
- 实验插件从输入到输出的完整日志，包括外接工具收发的每一条消息
- 两个插件里同名的说明书为什么不撞、版本和市场怎么写
- 通用格式、Claude Code、Codex 各认什么，以及什么时候该做插件、什么时候只发一份说明书
- 实验插件的全部源码和复现命令

同系列的上一篇[《让 Agent 自己验收、自己整理记忆》](/posts/managed-agents-outcomes-dreaming/)讲的是另一件事：agent 怎么检查自己的活、整理自己的记忆。

**一句话收尾：插件没有教会 agent 新本事，它把本事装进了一个能递给别人的盒子。**
