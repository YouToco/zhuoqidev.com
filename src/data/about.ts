import type { Lang } from "../i18n";

// About page content for both languages. Reviewed 2026-10-07: the title stays as on the résumé,
// the current job is described without naming the employer, and Vane is marked as paused.

type Project = { title: string; role: string; summary: string; tags: string[]; href?: string };
type Group = { title: string; items: string };
type Column = { head: string; groups: Group[] };

export const about: Record<
  Lang,
  {
    title: string;
    description: string;
    who: string;
    intro: string[];
    principle: string;
    columns: Column[];
    projectsHead: string;
    projects: Project[];
    certs: { code: string; name: string }[];
    writingHead: string;
    writing: { title: string; href: string; note: string }[];
    contactHead: string;
    contactNote: string;
    wechat: string;
  }
> = {
  zh: {
    title: "关于我",
    description: "AI 应用开发工程师（Agent 方向）刘卓琪的个人介绍 —— AI 应用、Agent 工程与产品交付实践",
    who: "刘卓琪 · AI 应用开发工程师（Agent 方向）",
    intro: [
      "我是**刘卓琪**，AI 应用开发工程师（Agent 方向）。主要做 AI 应用、Agent 工作流与生产交付。",
      "我担任过 **AISEO、Help Center 和 UMS** 的技术负责人并主导开发，也为视频理解 Agent 部署和接入过 SGLang / vLLM 推理服务。现在在一家 AI 基础设施公司做模型 API 聚合平台的研发：接入多家上游模型并做负载均衡，负责视频 / 图片模型的计费、新供应商接入验证和上游质量监控。",
    ],
    principle: "不同技术的熟练度并不相同。我更看重能否对开发、测试、排障和上线结果负责，而不是把使用过的框架都写成“精通”。",
    columns: [
      {
        head: "BUILD",
        groups: [
          { title: "AI 应用与 Agent", items: "多阶段 Agent 工作流 · RAG · 工具调用 · 多模型路由 · 反馈闭环 · Agent 评测" },
          { title: "前端", items: "React · Vue 3 · TypeScript · Vite" },
        ],
      },
      {
        head: "SERVE",
        groups: [
          { title: "模型服务", items: "SGLang · vLLM · 多模态视频理解 · GPU 环境联调与压测" },
          { title: "后端与工作流", items: "Python / FastAPI · Java / Quarkus · Go / Gin · Temporal · PostgreSQL · Redis" },
        ],
      },
      {
        head: "SHIP",
        groups: [
          { title: "工程交付", items: "Linux · Docker · Kubernetes · Jenkins · GitHub Actions · Ansible · Prometheus / Grafana" },
        ],
      },
    ],
    projectsHead: "项目与职责",
    projects: [
      { title: "模型 API 聚合平台", role: "研发 · 现职", summary: "多上游线路接入与负载均衡、媒体模型按秒 / 按分辨率计费、供应商一致性验证。", tags: ["TypeScript", "Cloudflare Workers", "D1"] },
      { title: "见微 Vane", role: "独立开发 · 已暂停（2026-07 至 09）", summary: "用 Go / PostgreSQL / Temporal 与 React / TypeScript 从零做到生产部署：工作流、飞书 Agent、画像反馈闭环。", tags: ["Go", "Temporal", "React"], href: "/projects/vane/" },
      { title: "Argus", role: "开源 · 长视频理解", summary: "纯前端的长视频理解 agent harness：视频不出浏览器，多 provider LLM，抽帧 / 记忆 / 子 Agent 工具。", tags: ["TypeScript", "Vite", "React"], href: "/projects/argus/" },
      { title: "AISEO", role: "技术负责人 · AI 应用", summary: "使用 Python / FastAPI / Temporal 构建多阶段 Agent 内容流水线，覆盖 RAG、多模型路由、Token 成本与多 CMS 发布。", tags: ["Python", "FastAPI", "Temporal"] },
      { title: "Help Center", role: "技术负责人 · 知识平台", summary: "使用 Java / Quarkus / React 开发多站点知识平台，接入 RAG 检索、向量存储与本地 Embedding。", tags: ["Java 21", "Quarkus 3", "React"] },
      { title: "UMS", role: "技术负责人 · 统一管理平台", summary: "使用 Go / Gin / Casdoor 开发多产品统一管理平台，负责统一认证、权限、订阅套餐与权益同步。", tags: ["Go", "Gin", "Casdoor"] },
    ],
    certs: [
      { code: "CKA", name: "Certified Kubernetes Administrator" },
      { code: "CKS", name: "Certified Kubernetes Security Specialist" },
      { code: "RHCE", name: "Red Hat Certified Engineer" },
    ],
    writingHead: "技术文章",
    writing: [
      { title: "大模型为什么记不住你——记忆机制全拆解", href: "/posts/llm-memory-research/", note: "67 条一手资料交叉验证，覆盖 Anthropic / OpenAI / Google / Cursor 官方文档与 Karpathy / LeCun / Raschka 原文，从架构约束到产品实现彻底拆解 Agent 记忆系统。" },
      { title: "LLM 推理引擎怎么选——2026 全景选型地图", href: "/posts/llm-inference-engine-selection/", note: "vLLM / SGLang / TensorRT-LLM 等 8 大引擎，叠加 PD 分离 / 投机解码 / FP4 量化三大新趋势，官方博客 / GitHub / arXiv 多源核验。" },
      { title: "为什么我们从 Celery 迁移到 Temporal", href: "/posts/why-temporal-not-celery/", note: "生产环境 Agent 流水线的工作流引擎选型，来自逐条踩坑的一线实践，而非文档对比。" },
      { title: "一个 Agent 记忆选型框架", href: "/posts/memory-choice-framework/", note: "RAG / LLM Wiki / 纯文本三条记忆路线的成本、延迟、精度与可维护性权衡，附决策树。" },
    ],
    contactHead: "来聊聊",
    contactNote: "也在折腾 AI 应用、Agent 工程，或者它们底下那层基础设施？上面哪个渠道都行，打个招呼就好。",
    wechat: "微信二维码",
  },
  en: {
    title: "About",
    description: "AI Application Engineer Liu ZhuoQi — AI applications, Agent engineering, and product delivery",
    who: "Liu ZhuoQi · AI Application Engineer · Agent Systems",
    intro: [
      "I'm **Liu ZhuoQi**, an AI Application Engineer focused on Agent systems. I mainly build AI applications, Agent workflows, and production delivery systems.",
      "I served as technical lead and led development for **AISEO, Help Center, and UMS**. I have also deployed and integrated SGLang / vLLM services for a video-understanding Agent. I now work on a model API aggregation platform at an AI infrastructure company: integrating and load-balancing many upstream model providers, and owning billing for video and image models, onboarding verification for new providers, and upstream quality monitoring.",
    ],
    principle: "My proficiency varies across technologies. I care more about owning development, testing, troubleshooting, and deployment outcomes than presenting every framework I have used as an area of mastery.",
    columns: [
      {
        head: "BUILD",
        groups: [
          { title: "AI Applications & Agents", items: "Multi-stage Agent Workflows · RAG · Tool Use · Multi-Model Routing · Feedback Loops · Agent Evaluation" },
          { title: "Frontend", items: "React · Vue 3 · TypeScript · Vite" },
        ],
      },
      {
        head: "SERVE",
        groups: [
          { title: "Model Serving", items: "SGLang · vLLM · Multimodal Video Understanding · GPU Integration and Benchmarking" },
          { title: "Backend & Workflows", items: "Python / FastAPI · Java / Quarkus · Go / Gin · Temporal · PostgreSQL · Redis" },
        ],
      },
      {
        head: "SHIP",
        groups: [
          { title: "Engineering Delivery", items: "Linux · Docker · Kubernetes · Jenkins · GitHub Actions · Ansible · Prometheus / Grafana" },
        ],
      },
    ],
    projectsHead: "Projects & Responsibilities",
    projects: [
      { title: "Model API Aggregation Platform", role: "Engineer · Current role", summary: "Multi-upstream routing and load balancing, per-second / per-resolution billing for media models, and provider consistency verification.", tags: ["TypeScript", "Cloudflare Workers", "D1"] },
      { title: "Vane", role: "Independent · Paused (2026-07 to 09)", summary: "Built from scratch to production with Go / PostgreSQL / Temporal and React / TypeScript: workflows, a Feishu Agent, and a profile feedback loop.", tags: ["Go", "Temporal", "React"], href: "/projects/vane/" },
      { title: "Argus", role: "Open source · Long-video understanding", summary: "A frontend-only long-video understanding agent harness: video never leaves the browser, multi-provider LLMs, frame / memory / sub-agent tools.", tags: ["TypeScript", "Vite", "React"], href: "/projects/argus/" },
      { title: "AISEO", role: "Technical Lead · AI Application", summary: "Built a multi-stage Agent content pipeline with Python / FastAPI / Temporal, covering RAG, multi-model routing, token costs, and multi-CMS publishing.", tags: ["Python", "FastAPI", "Temporal"] },
      { title: "Help Center", role: "Technical Lead · Knowledge Platform", summary: "Developed a multi-site knowledge platform with Java / Quarkus / React, integrating RAG retrieval, vector storage, and local embeddings.", tags: ["Java 21", "Quarkus 3", "React"] },
      { title: "UMS", role: "Technical Lead · Unified Platform", summary: "Built a multi-product management platform with Go / Gin / Casdoor for shared authentication, permissions, subscription plans, and entitlement sync.", tags: ["Go", "Gin", "Casdoor"] },
    ],
    certs: [
      { code: "CKA", name: "Certified Kubernetes Administrator" },
      { code: "CKS", name: "Certified Kubernetes Security Specialist" },
      { code: "RHCE", name: "Red Hat Certified Engineer" },
    ],
    writingHead: "Technical Writing",
    writing: [
      { title: "Why LLMs Can't Remember You — Memory Mechanisms Dissected", href: "/posts/llm-memory-research/", note: "67 primary sources cross-validated across Anthropic / OpenAI / Google / Cursor docs and Karpathy / LeCun / Raschka papers, tearing down Agent memory systems from architectural constraints to product implementation." },
      { title: "How to Choose an LLM Inference Engine — A 2026 Map", href: "/posts/llm-inference-engine-selection/", note: "8 engines from vLLM / SGLang / TensorRT-LLM, plus PD disaggregation / speculative decoding / FP4 quantization, cross-checked against official blogs, GitHub, and arXiv." },
      { title: "Why We Migrated from Celery to Temporal", href: "/posts/why-temporal-not-celery/", note: "Workflow-engine selection for a production Agent pipeline, drawn from hitting each pitfall in the field rather than comparing docs." },
      { title: "An Agent Memory Selection Framework", href: "/posts/memory-choice-framework/", note: "Cost, latency, precision, and maintainability trade-offs across RAG / LLM Wiki / plain-text memory, with a decision tree." },
    ],
    contactHead: "Say hi",
    contactNote: "Tinkering with AI apps, Agent engineering, or the infrastructure underneath them too? Any channel above works — just say hi.",
    wechat: "WeChat QR code",
  },
};
