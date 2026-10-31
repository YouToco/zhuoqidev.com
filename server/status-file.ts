// File names for the /status/ front page saved as a picture or a PDF ("Save image" / "Save PDF"
// in src/scripts/ai-status.ts). Dependency-free so `node --test` runs it directly.

/** Edition number = minute of the day the data was read (1 to 1440), in the reader's clock. */
export const editionOf = (d: Date): number => d.getHours() * 60 + d.getMinutes() + 1;

/** YYYY-MM-DD of the day the page shows, in the reader's clock (the same one as the date line). */
export const dayOf = (d: Date): string =>
  [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n, i) => String(n).padStart(i ? 2 : 4, "0")).join("-");

/** `AI厂商状态-2026-11-01-第60版.png` / `ai-vendor-status-2026-11-01-edition-60.pdf`. */
export const snapshotName = (lang: "zh" | "en", day: string, edition: number, ext: "png" | "pdf"): string =>
  lang === "zh" ? `AI厂商状态-${day}-第${edition}版.${ext}` : `ai-vendor-status-${day}-edition-${edition}.${ext}`;
