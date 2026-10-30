---
title: 同一块芯片，为什么你的显卡只给一半——图解 NVIDIA 的半速张量核
short: 图解半速张量核
seoTitle: 图解 NVIDIA 消费显卡的半速张量核
description: NVIDIA 把同一块芯片做成游戏卡和专业卡，游戏卡上专做 AI 计算的张量核被出厂设成了半速。2026 年 10 月，一个叫 gpu-unlock 的开源项目把这把锁解开了。这是入门图解版：不讲寄存器和代码，只讲这件事从哪来、锁在哪、我在自己的笔记本上测出了什么、对普通人意味着什么。
date: 2026-10-30
updated: 2026-10-30
glyph: tensor-dial
lead: 你买的游戏显卡里，专门算 AI 的那部分零件，**有一半时间在空等**。不是它坏了，也不是它不够快，而是厂商在出厂时就这么设好的，满速留给了贵一截的专业卡。2026 年 10 月有人把这把锁解开了，我在自己的笔记本上试了一下：**同样的电，AI 计算快了约 1.6 倍**。这篇用图讲清来龙去脉，细节在详细版里。
tags:
  - 显卡
  - NVIDIA
  - 张量核
  - 本地 AI
  - 入门
series: 本地 AI 硬件实测
seriesOrder: 2
categories:
  - 折腾记录
---

> [!NOTE]
> 这是**入门图解版**，不需要懂显卡。想看寄存器、开机流程、测速脚本和完整数据，看详细版[《半速的张量核》](/posts/nvidia-tensor-half-speed-unlock/)。

```chart
{
  "type": "stats",
  "items": [
    {"label": "AI 矩阵计算", "value": "×1.65", "note": "BF16 矩阵乘法，解锁前后", "color": "seal"},
    {"label": "训练小模型", "value": "+40%", "note": "每秒处理的字数", "color": "seal"},
    {"label": "功耗", "value": "105 W", "note": "前后一样，没多吃电", "color": "gray"}
  ],
  "caption": "我的 RTX 3060 笔记本，2026-10-29 实测。"
}
```

---

## 来龙去脉：一块芯片，两种卖法

NVIDIA 会把**同一块芯片**做成两种产品：卖给玩家的游戏卡（GeForce），和卖给公司的专业卡。专业卡贵一截，差价里有一部分不是因为它多了零件，而是**游戏卡上有些能力在出厂时被按住了**。

被按住的这次，是**张量核**：显卡里专门做矩阵乘法的零件。今天的 AI，不管是训练模型、出图还是读提示词，绝大部分时间都在做矩阵乘法。

### 锁在哪：发号员每两拍才递一次活

张量核本身完全能跑满速。被动了手脚的是它前面的**发号员**：显卡每个时钟周期（一「拍」）本来都能给张量核递一条指令，游戏卡上被改成了**每两拍才递一条**。点下面的按钮对比：

```html demo height=300 caption="同样 8 拍，出厂设置下张量核只干了 4 拍的活（点按钮切换）"
<style>
  .wrap { width: 100%; max-width: 560px; padding: 16px; font: 14px/1.5 system-ui, sans-serif; color: var(--ink); }
  .tabs { display: flex; gap: 8px; margin-bottom: 18px; }
  .tabs button { flex: 1; font: inherit; padding: 8px 10px; border-radius: 8px; cursor: pointer;
    border: 1.5px solid var(--line); background: var(--paper); color: var(--ink-2); }
  .tabs button[aria-pressed="true"] { border-color: var(--seal); color: var(--seal); font-weight: 600; }
  .row { display: grid; grid-template-columns: 64px repeat(8, 1fr); gap: 5px; align-items: center; margin-bottom: 8px; }
  .row b { font-weight: 600; font-size: 13px; color: var(--ink-2); }
  .cell { height: 34px; border-radius: 6px; display: grid; place-items: center; font-size: 13px; }
  .send .cell { background: none; border: 1.5px dashed var(--line); color: var(--ink-3); }
  .send .cell.on { border: 1.5px solid var(--seal); color: var(--seal); font-weight: 700; }
  .core .cell { background: var(--paper-2); color: var(--ink-3); }
  .core .cell.on { background: var(--seal); color: var(--card); }
  .beat .cell { height: auto; color: var(--ink-3); font-size: 12px; }
  .sum { margin-top: 14px; font-size: 15px; }
  .sum strong { color: var(--seal); font-size: 20px; }
  @media (prefers-reduced-motion: no-preference) {
    .cell.on { animation: pop .35s both; animation-delay: calc(var(--i) * 90ms); }
    @keyframes pop { from { opacity: 0; transform: scale(.6); } }
  }
</style>
<div class="wrap">
  <div class="tabs">
    <button id="lock" aria-pressed="true">🔒 出厂设置</button>
    <button id="free" aria-pressed="false">🔓 解锁后</button>
  </div>
  <div class="row beat"><b>第几拍</b></div>
  <div class="row send"><b>发号员</b></div>
  <div class="row core"><b>张量核</b></div>
  <p class="sum">8 拍里，张量核在干活：<strong id="n">4</strong> 拍</p>
</div>
<script>
  const rows = { beat: document.querySelector(".beat"), send: document.querySelector(".send"), core: document.querySelector(".core") };
  const cells = { beat: [], send: [], core: [] };
  for (let i = 0; i < 8; i++) {
    for (const k of ["beat", "send", "core"]) {
      const c = document.createElement("span");
      c.className = "cell";
      c.style.setProperty("--i", i);
      if (k === "beat") c.textContent = i + 1;
      rows[k].append(c);
      cells[k].push(c);
    }
  }
  function show(locked) {
    let n = 0;
    for (let i = 0; i < 8; i++) {
      const on = !locked || i % 2 === 0;
      for (const k of ["send", "core"]) {
        const c = cells[k][i];
        c.classList.remove("on");
        void c.offsetWidth;
        c.classList.toggle("on", on);
      }
      cells.send[i].textContent = on ? "▶" : "";
      cells.core[i].textContent = on ? "算" : "等";
      if (on) n++;
    }
    document.getElementById("n").textContent = n;
    document.getElementById("lock").setAttribute("aria-pressed", locked);
    document.getElementById("free").setAttribute("aria-pressed", !locked);
  }
  document.getElementById("lock").onclick = () => show(true);
  document.getElementById("free").onclick = () => show(false);
  show(true);
</script>
```

