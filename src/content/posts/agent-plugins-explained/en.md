---
title: "What Is an Agent Plugin, Really? The Parts Inside and Three Generations, in Pictures"
short: Agent plugins, explained
seoTitle: "Agent Plugins Explained: The Parts and Three Generations"
description: Claude Code, Codex and Cowork all have "plugins" now, but this generation has little in common with the ChatGPT plugins of 2023. This is the illustrated beginner edition. No config files and no protocols; four pictures show what a plugin is, where it steps in after you say one sentence, which three generations led here, and three things to know before you install one.
date: 2026-10-30
updated: 2026-10-31
glyph: plugin-box
lead: A plugin is a **box**. It packs a few parts an agent (an AI assistant that does the work itself) could already use, labels them with a name and a version, and lets the whole set install at once and be handed on. When you say something, the agent first reads each manual's "card" (a name and one line) and reads the full text only when the card matches. In my measurement, day to day a plugin adds **332 tokens** (the unit AI counts reading in), under 1% of an empty conversation (what the AI already reads before you say anything).
tags:
  - AI Agent
  - Plugins
  - Skills
  - MCP
  - Claude Code
  - Beginner
series: Agent Architecture Deep Dives
seriesOrder: 5
categories:
  - Agent Engineering
---

> [!NOTE]
> This is the **illustrated beginner edition**; no coding needed. For when each part loads, what crosses the protocol, the source of the lab plugin and all the measurements, read the in-depth edition, [Inside an Agent Plugin](/en/posts/agent-plugins-inside/).

Three words first:

- **Agent**: an AI assistant that does the work itself. ChatGPT mostly talks with you; an agent reads files, runs programs and uses other software until a job is done. Claude Code (from Anthropic, the company behind Claude) and Codex (from OpenAI, the company behind ChatGPT) are agents for people who write code; Cowork is Anthropic's desktop app for people who don't.
- **Token**: the unit AI uses to count how much it has read. You pay by it, and how much one conversation can hold is counted in it too.
- **Plugin**: an install package that bundles a few parts so they install together and can be handed on.

---

## 1 What a plugin is: a box of parts

To make an agent work your team's way, you give it a few parts: a **manual** for "how we do this", an **external tool** that connects to your chat app or a database, a small **auto-script** that runs on cue. Those parts existed already; the trouble was handing them to someone else.

```html demo height=400 caption="Without a plugin and with one: the same three parts (illustrative)"
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
  <div class="tt">The parts existed already; <em>a plugin just puts them in one box</em></div>
  <div class="two">
    <div class="side old"><div class="h">Without a plugin</div>
      <div class="part yl">Manual: how to write meeting notes<span class="cp">copy it</span></div>
      <div class="part sk">External tool: post to chat<span class="cp">set it up again</span></div>
      <div class="part lc">Auto-script: check for sensitive words<span class="cp">copy again</span></div>
      <div class="note">A colleague installs each one; when you change the manual, their copy doesn't follow</div>
    </div>
    <div class="side new"><div class="h" style="color: var(--r-ink)">With a plugin</div>
      <div class="box">
        <div class="label rd">Team notes plugin<small>v1.2</small></div>
        <div class="part yl">Manual: how to write meeting notes</div>
        <div class="part sk">External tool: post to chat</div>
        <div class="part lc">Auto-script: check for sensitive words</div>
      </div>
      <div class="note">A colleague installs once and gets all three; when you change it, ship a new version</div>
    </div>
  </div>
  <div class="foot">Every part could be used on its own before plugins existed. The only new thing a plugin adds is the label on the box, with a name and a version.</div>
</div>
```

A box usually holds up to five kinds of part: manuals (skills), external tools (MCP), auto-scripts (hooks), helpers that take on a job in a conversation of their own (subagents), and small tools the plugin brings that run as soon as it is installed (commands).

---

## 2 What happens after you say one sentence

