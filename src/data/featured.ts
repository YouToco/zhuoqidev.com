// The hand-picked articles, in the order readers should start with them: the "★ 先读这几篇 / Start
// with these" box on the posts list and the "★ 精选 / Featured" card at the end of every article
// (src/lib/picks.ts). Slugs as in src/content/posts/<slug>/; the build fails on one that does not exist.
export const FEATURED = [
  "verify-llm-relay-api",
  "codex-first-request-tools",
  "llm-inference-engine-selection",
  "agent-plugins-inside",
] as const;