所以这把锁**不是让零件变慢，而是让它一半时间没活干**。同一块芯片做成专业卡时，发号员每拍都递，张量核就是满速。

### 钥匙是怎么来的

这类「厂商按住、社区解开」的拉锯，前后已经好几轮了。点「下一步」往下看：

```steps
{
  "steps": [
    {"title": "同一块芯片，两种价钱", "text": "NVIDIA 用固件和驱动给同一代芯片分档：游戏卡便宜，一些能力被按住；专业卡贵，能力全开。"},
    {"title": "第一把锁：挖矿限速", "text": "2021 年矿工抢游戏卡，NVIDIA 给 RTX 30 加了**挖矿限速**。先是自家一版测试驱动意外把它解开，后来被第三方软件完全绕过，最后 NVIDIA 自己在驱动里删掉了。"},
    {"title": "第二把锁：矿卡", "text": "专卖给矿工的 CMP 矿卡，显存和算力被固件锁住。社区在显卡**开机时跑的一段固件**里找到一个漏洞，把它们放了出来。"},
    {"title": "第三把锁：半速张量核", "text": "2026-10-18，有人用**同一个漏洞**去开另一把锁：张量核的半速。项目叫 gpu-unlock，10-24 上了 Hacker News，到 10-29 约 1.2 万星。"},
    {"title": "我拿自己的笔记本试了", "text": "10-29，我在一台 RTX 3060 笔记本上装上它，开机前后各跑一遍同样的计算。结果在下一节。"},
    {"title": "新卡：锁还在，钥匙没了", "text": "RTX 50 换了一套开机流程，那个漏洞用不上了。第三方测过 RTX 5090，**半速还在**，只是没人解得开。"}
  ],
  "caption": "来源：项目说明、Hacker News 和当年的科技媒体报道，链接都在详细版里。"
}
```

> [!TIP]
> 这些补丁从来不是「把便宜卡变成贵卡」：显存不会变多，零件也不会变多。它们做的只是把**同一块芯片本来就有、被按住的能力**按回去。

---

## 我做了什么测试

一句话：**同一台笔记本，装钥匙前后各跑一遍同样的 AI 计算，看快了多少，再看本来就没锁的那几种计算有没有跟着变。**

被锁的三种半精度计算（AI 训练和出图常用的格式）都快了约 1.6 倍；两种本来没锁的当对照组，一点没动。对照组不变，说明快出来的这部分确实来自解锁，不是别的原因：

```chart
{
  "type": "dumbbell",
  "fmt": {"digits": 1},
  "from": "解锁前",
  "to": "解锁后",
  "rows": [
    {"label": "BF16", "sub": "被锁的", "from": 25.4, "to": 41.9},
    {"label": "FP16", "sub": "被锁的", "from": 25.5, "to": 41.7},
    {"label": "TF32", "sub": "被锁的", "from": 12.6, "to": 20.4},
    {"label": "FP32", "sub": "对照：本来没锁", "from": 6.5, "to": 6.5}
  ],
  "caption": "RTX 3060 笔记本，单位 TFLOPS：每秒能做多少万亿次运算（越高越好）。另一个对照组 INT8 前后都是 74.5，刻度差太多没画进来。"
}
```

放到真实任务上：我训练了一个小模型，每秒处理的字数（token）多了四成，最后训出来的结果和解锁前一样。

```chart
{
  "type": "dumbbell",
  "fmt": {"digits": 0},
  "from": "解锁前",
  "to": "解锁后",
  "rows": [
    {"label": "训练一个小模型", "sub": "6 层 Transformer，BF16", "from": 31457, "to": 44116}
  ],
  "caption": "单位：每秒处理的 token 数。训练结束时的 loss 前后相差 0.00001，和连跑几次的正常浮动一个量级。"
}
```

