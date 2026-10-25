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
    email: string;
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
      { title: "买中转 API 之前先验货——六个问题判断卖的是不是真模型", href: "/posts/verify-llm-relay-api/", note: "响应 id 前缀、和官方计数接口逐个对上的 token、故意发错参数时的报错、视频里的 C2PA 签名，每项怎么查、花不花钱；整套流程开源成 Agent skill llm-relay-audit，一行装上，自动出对照报告。" },
      { title: "让 Agent 自己验收、自己整理记忆——Outcomes 与 Dreaming", href: "/posts/managed-agents-outcomes-dreaming/", note: "按官方文档拆解独立评审返工和会话之间的记忆整理，用同一个任务把 Claude Code 的 /goal 实测 12 次，最后翻译成能搬到任何 Agent 技术栈的两份契约。" },
      { title: "读完 Codex 源码，最值得企业 Agent 借鉴的 5 个设计", href: "/posts/codex-agent-design/", note: "基于 openai/codex 源码拆解选择性并行、Unified Exec、ExecCell、Skills 渐进上下文、Goal 自动续跑，以及怎样通过 App Server 嵌入同一套 Runtime。" },
      { title: "Codex 为什么不把所有工具都交给模型？", href: "/posts/codex-first-request-tools/", note: "基于 rust-v0.147.0 源码讲清工具为什么按需加载、BM25 怎样从大量工具里排出最相关的几个，以及怎样把同一设计搬到 Python、Go 和其他模型。" },
    ],
    contactHead: "来聊聊",
    contactNote: "也在折腾 AI 应用、Agent 工程，或者它们底下那层基础设施？上面哪个渠道都行，打个招呼就好。",
    wechat: "微信二维码",
    email: "邮箱",
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
      { title: "Check the Goods Before You Buy a Relay API", href: "/posts/verify-llm-relay-api/", note: "Response id prefixes, input tokens that match the official counting endpoint one for one, the error a deliberately invalid parameter gets, the C2PA signature inside a video: how to check each and what it costs. The whole procedure ships as an open-source Agent skill, llm-relay-audit, that installs in one line and writes the comparison report." },
      { title: "Agents That Check Their Own Work and Tidy Their Own Memory", href: "/posts/managed-agents-outcomes-dreaming/", note: "Outcomes and Dreaming taken apart from the official docs, Claude Code's /goal tested 12 times on one task, and the design turned into two contracts you can carry to any Agent stack." },
      { title: "Five Codex Harness Designs Worth Copying", href: "/posts/codex-agent-design/", note: "From the openai/codex source: selective parallelism, Unified Exec, ExecCell, progressive Skills, Goal continuation, and embedding the same runtime through App Server." },
      { title: "Why Codex Does Not Give the Model Every Tool", href: "/posts/codex-first-request-tools/", note: "From the rust-v0.147.0 source: why tools load on demand, how BM25 ranks the best few out of many, and how to carry the same design to Python, Go, and other models." },
    ],
    contactHead: "Say hi",
    contactNote: "Tinkering with AI apps, Agent engineering, or the infrastructure underneath them too? Any channel above works — just say hi.",
    wechat: "WeChat QR code",
    email: "Email",
  },
};
