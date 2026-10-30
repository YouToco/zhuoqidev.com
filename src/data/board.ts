import type { Lang } from "../i18n";

/** How each card sits on the desk (wide screens): its tilt, width and nudge inside its column, and
 *  `--d`, when it lands. The columns themselves are in index.astro; narrow screens stack the cards. */
export const layout: Record<string, string> = {
  hero: "",
  portrait: "width:150px;margin:6px auto 0;transform:rotate(4deg);--d:.04s",
  sticky: "width:232px;margin-left:6px;transform:rotate(3deg);--d:.08s",
  "series-0": "--d:.2s",
  "series-1": "transform:rotate(-1deg);--d:.28s",
  stamps: "--d:.36s",
  term: "--d:.08s",
  projects: "width:94%;margin-left:3%;--d:.24s",
  coffee: "margin-left:62%;--d:.4s",
  doodle: "margin:0 0 -16px calc(50% - 126px);--d:.12s",
  feature: "--d:.12s",
  "note-0": "width:92%;margin-left:1%;transform:rotate(-1.5deg);--d:.2s",
  "note-1": "width:90%;margin-left:9%;transform:rotate(1.2deg);--d:.28s",
  "note-2": "width:92%;margin-left:3%;transform:rotate(-.8deg);--d:.36s",
  robot: "align-self:flex-end;margin-right:8%;--d:.44s",
  icons: "--d:.44s",
};

type Note = { slug: string; label: string; blurb: string };

export const board: Record<
  Lang,
  {
    hero: { before: string; mark: string; tagline: string; sub: string };
    doodle: string;
    sticky: { quote: string; slug: string; from: string };
    terminal: { title: string; whoami: string; countNote: string; focus: string[] };
    notes: Note[];
    projectsLabel: string;
    stampsLabel: string;
  }
> = {
  zh: {
    hero: {
      before: "把 Agent 做进",
      mark: "真实产品",
      tagline: "notes from shipping agents to production",
      sub: "刘卓琪 · AI 应用开发工程师（Agent 方向）· 中英双语",
    },
    doodle: "从这篇开始",
    sticky: {
      quote: "Outcomes 的效果，几乎完全取决于评分标准怎么写。",
      slug: "managed-agents-outcomes-dreaming",
      from: "— 摘自",
    },
    terminal: {
      title: "zhuoqi@dev — zsh",
      whoami: "刘卓琪 · AI 应用开发工程师（Agent 方向）",
      countNote: "每篇都有英文版",
      focus: ["Agent 记忆 · 评审与验收 · 推理服务", "Temporal 工作流 · 生产交付"],
    },
    notes: [
      { slug: "why-temporal-not-celery", label: "工程实践", blurb: "Agent 流水线有状态、会卡住、要重放排障，单条失败不能拖垮整批。" },
      { slug: "llm-inference-engine-selection", label: "选型地图", blurb: "从本地单机到 PD 分离，8 个引擎分三层，附决策矩阵和决策树。" },
      { slug: "llm-memory-research", label: "深度调研", blurb: "从 Ebbinghaus 到 engram，再对 Mem0、Letta、Graphiti 等六个开源系统做卖点与代码对照。" },
    ],
    projectsLabel: "作品",
    stampsLabel: "专业认证",
  },
  en: {
    hero: {
      before: "Shipping agents into ",
      mark: "real products",
      tagline: "field notes, written in Chinese and English",
      sub: "Liu ZhuoQi · AI Application Engineer · Agent Systems",
    },
    doodle: "start here",
    sticky: {
      quote: "Outcomes is only as good as the rubric you write.",
      slug: "managed-agents-outcomes-dreaming",
      from: "— from",
    },
    terminal: {
      title: "zhuoqi@dev — zsh",
      whoami: "Liu ZhuoQi · AI application engineer (agents)",
      countNote: "every post also in Chinese",
      focus: ["agent memory · grading & review · inference", "Temporal workflows · shipping to prod"],
    },
    notes: [
      { slug: "why-temporal-not-celery", label: "Engineering", blurb: "Agent pipelines have state, get stuck and need replay; one failure must not sink the batch." },
      { slug: "llm-inference-engine-selection", label: "Field guide", blurb: "From a single local GPU to PD disaggregation: 8 engines in 3 tiers, with a decision tree." },
      { slug: "llm-memory-research", label: "Deep dive", blurb: "From Ebbinghaus to engrams, then a code audit of Mem0, Letta, Graphiti and three more." },
    ],
    projectsLabel: "Projects",
    stampsLabel: "Certifications",
  },
};