```html demo height=470 caption="Where a plugin steps in after you say one sentence (the scene is illustrative; the order was measured)"
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
  .lay { display: grid; grid-template-columns: minmax(0, 1fr) 180px; gap: 14px; }
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
  <div class="tt">You say one sentence; <em>the plugin steps in for the middle three</em>, and other parts run in the background<span class="tag">illustrative</span></div>
  <div class="lay">
    <div class="path">
      <div class="st gy"><b>You say</b><span>"Tidy up today's meeting notes and post them to the project group"</span></div>
      <div class="plug"><span class="lb">The plugin's manual and external tool step in here</span>
        <div class="st yl"><b>① Match a card, pick a manual</b><span>The AI compares your words with every manual's card (a name and one line) and picks "how to write meeting notes"</span></div>
        <div class="st rd"><b>② Read it in full, follow it</b><span>Only now is the manual's full text read in; the AI writes the notes in the team's format: decisions, to-dos, owners</span></div>
        <div class="st sk"><b>③ Call the external tool, post it</b><span>The manual says which group to post to; the AI calls the chat tool to post the notes</span></div>
      </div>
      <div class="st gy"><b>The AI replies</b><span>"Posted to the project group", with a summary of the notes</span></div>
    </div>
    <div class="bgl"><span class="h">Background · also plugin parts; the AI never sees them</span>
      <div class="bx mn">As the conversation starts: the program behind the chat tool starts and waits to be called</div>
      <div class="bx lc">Before posting: an auto-script checks for sensitive words and blocks the post if it finds any</div>
      <span class="foot">They run on your computer; not a word of them appears in the conversation</span>
    </div>
  </div>
</div>
```

Steps ① and ② are the point: **day to day the conversation holds only each manual's card (and each external tool's name); the full text is read in when it is needed.** That is why a plugin takes up almost no room. I installed my public "relay audit" plugin (it teaches an agent to check whether a business reselling AI models sells the real thing) and measured it:

```chart
{
  "type": "stats",
  "items": [
    {"label": "Added day to day", "value": "332", "note": "tokens: only names and one-line descriptions", "color": "seal"},
    {"label": "Read in only when used", "value": "≈6,600", "note": "tokens: the manual's full text", "color": "gray"},
    {"label": "Of an empty conversation", "value": "0.8%", "note": "an empty conversation is about 42,500 tokens", "color": "gray"}
  ],
  "caption": "Claude Code 2.1.310, measured 2026-10-30; each case run twice, with the same result."
}
```

Even an empty conversation holds about 42,500 tokens: the instructions and tool list the agent brings every time. The order of the steps in the picture (cards first, full text only when used, background scripts before each tool) I ran with a lab plugin built for the purpose; the full log is in the in-depth edition.

---

## 3 Where it came from: three generations, and what each got stuck on

Adding abilities to an AI has been done three different ways in three years (my grouping; nobody called the second generation "plugins" at the time), each fixing what the one before got stuck on:

```html demo height=380 caption="Three generations of plugins: what you saw when you installed one (screens are illustrative; dates from each vendor's announcements)"
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
  <div class="tt">Three generations: <em>what you saw when you installed something</em> changed completely</div>
  <div class="gens">
    <div class="g"><div class="d">First <span>2023-03 → 2024-04</span></div>
      <div class="win"><div class="bar">ChatGPT · Plugin store</div>
        <div class="rows">
          <div class="row"><span class="nm"><span class="ic tb">E</span>Expedia</span><span class="btn inst">Install</span></div>
          <div class="row"><span class="nm"><span class="ic" style="background: var(--r-t); color: var(--r-ink)">W</span>Wolfram</span><span class="btn done">Installed</span></div>
          <div class="row"><span class="nm"><span class="ic ty">Z</span>Zapier</span><span class="btn inst">Install</span></div>
        </div></div>
      <div class="cap"><b>Worked in ChatGPT only</b>, and listing needed a review. Switched off 2024-04.</div>
    </div>
    <div class="g"><div class="d">Second <span>2024-11 → 2025</span></div>
      <div class="mini">
        <div class="win"><div class="bar">Claude Code · Settings</div><div class="rows">
          <div class="row">External tool: chat<span class="chip tb">set up by hand</span></div>
          <div class="row">Manual<span class="chip ty">copy and paste</span></div>
        </div></div>
        <div class="win"><div class="bar">Another AI tool · Settings</div><div class="rows">
          <div class="row">External tool: chat<span class="chip tb">set up again</span></div>
          <div class="row">Manual<span class="chip ty">paste again</span></div>
        </div></div>
      </div>
      <div class="cap"><b>Tools became shared</b> (MCP), but every part had to be set up one by one.</div>
    </div>
    <div class="g"><div class="d">Third <span>from 2025-10</span></div>
      <div class="win hot"><div class="bar">Plugin · Team notes v1.2</div>
        <div class="rows">
          <div class="row"><span class="chip ty">Manual: meeting notes</span></div>
          <div class="row"><span class="chip tb">External tool: chat</span></div>
          <div class="row"><span class="chip tp">Auto-script: sensitive words</span></div>
          <div class="big rd">Install</div>
        </div></div>
      <div class="cap"><b>One click installs all three.</b> Codex and Cowork followed.</div>
    </div>
  </div>
</div>
```

