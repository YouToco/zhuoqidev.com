---
title: "What Is an Agent Plugin, Really? The Parts Inside and Three Generations, in Pictures"
short: Agent plugins, explained
seoTitle: "Agent Plugins Explained: The Parts and Three Generations"
description: Claude Code, Codex and Cowork all have "plugins" now, but this generation has little in common with the ChatGPT plugins of 2023. This is the illustrated beginner edition. No config files and no protocols; just what goes inside a plugin, which generations led here, how much room a plugin took up when I installed one and measured it, and what that means for people who use agents.
date: 2026-10-30
updated: 2026-10-30
glyph: plugin-box
lead: A plugin does not teach an agent anything new. It is a **box**. It packs a few parts the agent could already use (a manual, a tool, a small script that runs on its own) together with a name and a version number, so the whole set installs at once and can be handed to someone else. The 2023 generation of plugins was gone within three years; this generation changed approach and stuck. I installed one of my own public plugins and measured it. **Each conversation carried 332 more tokens, under 1% of an empty conversation.** This post tells the story in pictures; the details are in the in-depth edition.
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

```chart
{
  "type": "stats",
  "items": [
    {"label": "Added to every conversation", "value": "332", "note": "tokens, with my audit plugin installed", "color": "seal"},
    {"label": "Read only when used", "value": "≈6,600", "note": "tokens; the skill's full text stays out until then", "color": "gray"},
    {"label": "Share", "value": "0.8%", "note": "an empty conversation is about 42,500 tokens", "color": "gray"}
  ],
  "caption": "Claude Code 2.1.310, measured 2026-10-30; each case run twice, with the same result."
}
```

---

## The story: parts first, then the box

An agent is "a large language model plus a set of tools." To make it work the way your team works, you add things: a manual for how we do this job, a tool that can query the company database, a little script that formats the code every time something is edited.

All of these existed already, and each worked on its own. The trouble was **handing them to someone else**: a colleague copied them into their project one by one, and when you changed one, their copy stayed behind. **The plugin is the box that appeared for this job.**

### What is in the box

Click each part to see what it is, when it acts, and whether it takes up room in the conversation:

