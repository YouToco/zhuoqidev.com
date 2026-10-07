import type { Lang } from "../i18n";

/** Where each card sits on the desk (wide screens). Narrow screens stack them in source order. */
export const layout: Record<string, string> = {
  hero: "left:2.5%;top:28px;width:620px;z-index:2",
  doodle: "left:41%;top:146px;z-index:3",
  sticky: "left:74%;top:72px;width:232px;transform:rotate(3deg);z-index:6",
  term: "left:2.5%;top:222px;width:340px;z-index:5",
  feature: "left:38.5%;top:216px;width:330px;z-index:7",
  "series-0": "left:73%;top:330px;width:250px;z-index:4",
  robot: "left:68%;top:600px;z-index:8",
  "note-0": "left:3%;top:575px;width:310px;transform:rotate(-2deg);z-index:4",
  "note-1": "left:38.5%;top:600px;width:290px;transform:rotate(1.5deg);z-index:4",
  "series-1": "left:73%;top:710px;width:250px;transform:rotate(-1deg);z-index:4",
  projects: "left:3%;top:810px;width:320px;z-index:4",
  "note-2": "left:38.5%;top:860px;width:300px;transform:rotate(-1deg);z-index:4",
  stamps: "left:73%;top:1000px;width:250px;z-index:4",
  coffee: "left:62%;top:1080px;z-index:8",
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
