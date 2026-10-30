---
title: "Same Chip, Half the Speed: NVIDIA's Half-Rate Tensor Cores, Explained in Pictures"
short: Half-rate tensor cores, explained
seoTitle: NVIDIA's Half-Rate Tensor Cores, Explained
description: NVIDIA makes the same chip into gaming cards and professional cards, and on the gaming cards the tensor cores, the part built for AI math, ship set to half speed. In October 2026 an open-source project called gpu-unlock lifted that lock. This is the illustrated beginner edition. No registers and no code; just where the story comes from, where the lock sits, what I measured on my own laptop, and what it means for everyone else.
date: 2026-10-30
updated: 2026-10-30
glyph: tensor-dial
lead: In the gaming GPU you bought, the part that does AI math **spends half its time waiting**. It is not broken and it is not too slow; it was set that way at the factory, and full speed is kept for professional cards that cost a good deal more. In October 2026 someone unlocked it, and I tried it on my own laptop. **On the same power, AI math ran about 1.6 times as fast.** This post tells the story in pictures; the details are in the in-depth edition.
tags:
  - GPU
  - NVIDIA
  - Tensor Cores
  - Local AI
  - Beginner
series: Local AI Hardware, Tested
seriesOrder: 2
categories:
  - Tinkering
---

> [!NOTE]
> This is the **illustrated beginner edition**; no GPU knowledge needed. For the registers, the boot sequence, the benchmark script and the full data, read the in-depth edition, [The Half-Speed Tensor Core](/en/posts/nvidia-tensor-half-speed-unlock/).

```chart
{
  "type": "stats",
  "items": [
    {"label": "AI matrix math", "value": "×1.65", "note": "BF16 matrix multiply, before vs after", "color": "seal"},
    {"label": "Training a small model", "value": "+40%", "note": "tokens processed per second", "color": "seal"},
    {"label": "Power", "value": "105 W", "note": "the same before and after", "color": "gray"}
  ],
  "caption": "My RTX 3060 laptop, measured 2026-10-29."
}
```

---

## The backstory: one chip, two price tags

NVIDIA makes **the same chip** into two products: gaming cards for players (GeForce) and professional cards for companies. The professional ones cost a good deal more, and part of the gap is not extra hardware. **Some abilities are held back on the gaming card at the factory.**

This time the held-back part is the **tensor core**, the part of a GPU built to multiply matrices. Almost everything today's AI does, from training models to drawing images to reading a prompt, is matrix multiplication.

### Where the lock sits: the dispatcher hands out work every other beat

The tensor core itself can run at full speed. What was tampered with is the **dispatcher** in front of it. On every clock cycle (one "beat") it could hand the tensor core an instruction; on gaming cards it was changed to **one instruction every two beats**. Flip the buttons below to compare:

```html demo height=300 caption="Over the same 8 beats, the factory setting gives the tensor core only 4 beats of work (click to switch)"
<style>
  .wrap { width: 100%; max-width: 560px; padding: 16px; font: 14px/1.5 system-ui, sans-serif; color: var(--ink); }
  .tabs { display: flex; gap: 8px; margin-bottom: 18px; }
  .tabs button { flex: 1; font: inherit; padding: 8px 10px; border-radius: 8px; cursor: pointer;
    border: 1.5px solid var(--line); background: var(--paper); color: var(--ink-2); }
  .tabs button[aria-pressed="true"] { border-color: var(--seal); color: var(--seal); font-weight: 600; }
  .row { display: grid; grid-template-columns: 76px repeat(8, 1fr); gap: 5px; align-items: center; margin-bottom: 8px; }
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
    <button id="lock" aria-pressed="true">🔒 Factory setting</button>
    <button id="free" aria-pressed="false">🔓 Unlocked</button>
  </div>
  <div class="row beat"><b>Beat</b></div>
  <div class="row send"><b>Dispatcher</b></div>
  <div class="row core"><b>Tensor core</b></div>
  <p class="sum">Out of 8 beats, the tensor core works <strong id="n">4</strong></p>
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
      cells.core[i].textContent = on ? "■" : "·";
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

So the lock **does not make the part slower; it leaves it idle half the time**. When the same chip becomes a professional card, the dispatcher hands out work on every beat and the tensor core runs at full speed.

### Where the key came from

This back-and-forth, the vendor holding something back and the community prying it loose, has gone several rounds. Click "Next" to step through:

```steps
{
  "steps": [
    {"title": "One chip, two prices", "text": "NVIDIA uses firmware and drivers to split one chip generation into tiers: gaming cards are cheaper with some abilities held back; professional cards cost more with everything on."},
    {"title": "Lock one: the mining limiter", "text": "In 2021, with miners buying up gaming cards, NVIDIA added a **mining limiter** to RTX 30. First one of its own beta drivers lifted it by accident, then third-party software bypassed it completely, and in the end NVIDIA removed it from the driver itself."},
    {"title": "Lock two: mining cards", "text": "On CMP cards, sold only to miners, firmware locked away memory and compute. The community found a flaw in **the firmware a GPU runs as it boots** and set them free."},
    {"title": "Lock three: half-rate tensor cores", "text": "On 2026-10-18 someone used **the same flaw** on a different lock: the half-rate tensor core. The project, gpu-unlock, reached Hacker News on 10-24 and had about 12,000 stars by 10-29."},
    {"title": "I tried it on my laptop", "text": "On 10-29 I installed it on an RTX 3060 laptop and ran the same work before and after. The results are in the next section."},
    {"title": "New cards: the lock stays, the key is gone", "text": "RTX 50 boots a different way, so the flaw no longer applies. Third parties have measured the RTX 5090: **the half rate is still there**; no one can lift it."}
  ],
  "caption": "Sources: the project's README, Hacker News and press coverage at the time; links are in the in-depth edition."
}
```

> [!TIP]
> None of these patches ever turned a cheap card into an expensive one: no extra memory, no extra hardware. All they do is give back **what the same chip already had and was held back from using**.

---

## What I tested

In one sentence: **on the same laptop, run the same AI math before and after installing the key, see how much faster it got, and check that the kinds of math that were never locked did not move.**

The three locked half-precision formats (the ones AI training and image models use) all got about 1.6 times as fast. The two formats that were never locked served as controls and did not budge, which shows the gain really comes from the unlock and not from something else:

```chart
{
  "type": "dumbbell",
  "fmt": {"digits": 1},
  "from": "Before",
  "to": "After",
  "rows": [
    {"label": "BF16", "sub": "locked", "from": 25.4, "to": 41.9},
    {"label": "FP16", "sub": "locked", "from": 25.5, "to": 41.7},
    {"label": "TF32", "sub": "locked", "from": 12.6, "to": 20.4},
    {"label": "FP32", "sub": "control: never locked", "from": 6.5, "to": 6.5}
  ],
  "caption": "RTX 3060 laptop, in TFLOPS: trillions of operations per second (higher is better). The other control, INT8, was 74.5 both times; it is off this scale, so it is not drawn."
}
```

On a real job: I trained a small model and it processed 40% more tokens per second, and the trained result came out the same as before the unlock.

```chart
{
  "type": "dumbbell",
  "fmt": {"digits": 0},
  "from": "Before",
  "to": "After",
  "rows": [
    {"label": "Training a small model", "sub": "6-layer Transformer, BF16", "from": 31457, "to": 44116}
  ],
  "caption": "In tokens processed per second. The final loss differed by 0.00001 before and after, the same order as the normal wobble between repeated runs."
}
```

### Why not twice as fast

Twice the work per beat, yet only about 1.6 times the speed: the difference is **power**. The laptop's GPU tops out at about 105 W, and it sat at that line both before and after. With twice the work on every beat, the same power cannot hold the old clock speed, so the clock dropped by about 17%:

```chart
{
  "type": "stats",
  "items": [
    {"label": "Work per beat", "value": "×2", "note": "the dispatcher hands out every beat"},
    {"label": "Clock speed", "value": "×0.83", "note": "not enough power, 1760 → 1470 MHz", "color": "gray"},
    {"label": "Actually faster", "value": "×1.65", "note": "2 × 0.83 ≈ 1.66", "color": "seal"}
  ]
}
```

Desktop cards with more power to spare get closer to double. The project's README reports +87% on a desktop RTX 3060; I did not measure that one.

---

## What it means

**First: people running AI locally get a free chunk of speed, and gamers get nothing.** Only the math AI relies on was unlocked, so:

```html demo height=350 caption="What gets faster, and what does not"
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
    <h3>Faster</h3>
    <ul>
      <li>Training and fine-tuning <small>I measured +40%</small></li>
      <li>AI image generation <small>per the README</small></li>
      <li>An LLM reading a long prompt <small>per the README</small></li>
    </ul>
  </div>
  <div class="box no">
    <h3>Not faster</h3>
    <ul>
      <li>Game frame rates</li>
      <li>How fast an LLM writes its answer <small>limited by memory, not compute</small></li>
      <li>Video memory <small>6 GB stays 6 GB</small></li>
    </ul>
  </div>
</div>
```

**Second: with the same chip, you may not be getting all of it.** A GPU's price depends not only on its parts but on how much of them is switched on. This time it was the tensor cores that came to light; before that it was mining speed, and the memory on mining cards. Next time you read a GPU benchmark, it is worth asking: is this the whole chip, or the factory setting?

**Third: this key only fits older cards.** The new RTX 50 changed how it boots, closing the road in advance:

```html demo height=200 caption="Which generations can be unlocked (Linux only)"
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
  <div class="g ok"><b>RTX 20</b><i>🔓</i><span>one format only<br>experimental</span></div>
  <div class="g ok"><b>RTX 30</b><i>🔓</i><span>supported<br>the one I tested</span></div>
  <div class="g ok"><b>RTX 40</b><i>🔓</i><span>experimental</span></div>
  <div class="g no"><b>RTX 50</b><i>🔒</i><span>lock stays<br>key is gone</span></div>
</div>
```

> [!WARNING]
> It is not overclocking: clock limits, power limits and voltage are untouched, and if the unlock fails the GPU just works as before. On a laptop, though, the discrete GPU has to stay powered all the time, or the unlock is reset whenever it sleeps, so **battery life gets worse and the machine runs hotter**. Those details and how to undo it are in the in-depth edition.

---

## Want the details?

The in-depth edition, [The Half-Speed Tensor Core](/en/posts/nvidia-tensor-half-speed-unlock/), covers what this one leaves out:

- which register holds the lock, and why only those three formats are capped
- how it opens the lock in the boot window, before the GPU driver loads
- why RTX 50 cannot be unlocked, and how two third parties showed the cap is still there
- every measurement, the clock and power logs, and a benchmark script you can run yourself

The previous post in this series, [Is a Mac Actually Good for Running Large Language Models?](/en/posts/mac-for-local-llms/), asks a different question: which few numbers decide whether a local LLM is fast.

**In one line: the tensor core did not get faster; it just stopped waiting.**