```html demo height=540 caption="The parts of one plugin (click to read)"
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
  .card { margin-top: 12px; border-radius: 10px; padding: 12px 14px; background: var(--card); border: 1.5px solid var(--line); min-height: 150px; }
  .card h3 { margin: 0 0 6px; font-size: 16px; }
  .card p { margin: 3px 0; }
  .card .k { color: var(--ink-3); font-size: 12px; display: inline-block; min-width: 84px; }
  .legend { display: flex; gap: 14px; margin-top: 10px; font-size: 12px; color: var(--ink-3); flex-wrap: wrap; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
  @media (max-width: 460px) { .box { padding: 10px 6px; font-size: 13px; } .parts { gap: 6px; } .parts button { padding: 7px 7px; } .card { padding: 10px; } .card .k { display: block; min-width: 0; } }
</style>
<div class="box">
  <div class="lid">Label on the box, <b>plugin.json</b>: name, version, one-line description</div>
  <div class="parts" id="parts"></div>
  <div class="card" id="card"></div>
  <div class="legend"><span><i style="background:var(--seal)"></i>How to do it</span><span><i style="background:var(--gold)"></i>Acts on its own</span><span><i style="background:var(--blue)"></i>Reaches outside</span></div>
</div>
<script>
  const P = [
    { k: "know", name: "Skill", file: "skills/", what: "A manual for how we do this job, optionally with scripts and reference files.", when: "The agent reads the full text only when what you said matches its description.", cost: "Normally just a name and one description. My audit plugin: 332 tokens." },
    { k: "auto", name: "Subagent", file: "agents/", what: "A helper with its own instructions that does one job in a separate conversation and hands back the result.", when: "When the agent decides the job belongs to it.", cost: "Normally just a name and one description; Claude Code estimates about 40 tokens." },
    { k: "auto", name: "Hook", file: "hooks/", what: "A command that runs at set moments: when work starts, before each tool use, when work ends…", when: "Every time that moment comes. Claude Code runs it itself; the model does not decide.", cost: "0. It never enters the conversation; the model cannot see it." },
    { k: "link", name: "MCP tool", file: ".mcp.json", what: "A small program running alongside that gives the agent new tools: query a database, send a message, read a sheet.", when: "Started when work starts; the agent fetches a tool's manual only when it wants that tool.", cost: "Measured: one tool adds 12 tokens, enough for its name." },
    { k: "link", name: "Command", file: "bin/", what: "A command-line tool that comes with the plugin and can be called as soon as it is installed.", when: "When the agent uses it in the terminal.", cost: "0. There is just one more command available." },
    { k: "link", name: "Code helper", file: ".lsp.json", what: "A language service that lets the agent jump to definitions and see errors, like an editor does.", when: "While the agent reads and writes code.", cost: "Not measured; I only read the docs." }
  ];
  const parts = document.getElementById("parts"), card = document.getElementById("card");
  function show(i) {
    const p = P[i];
    card.innerHTML = "<h3></h3><p><span class='k'>What it is</span><span class='a'></span></p><p><span class='k'>When</span><span class='b'></span></p><p><span class='k'>Normal cost</span><span class='c'></span></p>";
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
> **None of the things in the box were invented by plugins.** Skills, MCP, hooks and subagents could all be used on their own before plugins existed. The plugin adds only one thing of its own: the label with the name and version.

### Three generations

Within three years, the word "plugin" changed meaning. Click "Next" to step through:

```steps
{
  "steps": [
    {"title": "2023-03 · ChatGPT plugins", "text": "The first generation: a plugin = a web address + an API description. Developers hosted the service on their own servers, passed a review before listing, and **only ChatGPT could use it**. Early partners included Expedia, Wolfram and Zapier."},
    {"title": "2023-06 · Function calling", "text": "Models learned to fill in a structured form to call a tool, and called tools far more accurately. But every vendor's form was different, so switching models meant rewriting everything."},
    {"title": "2024-04 · The first generation bows out", "text": "ChatGPT plugins were switched off in favor of GPTs, launched in 2023-11. The trouble lay mostly in three places: one platform only, a review gate, and a model that often did not know when to call."},
    {"title": "2024-11 · MCP, a universal socket", "text": "Anthropic open-sourced MCP, which defines how a tool connects to an agent. Write a tool once and any agent can plug it in. OpenAI adopted it in 2025-03."},
    {"title": "2025 · More and more parts", "text": "Claude Code gained commands, hooks and subagents one after another. Each was useful, but you copied them into a project one at a time, and **sharing them was a chore**."},
    {"title": "2025-10 · Plugins + skills", "text": "On 10-09 Claude Code plugins entered public beta: parts packed into one folder, and **a git repository is a marketplace**. On 10-16 Skills launched, and they soon became the part plugins carry most often."},
    {"title": "2025-12 → 2026-01 · Beyond one vendor", "text": "Skills became an open standard that Codex, Gemini CLI and Cursor all read. MCP was donated to the Linux Foundation. On 2026-01-30 Cowork, built for people who do not code, gained plugins too."},
    {"title": "2026 · Standardizing the box too", "text": "In March Codex opened a plugin marketplace with a folder layout copied almost exactly from Claude Code. In August Agent Plugins 1.0, maintained by Amazon, Cursor, Microsoft, OpenAI and Vercel, set out to standardize the box itself; Google joined later."}
  ],
  "caption": "Sources: vendor announcements and contemporary tech press; links are in the in-depth edition."
}
```

The two generations share a name and do almost everything the opposite way:

```html demo height=370 caption="Plugins in 2023 and plugins today"
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
    <h3>2023 · ChatGPT plugins</h3>
    <dl>
      <dt>What is inside</dt><dd>An API on the web</dd>
      <dt>Where it lives</dt><dd>The developer's own server</dd>
      <dt>How it gets listed</dt><dd>Platform review</dd>
      <dt>Who can use it</dt><dd>ChatGPT only</dd>
    </dl>
  </div>
  <div class="col now">
    <h3>Today · agent plugins</h3>
    <dl>
      <dt>What is inside</dt><dd>A folder, mostly manuals</dd>
      <dt>Where it lives</dt><dd>A git repository</dd>
      <dt>How it gets listed</dt><dd>A catalog file in the repo is the marketplace</dd>
      <dt>Who can use it</dt><dd>Skills: many agents; the box still differs by vendor</dd>
    </dl>
  </div>
