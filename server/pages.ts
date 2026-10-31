// Per-article counts and the "popular lately" ranking built from them (schema: migrations/0003).
// Dependency-free, so the Pages Functions and scripts/stats-cn.ts share it.

const SLUG = /^[a-z0-9-]{1,80}$/;
const POST_PATH = /^\/(?:en\/)?posts\/([a-z0-9-]{1,80})\/?$/;

/**
 * The article a page path belongs to: `/posts/<slug>/` and `/en/posts/<slug>/` (trailing slash
 * optional, query and hash ignored) give the same slug; any other path gives null.
 */
export function slugOf(path: string): string | null {
  const bare = path.replace(/[?#].*$/s, "");
  return POST_PATH.exec(bare)?.[1] ?? null;
}

export type PageCount = { slug: string; views: number; visitors: number };

/** The `pages` of a mainland import (scripts/stats-cn.ts), or null when any row is malformed. */
export function validPages(input: unknown): PageCount[] | null {
  if (!Array.isArray(input) || input.length > 2000) return null;
  const ok = (input as unknown[]).every((x) => {
    if (typeof x !== "object" || x === null) return false;
    const v = x as Record<string, unknown>;
    return (
      typeof v.slug === "string" &&
      SLUG.test(v.slug) &&
      Number.isInteger(v.visitors) &&
      (v.visitors as number) >= 1 &&
      Number.isInteger(v.views) &&
      (v.views as number) >= (v.visitors as number)
    );
  });
  if (!ok) return null;
  const rows = (input as PageCount[]).map(({ slug, views, visitors }) => ({ slug, views, visitors }));
  return new Set(rows.map((r) => r.slug)).size === rows.length ? rows : null;
}

export type HotOptions = { days?: number; limit?: number; minDays?: number };

/** What /hot.json serves (functions/hot.json.ts): eight slugs, so a page can skip the ones it shows. */
export const HOT_LIST = { days: 30, limit: 8, minDays: 7 } as const;

/** The Beijing day `n` days before `day` (both YYYY-MM-DD). */
export function daysBefore(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Article slugs ranked by visitors over the last `days` Beijing days up to `today` (both lines
 * summed), most first. Empty until the counts cover at least `minDays` different days, so a list
 * built from a day or two of data never goes out.
 */
export function hotSlugs(
  rows: Iterable<{ day: string; slug: string; visitors: number }>,
  today: string,
  { days = 30, limit = 5, minDays = 7 }: HotOptions = {},
): string[] {
  const from = daysBefore(today, days - 1);
  const seenDays = new Set<string>();
  const total = new Map<string, number>();
  for (const r of rows) {
    if (r.day < from || r.day > today || !SLUG.test(r.slug) || !(r.visitors > 0)) continue;
    seenDays.add(r.day);
    total.set(r.slug, (total.get(r.slug) ?? 0) + r.visitors);
  }
  if (seenDays.size < minDays) return [];
  return [...total]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([slug]) => slug);
}
