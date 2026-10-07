import type { VFile } from "vfile";

export type Lang = "zh" | "en";

/** Content files are named after their language: posts/<slug>/zh.md, posts/<slug>/en.md. */
export function fileLang(file: VFile): Lang {
  return /(?:^|[\\/])en\.mdx?$/.test(file.path ?? "") ? "en" : "zh";
}
