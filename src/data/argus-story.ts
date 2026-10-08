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
  /** Labels shown on the 3D scene while this step is active, keyed by pin. */
  labels: Partial<Record<PinName, string>>;
};

/** Where each step's number sits on the poster (the picture shown before, or instead of, the 3D scene). */
export const posterMarks: PinName[] = ["s0_question", "s1_argus", "s2_lens", "s3_notes", "s4_answer", "s5_cloud"];

/** Time marks along the film strip; they stay on from the first step. */
export const ticks: [PinName, string][] = [
  ["s0_t0", "0:00"],
  ["s0_t60", "1:00"],
  ["s0_t120", "2:00"],
  ["s0_t180", "3:00"],
];

export { camera, pins };

export const story: Record<
  Lang,
  {
    kicker: string;
    heading: string;
    sub: string;
    skip: string;
    alt: string;
    credit: string;
    script: string;
    steps: Step[];
  }
> = {
  zh: {
    kicker: "作品 · Argus",
    heading: "Argus 是怎么看完一段长视频的",
    sub: "往下滚，一步步看它找答案；拖动场景可以转着看。",
    skip: "跳过，直接看项目介绍 ↓",
    alt:
      "黏土风格的小场景：浏览器窗口里铺着一卷胶片（示例视频），长满眼睛的 Argus 拿放大镜看抽出来的帧，胶片上贴着便签，" +
      "两个小号 Argus 在看后半段，一张写着 9.9s – 24.9s 的回答卡用红线钉回胶片上的两帧，窗口外的一朵云代表你自己配置的模型。",
    credit: "这个场景是 agent 经 Blender MCP 写脚本建的模型。",
    script: "建模脚本",
    steps: [
      {
        title: "一段视频，一个问题",
        body: "拿 Argus 自带的 3 分钟示例视频来说：拖进来，问一句「红色的东西什么时候出现？」",
        labels: { s0_question: "「红色的东西什么时候出现？」" },
      },
      {
        title: "先粗扫",
        body: "Argus 是一个长满眼睛的 agent。它先每隔一段抽一帧，看个大概；抽出来的帧立在它在视频里的位置上方。",
        labels: { s1_argus: "Argus", s1_scan: "抽出来的帧" },
      },
      {
        title: "看到红色，再看细",
        body: "有一帧里出现了红色，它就把那一段的帧抽得更密，找准开始和结束；小东西用放大镜（局部放大）再确认一遍。",
        labels: { s2_dense: "这段抽得更密", s2_lens: "放大确认" },
      },
      {
        title: "记笔记，派帮手",
        body: "看完的片段写成笔记，后面不用再看；剩下的长片段交给子代理分头看，它们只交回几句结论，帧图不会塞满主 agent 的上下文。",
        labels: { s3_notes: "笔记：这段看过了", s3_subs: "子代理分头看" },
      },
      {
        title: "回答带证据",
        body: "回答是「9.9s – 24.9s」，每个时间都钉回抽过的那一帧；在 Argus 里点一下时间戳，播放器就跳到那一刻。（这是用 DeepSeek 模型真实跑一次给出的时间。）",
        labels: { s4_answer: "回答", s4_pins: "证据帧" },
      },
      {
        title: "全在你的浏览器里",
        body: "上面这些都发生在你的浏览器里：视频不上传，也没有后端。唯一连出去的那根线，接的是你自己配置的模型（OpenAI、Anthropic、Gemini 或兼容接口），API Key 只存在本机。",
        labels: { s5_browser: "你的浏览器", s5_cloud: "你配置的模型" },
      },
    ],
  },
  en: {
    kicker: "Project · Argus",
    heading: "How Argus watches a long video",
    sub: "Scroll to follow one search step by step; drag the scene to turn it.",
    skip: "Skip to the write-up ↓",
    alt:
      "A small clay scene: a film strip (the sample video) lies in a browser window; Argus, covered in eyes, holds a magnifier " +
      "up to the frames it pulled; sticky notes sit on the strip; two smaller Argus figures watch the second half; an answer card " +
      "reading 9.9s – 24.9s is tied by red threads to two frames on the strip; a cloud outside the window stands for the model you configured.",
    credit: "An agent modelled this scene by writing a Blender script over Blender MCP.",
    script: "The script",
    steps: [
      {
        title: "One video, one question",
        body: "Take the 3-minute sample video that ships with Argus: drop it in and ask, “When does something red show up?”",
        labels: { s0_question: "“When does something red show up?”" },
      },
      {
        title: "A quick skim first",
        body: "Argus is an agent covered in eyes. It first pulls one frame every so often to get the gist; each pulled frame stands above its spot in the video.",
        labels: { s1_argus: "Argus", s1_scan: "Pulled frames" },
      },
      {
        title: "Red spotted: look closer",
        body: "Once a frame shows red, it pulls frames more densely around it to find where the red starts and ends, and zooms into small things with a magnifier to confirm.",
        labels: { s2_dense: "Denser frames here", s2_lens: "Zoom to confirm" },
      },
      {
        title: "Take notes, send helpers",
        body: "Watched spans become notes, so it never watches them twice; the long remainder goes to sub-agents that watch in parallel and report back a few sentences, so frames never flood the main agent's context.",
        labels: { s3_notes: "Note: watched", s3_subs: "Sub-agents" },
      },
      {
        title: "An answer with evidence",
        body: "The answer is “9.9s – 24.9s”, and each time is pinned to a frame it pulled; click a timestamp in Argus and the player jumps there. (These are the times a real run with a DeepSeek model reported.)",
        labels: { s4_answer: "Answer", s4_pins: "Evidence frames" },
      },
      {
        title: "All inside your browser",
        body: "All of this happens in your browser: the video is never uploaded and there is no backend. The one wire leaving the window goes to the model you configured yourself (OpenAI, Anthropic, Gemini or a compatible API), and the API key stays on your machine.",
        labels: { s5_browser: "Your browser", s5_cloud: "Your model" },
      },
    ],
  },
};
