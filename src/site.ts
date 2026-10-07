export const SITE_URL = "https://zhuoqidev.com";

export const site = {
  zh: {
    title: "卓琪的开发笔记",
    description:
      "AI 应用开发工程师刘卓琪的技术博客。记录 Agent 产品开发、后端工程、上下文工程、RAG、工具调用与 AI 安全的实战与调研。",
    author: "刘卓琪",
    headline: "AI 应用开发工程师（Agent 方向）",
    keywords: ["AI 应用开发", "AI Agent", "Agent 工程", "Go", "Python", "Temporal", "RAG", "LLM"],
  },
  en: {
    title: "ZhuoQi Dev",
    description:
      "Liu ZhuoQi — AI application engineer focused on production Agent systems, backend engineering, context engineering, RAG, tool use, and AI security.",
    author: "Liu ZhuoQi",
    headline: "AI Application Engineer · Agent Systems",
    keywords: ["AI Application Engineering", "AI Agent", "Go", "Python", "Temporal", "RAG", "LLM"],
  },
} as const;

export const social = {
  github: "https://github.com/YouToco",
  x: "https://x.com/busygod9527",
  xHandle: "@busygod9527",
  telegram: "https://t.me/happyforyou0",
  wechat: "/images/wechat.jpg",
} as const;

// Kept identical to the Hugo site so traffic history stays continuous.
export const analytics = {
  google: "G-8T5T6HPCBC",
  baidu: "aa6b84e568c3e766775514c4305f9e41",
  cloudflare: "b0f04d4943724cd895def6aa7251580e",
} as const;

// Mainland China filing numbers; must appear in the footer of every page.
export const beian = {
  icp: "湘ICP备2026017384号",
  gongan: "湘公网安备43090302000353号",
  gonganCode: "43090302000353",
} as const;