### 为什么不是翻倍

活多了一倍，速度却只涨了约 1.6 倍，差在**电**上。笔记本的显卡最多吃约 105 W，解锁前后都顶在这条线上。每一拍干的活变成两倍，同样的电就撑不住原来的频率，频率降了约 17%：

```chart
{
  "type": "stats",
  "items": [
    {"label": "每拍干的活", "value": "×2", "note": "发号员每拍都递了"},
    {"label": "频率", "value": "×0.83", "note": "电不够，1760 → 1470 MHz", "color": "gray"},
    {"label": "实际快了", "value": "×1.65", "note": "2 × 0.83 ≈ 1.66", "color": "seal"}
  ]
}
```

电更充足的台式卡会更接近翻倍。项目说明里，台式 RTX 3060 快了 87%，这个数不是我测的。

---

## 意味着什么

**影响一：本地跑 AI 的人白捡了一截速度，打游戏的人什么也没变。** 被解开的只有 AI 常用的那几种计算，所以：

```html demo height=350 caption="会变快的，和不会变快的"
<style>
  .two { width: 100%; max-width: 560px; padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    font: 14px/1.5 system-ui, sans-serif; color: var(--ink); }
  .box { border-radius: 10px; padding: 12px 14px; border: 1.5px solid var(--line); background: var(--paper); }
  .box.yes { border-color: var(--seal); }
  .box h3 { margin: 0 0 8px; font-size: 15px; }
  .yes h3 { color: var(--seal); }
  .no h3 { color: var(--ink-3); }
  .box ul { margin: 0; padding-left: 18px; }
  .box li { margin: 4px 0; }
  .box small { color: var(--ink-3); }
  @media (max-width: 420px) { .two { grid-template-columns: 1fr; } }
</style>
<div class="two">
  <div class="box yes">
    <h3>会变快</h3>
    <ul>
      <li>训练、微调模型 <small>我测：+40%</small></li>
      <li>AI 出图 <small>项目说明</small></li>
      <li>大模型读长提示词 <small>项目说明</small></li>
    </ul>
  </div>
  <div class="box no">
    <h3>不会变快</h3>
    <ul>
      <li>游戏帧数</li>
      <li>大模型一个字一个字往外吐的速度 <small>卡在显存，不在算力</small></li>
      <li>显存大小 <small>6 GB 还是 6 GB</small></li>
    </ul>
  </div>
</div>
```

**影响二：同一块芯片，你拿到的未必是全部。** 显卡的价格不只按零件定，也按「打开了多少」定。这次被看见的是张量核，以前是挖矿速度、是矿卡的显存。下次看显卡跑分，可以多问一句：这是芯片的全部，还是出厂设置？

**影响三：这把钥匙只对老卡有用。** 新出的 RTX 50 把开机流程换了，路被提前堵死了：

```html demo height=200 caption="各代显卡能不能解开（只支持 Linux）"
<style>
  .gen { width: 100%; max-width: 560px; padding: 16px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
    font: 14px/1.4 system-ui, sans-serif; color: var(--ink); }
  .g { border-radius: 10px; padding: 12px 8px; text-align: center; border: 1.5px solid var(--line); background: var(--paper); }
  .g b { display: block; font-size: 16px; }
  .g i { display: block; font-style: normal; font-size: 26px; margin: 4px 0; }
  .g span { font-size: 12px; color: var(--ink-3); }
  .g.ok { border-color: var(--seal); }
  .g.no { background: var(--paper-2); }
  @media (max-width: 420px) { .gen { grid-template-columns: repeat(2, 1fr); } }
</style>
<div class="gen">
  <div class="g ok"><b>RTX 20</b><i>🔓</i><span>只解一种格式<br>实验性</span></div>
  <div class="g ok"><b>RTX 30</b><i>🔓</i><span>稳定支持<br>我测的这代</span></div>
  <div class="g ok"><b>RTX 40</b><i>🔓</i><span>实验性</span></div>
  <div class="g no"><b>RTX 50</b><i>🔒</i><span>锁还在<br>钥匙没了</span></div>
</div>
```

> [!WARNING]
> 它不是超频，不碰频率、功耗和电压，解锁失败时显卡照常工作。但在笔记本上，独显得一直通电，否则一休眠就被复位，**续航会变差、机器更热**。这些细节和回退方法在详细版里。

---

## 想看细节

详细版[《半速的张量核》](/posts/nvidia-tensor-half-speed-unlock/)讲了这些，这篇都没展开：

- 锁具体在哪个寄存器、为什么只有那三种格式被锁
- 它怎么赶在显卡驱动之前、在开机的那个窗口里把锁打开
- RTX 50 为什么解不了，两家第三方怎么测出锁还在
- 全部测量数字、频率和功耗记录，以及你可以自己跑的测速脚本

同系列的上一篇[《Mac 到底适不适合跑大模型？》](/posts/mac-for-local-llms/)讲的是另一个问题：决定本地大模型快不快的，其实是哪几个数。

**一句话收尾：张量核没有变快，它只是终于不用等了。**
