// Other people's galleries and component libraries worth browsing, shown at the bottom of /design/.
// Links only: nothing of theirs is copied here. `license` is the code license where there is one.
export interface DesignLink {
  name: string;
  url: string;
  license?: string;
  note: { zh: string; en: string };
}

export const designLinks: { group: { zh: string; en: string }; items: DesignLink[] }[] = [
  {
    group: { zh: "拿来就能用的组件", en: "Components you can use" },
    items: [
      {
        name: "shadcn/ui Blocks",
        url: "https://ui.shadcn.com/blocks",
        license: "MIT",
        note: {
          zh: "官方整块布局：仪表盘、侧栏、登录注册，一条命令装进项目。",
          en: "Official whole-section layouts (dashboards, sidebars, sign-in), installed with one command.",
        },
      },
      {
        name: "Magic UI",
        url: "https://magicui.design/",
        license: "MIT",
        note: {
          zh: "150+ 个动效组件，配 shadcn 用，比 Aceternity 克制，适合产品官网。",
          en: "150+ animated components for shadcn; calmer than Aceternity, good for product sites.",
        },
      },
      {
        name: "Aceternity UI",
        url: "https://ui.aceternity.com/components",
        note: {
          zh: "shader、视差、微交互很多的动效组件和整页模板。",
          en: "Animated components and page templates heavy on shaders, parallax and micro-interactions.",
        },
      },
      {
        name: "21st.dev",
        url: "https://21st.dev/",
        note: {
          zh: "社区组件市场，营销区块最多，每个都附带给 AI 的提示词。",
          en: "Community component market, mostly marketing sections, each with a prompt for your AI.",
        },
      },
      {
        name: "awesome-design-md",
        url: "https://github.com/VoltAgent/awesome-design-md",
        license: "MIT",
        note: {
          zh: "把 Stripe、Linear、Vercel 的设计系统写成 DESIGN.md，丢给 agent 照着出界面。",
          en: "Design systems of Stripe, Linear, Vercel and more as DESIGN.md files for your agent.",
        },
      },
    ],
  },
  {
    group: { zh: "看别人怎么做", en: "Galleries to browse" },
    items: [
      {
        name: "Godly",
        url: "https://godly.website/",
        note: { zh: "每天精选，偏实验和高级质感。", en: "Daily picks, experimental and polished." },
      },
      {
        name: "Awwwards",
        url: "https://www.awwwards.com/websites/",
        note: {
          zh: "获奖网站，可按技术、字体、颜色筛，偏 3D 和大字排版。",
          en: "Award winners, filterable by tech, type and colour; lots of 3D and big type.",
        },
      },
      {
        name: "Land-book",
        url: "https://land-book.com/",
        note: {
          zh: "落地页精选，能按风格筛：Apple 风、Stripe 风、粗野主义。",
          en: "Landing pages filterable by style: Apple-like, Stripe-like, brutalist.",
        },
      },
      {
        name: "SiteInspire",
        url: "https://www.siteinspire.com/",
        note: { zh: "老牌精选，偏编辑风和排版，比较克制。", en: "A long-running, restrained gallery of editorial sites." },
      },
      {
        name: "Mobbin",
        url: "https://mobbin.com/",
        note: {
          zh: "真实产品的界面和完整流程截图，做后台、控制台最实用。",
          en: "Screens and full flows of shipped products; the most useful for dashboards.",
        },
      },
      {
        name: "SaaS Landing Page",
        url: "https://saaslandingpage.com/",
        note: { zh: "只收 SaaS 落地页，按定价、功能、FAQ 等页面类型看。", en: "SaaS landing pages only, by page type." },
      },
      {
        name: "recent.design",
        url: "https://recent.design/",
        note: {
          zh: "录屏为主的微交互收藏，「像素溶解下拉框」就是在这儿看到的。",
          en: "Screen recordings of micro-interactions; the pixel-dissolve select came from here.",
        },
      },
    ],
  },
];