- **First (2023)**: a ChatGPT plugin was a service on the web. Developers needed a review to list one, only ChatGPT could use it, and the model often did not know when to call it. Switched off in 2024-04 in favour of GPTs (custom assistants inside ChatGPT).
- **Second (2024-11 → 2025)**: Anthropic published MCP, so an external tool written once could plug into any agent; OpenAI adopted it in 2025-03. But parts had to be set up one by one, and sharing across a team was a chore. Nobody called this generation "plugins", but the parts in today's box took shape then.
- **Third (from 2025-10)**: Claude Code launched plugins: the parts go into one folder with a name and a version and install at once. A week later (2025-10-16) manuals (skills) arrived and became the part used most. Skills then became a format many agents share; Cowork (2026-01) and Codex (2026-03) got plugins too; and in 2026-08 several companies published a shared box format, Agent Plugins 1.0.

---

## 4 Three things to know before you install one

```html demo height=360 caption="Three things to know before installing a plugin (the scenes are illustrative; the result in the second was measured)"
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
  <div class="tt">Before you install a plugin, know these three things</div>
  <div class="cards">
    <div class="c"><div class="n"><span>1</span>The AI reads only the line on the card</div>
      <div class="win"><div class="bar">You have two plugins</div><div class="rows">
        <div class="say">Tidy up the weekly meeting notes</div>
        <div class="card pick"><span class="tagx">✓ picked</span><b>Meeting notes</b><br>Turns meeting records into decisions and to-dos</div>
        <div class="card skip"><span class="tagx">skipped</span><b>Productivity helper</b><br>Helps you get more done</div>
      </div></div>
      <div class="cap">A vague line means it never gets called, however good the rest is.</div>
    </div>
    <div class="c"><div class="n"><span>2</span>Manuals travel; the box doesn't yet</div>
      <div class="win"><div class="bar">Package in the shared format → Claude Code</div><div class="rows">
        <div class="it yes">Manual<b>✓</b></div>
        <div class="it no">External tool<b>✗</b></div>
        <div class="it no">Name label<b>✗</b></div>
      </div></div>
      <div class="cap">To work across agents, write the manual well first.</div>
    </div>
    <div class="c"><div class="n"><span>3</span>Look inside the box first</div>
      <div class="win hot"><div class="bar">On your computer, this plugin will</div><div class="rows">
        <div class="lk tp"><span class="dot" style="background: var(--p-sh)"></span>run scripts on cue, without asking</div>
        <div class="lk tg"><span class="dot" style="background: var(--g-sh)"></span>start the external tool's program as the conversation starts</div>
        <div class="lk tb"><span class="dot" style="background: var(--b-sh)"></span>add small tools that run right away (commands)</div>
      </div></div>
      <div class="cap">Install only from sources you trust.</div>
    </div>
  </div>
</div>
```

1. **The line on the card matters most.** Ten plugins keep only a few thousand tokens around day to day, but that one line is all the agent goes on to decide whether to use your manual; if it is vague, the manual never gets called.
2. **Manuals travel furthest.** Skills are already a format many agents share, but each vendor's plugin box is still its own: I packed something in the shared format (Agent Plugins 1.0) and gave it to Claude Code 2.1.310, which recognized only the manual; the external tool was not installed and the name was not read (the folder name was used).
3. **Installing a plugin means letting someone else's programs run on your computer.** Auto-scripts run on cue and do not ask each time (in my test they ran 3 times in one run), and the external tool's program starts as the conversation starts. Install only from sources you trust, and look at which auto-scripts and external tools it contains first.

Where you can install them today: Claude Code and Codex both have plugin marketplaces; people who don't code can use Cowork, which since 2026-01 installs plugins built for particular jobs.

The flip side: people who can write a manual can now make a plugin. In 2023 a plugin meant writing a service and passing a review; today a plugin can be a single manual. I turned two audit workflows from my job into plugins for colleagues, and apart from the manuals they are mostly a few existing scripts.

---

## Want the details

The in-depth edition, [Inside an Agent Plugin](/en/posts/agent-plugins-inside/), covers what this one leaves out:

- One table of every part: who runs it, when it loads, whether it enters the conversation
- The lab plugin's full log from input to output, including every message the external tool sent and received
- Why same-named manuals in two plugins do not collide, and how versions and marketplaces are written
- What the shared format, Claude Code and Codex each recognize, and when to build a plugin versus ship a single manual
- The lab plugin's complete source and the commands to reproduce it

The previous post in this series, [Agents That Check Their Own Work and Tidy Their Own Memory](/en/posts/managed-agents-outcomes-dreaming/), is about something else: how an agent checks its own work and tidies its own memory.

**In one line: a plugin teaches an agent nothing new; it puts what the agent knows into a box you can hand to someone else.**
