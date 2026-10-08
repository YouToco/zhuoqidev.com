import type { Lang } from "../i18n";
import camera from "../assets/models/argus-story-camera.json";
import pins from "../assets/models/argus-story-pins.json";

// The clay scene at the top of the Argus project page: one real search through the sample video,
// told in six steps. The model, its poster render and these pin coordinates come from
// tools/models/argus-story.py; the step groups (step0..step5) and pin_* names match that script.

export type PinName = keyof typeof pins;

type Step = {
  title: string;
  body: string;
  /** The tool call(s) Argus made in this step of the real run, shown under the step. */
  call?: string;
  /** Labels shown on the 3D scene while this step is active, keyed by pin. */
  labels: Partial<Record<PinName, string>>;
};

/** Where each step's number sits on the poster (the picture shown before, or instead of, the 3D scene). */
export const posterMarks: PinName[] = ["s0_question", "s1_argus", "s2_in", "s3_tray", "s4_answer", "s5_cloud"];

/** Time marks along the film strip; they stay on from the first step. */
export const ticks: [PinName, string][] = [
  ["s0_t0", "0:00"],
  ["s0_t60", "1:00"],
  ["s0_t120", "2:00"],
  ["s0_t180", "3:00"],
];

/** The full record of the run the scene follows (tool calls, answer, frame counts). */
export const runUrl = "https://github.com/YouToco/zhuoqidev.com/blob/main/tools/models/argus-story-run.json";

export { camera, pins };

export const story: Record<
  Lang,
  {
    kicker: string;
    heading: string;
    sub: string;
    skip: string;
    alt: string;
    run: [string, string, string];
    credit: string;
    script: string;
    more: [string, string];
    steps: Step[];
  }