</div>
```

The biggest change is **what goes in**. A 2023 plugin was "an API, waiting for the model to call it." A plugin today is mostly "a manual that tells the agent how your team does things," with tools packed in as a side item.

---

## What I tested

In one sentence: **open an empty conversation and see how many tokens it carries with and without a plugin; then make the plugin actually run and watch when each part wakes up.**

I used two plugins. One is my public "API relay audit" plugin, which holds a single skill. The other is a lab plugin built for this test, with one skill, one subagent, hooks, one MCP tool and one command. Here is **how many extra tokens each conversation carries** once they are installed:

```chart
{
  "type": "bars",
  "fmt": {"digits": 0},
  "rows": [
    {"label": "Hooks, commands", "sub": "never enter the conversation", "value": 0, "color": "gray"},
    {"label": "One MCP tool", "sub": "just its name", "value": 12, "color": "gray"},
    {"label": "One skill + one subagent", "sub": "lab plugin", "value": 84, "color": "gray"},
    {"label": "Audit plugin", "sub": "one 17 KB skill", "value": 332, "color": "seal"}
  ],
  "caption": "In tokens. An empty conversation itself is about 42,530 tokens; each case was run twice and differed by at most 5 tokens."
}
```

The audit plugin's manual is 17 KB of text, yet installing it added only 332 tokens: **what normally sits in the conversation is a table of contents**, each part's name and one-line description. The full text is read only when it is needed.

### One run: when does each part wake up

I said "lab hello" to the lab plugin and read the logs:

```steps
{
  "steps": [
    {"title": "Work starts", "text": "The hook fires once; the small MCP program is started and reports which tools it has. The conversation gains only a few names."},
    {"title": "Picking the skill", "text": "I had installed a second plugin that also has a skill called hello. The agent read the descriptions and picked the lab plugin's one; each plugin keeps its own names, so the two do not collide."},
    {"title": "Only now is the manual read", "text": "The skill's full text enters the conversation at this step, and the agent replies with a line as it says."},
    {"title": "Before using a tool, fetch its manual", "text": "The manual tells it to call the MCP tool. How to use that tool is not normally in the conversation, so the agent looks it up first, then calls it."},
    {"title": "The program answers", "text": "The program alongside gets the request and replies with one line, \"stamp ok\", which the agent passes on to me."},
    {"title": "The hook is there throughout", "text": "The hook fires before every tool use: 3 times in this run, and not a word of it shows in the conversation."}
  ],
  "caption": "Measured 2026-10-30. The logs and the lab plugin's source are in the in-depth edition."
}
```

---

## What it means

**First: installing more plugins costs little room; the hard part is the one-line description.** Each part normally keeps only a name and a description, so ten plugins add up to a few thousand tokens. The flip side: **the agent decides whether to use your part from that one line**. If the description is vague, the best manual in the world never gets called.

**Second: the manual travels; the box does not, yet.** Skills are already a format many agents read, but the plugin box is still different from vendor to vendor. I gave Claude Code a package laid out in the vendor-neutral format (Agent Plugins 1.0), and it recognized only the skill:

```html demo height=180 caption="One package in the vendor-neutral layout: what Claude Code 2.1.310 picked up"
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
  <div class="g ok"><b>Skill</b><i>✓</i><span>Installed<br>and working</span></div>
  <div class="g no"><b>MCP tool</b><i>✗</i><span>Not installed<br>different file name</span></div>
  <div class="g no"><b>Name label</b><i>✗</i><span>Not read<br>folder name used</span></div>
</div>
```

If you want people to use your work across different agents, write the skill well first; it travels farthest.

> [!WARNING]
> **Installing a plugin means letting someone else's code run on your computer.** Hooks run on their own when their moment comes and do not ask each time (in my test they fired 3 times in one run); the MCP program starts as soon as work starts; the commands it brings work right away. Install only from sources you trust, and spend a minute reading its hooks and tool config before you do.

**Third: people who can write a manual can now make a plugin.** In 2023 a plugin meant writing a service and passing a review; today a plugin can be a single manual. I turned two audit workflows from my job into plugins for colleagues, and apart from the manuals they are mostly a few existing scripts. The role-based plugins for Cowork (sales, legal, finance) follow the same idea: **writing down how your team works is worth more than writing another API.**

---

## Want the details

The in-depth edition, [Inside an Agent Plugin](/en/posts/agent-plugins-inside/), covers what this one leaves out:

- One table of every part: who runs it, when it loads, whether it enters the model's context
- The full log of that "lab hello" from input to output, including every message the MCP program sent and received
- Why same-named skills in two plugins do not collide, and how versions and marketplaces are written
- What the vendor-neutral format, Claude Code and Codex each recognize, and when to build a plugin versus ship a single skill
- The lab plugin's complete source and the commands to reproduce it

The previous post in this series, [Agents That Check Their Own Work and Tidy Their Own Memory](/en/posts/managed-agents-outcomes-dreaming/), is about something else: how an agent checks its own work and tidies its own memory.

**In one line: a plugin teaches an agent nothing new; it puts what the agent knows into a box you can hand to someone else.**
