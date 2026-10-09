import { readdirSync, readFileSync } from "node:fs";
import { unified } from "@astrojs/markdown-remark";
import { defineConfig, fontProviders } from "astro/config";
import rehypeMermaid from "rehype-mermaid";
import { rehypeHandDiagrams } from "./src/lib/markdown/rehype-hand-diagrams";
import { rehypeProse } from "./src/lib/markdown/rehype-prose";
import { remarkAlerts } from "./src/lib/markdown/remark-alerts";
import { remarkChart } from "./src/lib/markdown/remark-chart";
import { remarkComic } from "./src/lib/markdown/remark-comic";
import { remarkDemo } from "./src/lib/markdown/remark-demo";
import { remarkFigure } from "./src/lib/markdown/remark-figure";
import { legacyRedirects } from "./src/lib/redirects";

// Mermaid diagrams are rendered to inline SVG at build time in a headless browser,
// so readers get the picture without loading the 1 MB mermaid bundle.
// Local machines and the GitHub ubuntu runners both ship Google Chrome.
const chrome = process.env.MERMAID_CHROME ?? "/usr/bin/google-chrome";

/** Aliases declared in post front matter, read before content collections exist. */
function postAliases(): Record<string, string> {
  const out: Record<string, string> = {};
  const root = new URL("./src/content/posts/", import.meta.url);
  for (const slug of readdirSync(root)) {
    for (const lang of ["zh", "en"] as const) {
      let text: string;
      try {
        text = readFileSync(new URL(`${slug}/${lang}.md`, root), "utf8");
      } catch {
        continue;
      }
      const block = /^aliases:\n((?:- .*\n)+)/m.exec(text);
      if (!block) continue;
      const target = `${lang === "en" ? "/en" : ""}/posts/${slug}/`;
      for (const line of block[1]!.trim().split("\n")) {
        out[line.slice(2).trim().replace(/^['"]|['"]$/g, "")] = target;
      }
    }
  }
  return out;
}

export default defineConfig({
  site: "https://zhuoqidev.com",
  trailingSlash: "always",
  build: { format: "directory" },
  redirects: { ...postAliases(), ...legacyRedirects },
  image: {
    layout: "constrained",
    responsiveStyles: true,
    breakpoints: [480, 720, 960, 1280, 1600],
  },
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Inter",
      cssVariable: "--font-inter",
      weights: [400, 500, 600, 700],
      subsets: ["latin"],
      fallbacks: ["PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "sans-serif"],
    },
    {
      provider: fontProviders.google(),
      name: "JetBrains Mono",
      cssVariable: "--font-mono",
      weights: [400, 500, 600],
      subsets: ["latin"],
      fallbacks: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "PingFang SC", "Microsoft YaHei", "monospace"],
    },
    {
      provider: fontProviders.google(),
      name: "Caveat",
      cssVariable: "--font-caveat",
      weights: [500, 700],
      subsets: ["latin"],
      // No fallbacks: the stylesheet chains Caveat with "ZQ Hand" (Long Cang) for mixed Latin/CJK hand-written text.
      fallbacks: [],
      optimizedFallbacks: false,
    },
    // Noto Serif SC and Long Cang are subset per page after the build (scripts/subset-fonts.mjs).
  ],
  markdown: {
    syntaxHighlight: { type: "shiki", excludeLangs: ["mermaid", "math", "chart", "comic"] },
    shikiConfig: {
      theme: "github-dark-dimmed",
      wrap: false,
      // ```ts open / ```ts fold: copy the mark onto the <pre> so rehype-prose can fold the block or not.
      transformers: [
        {
          name: "fold-mark",
          pre(node) {
            const mark = /(?:^|\s)(open|fold)(?:\s|$)/.exec(this.options.meta?.__raw ?? "")?.[1];
            if (mark) node.properties["data-fold"] = mark;
          },
        },
      ],
    },
    processor: unified({
      remarkPlugins: [remarkAlerts, remarkFigure, remarkDemo, remarkChart, remarkComic],
      rehypePlugins: [
        // Hand-drawn versions first (`npm run diagrams`); rehype-mermaid draws whatever is left.
        rehypeHandDiagrams,
        [
          rehypeMermaid,
          {
            strategy: "inline-svg",
            launchOptions: { executablePath: chrome },
            mermaidConfig: {
              // Plain SVG <text> labels instead of HTML inside <foreignObject>: the HTML labels get
              // re-parsed by the Markdown pipeline (<br></br> turns into two line breaks) and pick up
              // page CSS. SVG text survives feed readers and needs no page styles.
              htmlLabels: false,
              flowchart: { htmlLabels: false },
              theme: "base",
              // System CJK fonts on purpose: labels are measured in the build machine's browser,
              // so the face should be one that readers' systems render at a similar width.
              fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif',
              themeVariables: {
                background: "#fffdf8",
                primaryColor: "#fffdf8",
                primaryBorderColor: "#1c2230",
                primaryTextColor: "#1c2230",
                lineColor: "#4a5163",
                secondaryColor: "#fff3b0",
                tertiaryColor: "#e8eefc",
                actorBkg: "#fffdf8",
                actorBorder: "#1c2230",
                noteBkgColor: "#ffe88a",
                noteBorderColor: "#c9a400",
                fontSize: "14px",
              },
            },
          },
        ],
        rehypeProse,
      ],
    }),
  },
});