> = {
  zh: {
    kicker: "作品 · Argus",
    heading: "Argus 是怎么看完一段长视频的",
    sub: "往下滚，一步步看它找答案；拖动场景可以转着看。",
    skip: "跳过，直接看项目介绍 ↓",
    alt:
      "黏土风格的小场景：浏览器窗口里铺着一卷胶片（示例视频），长满眼睛的 Argus 站在旁边，抽出来的帧立在胶片上方；" +
      "红色出现和消失的两头各有三层越来越密的小帧；一个淡紫色的子代理在看后半段；Argus 身边的托盘里放着最近三批帧和一张字条，旁边一张便签；" +
      "一张写着 10.0s – 25.0s 的回答卡用红线钉回胶片上的两帧；一根线从 Argus 连到窗口外代表你自己配置的模型的云，线上有小图和一张指令卡。",
    run: ["场景按 2026-10-08 用 DeepSeek 真跑的一次摆放（", "完整调用记录", "），每次跑，过程会有出入。"],
    credit: "模型是 agent 经 Blender MCP 写脚本建的。",
    script: "建模脚本",
    more: ["这几步背后的 Agent 循环和 8 个工具", "#架构亮点"],
    steps: [
      {
        title: "一段视频，一个问题",
        body: "拿 Argus 自带的 3 分钟示例视频来说：拖进来，问一句「红色的东西什么时候出现？」它先读视频信息：179.6 秒，每秒 10 帧。",
        call: "get_video_info()",
        labels: { s0_question: "「红色的东西什么时候出现？」" },
      },
      {
        title: "先粗扫，交给模型看",
        body: "Argus 是一个长满眼睛的 agent。它每 10 秒抽一帧，缩成小图，沿这根线发给你配置的模型；模型看完回一条指令，告诉它下一步抽哪段、抽多密。这一轮在 10 秒和 20 秒的图里看到了红色。",
        call: "extract_frames(0–180 秒, 每 10 秒) → 18 张",
        labels: { s1_argus: "Argus", s1_scan: "抽出来的帧", s1_model: "你配置的模型" },
      },
      {
        title: "在两头一层层抽密",
        body: "红色在 0–10 秒之间出现、20–30 秒之间消失。它在这两段每 1 秒抽一帧，再缩到每 0.5 秒、每 0.1 秒，把出现和消失各卡到一帧上。",
        call: "extract_frames(0–12 秒、18–32 秒, 每 1 秒) → 每 0.5 秒 → 每 0.1 秒",
        labels: { s2_in: "出现", s2_out: "消失" },
      },
      {
        title: "派帮手，管好上下文",
        body: "30 秒以后还有没有红色？它派一个子代理去看 30–180 秒。子代理自己抽了 64 张图，只交回一段文字结论（没有红色），那些图不进主 agent 的上下文。主 agent 也只留最近 3 批图：第 4 批进来时，最早那批粗扫图换成了一行字，要用时可以再抽回来。",
        call: "spawn_subagent(30–180 秒) → 「没有红色」",
        labels: { s3_sub: "子代理：「没有红色」", s3_tray: "上下文：只留最近 3 批图" },
      },
      {
        title: "记下来，回答带证据",
        body: "它先把结论记成一条笔记，之后再问相关的问题不用重看；然后回答：10.0 秒出现，25.0 秒消失。两个时间都钉回抽过的帧（10.0 秒是第一帧有红色，24.9 秒是最后一帧），在 Argus 里点时间戳，播放器就跳到那一刻。",
        call: "remember(0–180 秒, 「红色物体」)",
        labels: { s4_answer: "回答", s4_pins: "证据帧", s4_note: "笔记" },
      },
      {
        title: "全在你的浏览器里",
        body: "视频文件不离开你的浏览器，也没有后端。这一次经这根线发出去的，是 129 张缩小过的帧（宽 300–640 像素：主 agent 65 张，子代理 64 张）和文字，收件方是你自己配置的模型（OpenAI、Anthropic、Gemini 或兼容接口）；API Key 只存在本机。",
        labels: { s5_browser: "你的浏览器", s5_cloud: "你配置的模型", s5_wire: "129 张小图 + 文字" },
      },
    ],
  },
  en: {
    kicker: "Project · Argus",
    heading: "How Argus watches a long video",
    sub: "Scroll to follow one search step by step; drag the scene to turn it.",
    skip: "Skip to the write-up ↓",
    alt:
      "A small clay scene: a film strip (the sample video) lies in a browser window; Argus, covered in eyes, stands beside it, " +
      "with the frames it pulled standing above the strip; over both edges of the red span hang three rows of ever denser small frames; " +
      "a lavender sub-agent watches the second half; a tray next to Argus holds the last three batches of frames and a slip of text, " +
      "with a sticky note beside it; an answer card reading 10.0s – 25.0s is tied by red threads to two frames on the strip; " +
      "a wire runs from Argus to a cloud outside the window that stands for the model you configured, carrying small frames and an instruction card.",
    run: ["The scene follows one real run with DeepSeek on 2026-10-08 (", "full call record", "); every run goes a little differently."],
    credit: "An agent modelled it by writing a Blender script over Blender MCP.",
    script: "The script",
    more: ["The agent loop and the 8 tools behind these steps", "#architecture-highlights"],
    steps: [
      {
        title: "One video, one question",
        body: "Take the 3-minute sample video that ships with Argus: drop it in and ask, “When does something red show up?” It reads the video's details first: 179.6 seconds, 10 frames a second.",
        call: "get_video_info()",
        labels: { s0_question: "“When does something red show up?”" },
      },
      {
        title: "A skim, handed to the model",
        body: "Argus is an agent covered in eyes. It pulls one frame every 10 seconds, shrinks them and sends them up this wire to the model you configured; the model looks and replies with an instruction: which span to pull next, and how densely. This round, red shows up in the frames at 10 s and 20 s.",
        call: "extract_frames(0–180 s, every 10 s) → 18 frames",
        labels: { s1_argus: "Argus", s1_scan: "Pulled frames", s1_model: "Your model" },
      },
      {
        title: "Closing in on both edges",
        body: "Red appears somewhere in 0–10 s and is gone somewhere in 20–30 s. Around both, it pulls a frame every second, then every 0.5 s, then every 0.1 s, until each edge sits on a single frame.",
        call: "extract_frames(0–12 s, 18–32 s, every 1 s) → every 0.5 s → every 0.1 s",
        labels: { s2_in: "Appears", s2_out: "Gone" },
      },
      {
        title: "A helper, and a tidy context",
        body: "Is there more red after 30 s? It sends a sub-agent to watch 30–180 s. The sub-agent pulls 64 frames of its own and hands back a short written finding (no red); its frames never enter the main agent's context. The main agent keeps only its last 3 batches of frames too: when the fourth came in, the first batch (the skim) became a line of text, and those frames can be pulled again when needed.",
        call: "spawn_subagent(30–180 s) → “no red”",
        labels: { s3_sub: "Sub-agent: “no red”", s3_tray: "Context: last 3 batches" },
      },
      {
        title: "A note, then an answer with evidence",
        body: "It writes the finding down as a note, so a follow-up question needs no second look, then answers: red appears at 10.0 s and is gone at 25.0 s. Both times are pinned to frames it pulled (10.0 s is the first frame with red, 24.9 s the last); click a timestamp in Argus and the player jumps there.",
        call: "remember(0–180 s, “red object”)",
        labels: { s4_answer: "Answer", s4_pins: "Evidence frames", s4_note: "Note" },
      },
      {
        title: "All inside your browser",
        body: "The video file never leaves your browser, and there is no backend. What went up this wire in this run was 129 shrunken frames (300–640 px wide: 65 for the main agent, 64 for the sub-agent) plus text, to the model you configured yourself (OpenAI, Anthropic, Gemini or a compatible API); the API key stays on your machine.",
        labels: { s5_browser: "Your browser", s5_cloud: "Your model", s5_wire: "129 small frames + text" },
      },
    ],
  },
};
