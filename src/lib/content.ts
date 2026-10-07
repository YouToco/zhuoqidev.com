import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";
import { getCollection, type CollectionEntry } from "astro:content";
import { type Lang, LANGS, url } from "../i18n";
import { diagramId } from "./markdown/diagram-id";

export type Post = CollectionEntry<"posts">;
export type Project = CollectionEntry<"projects">;
type Entry = { id: string };

export const slugOf = (e: Entry) => e.id.split("/")[0]!;
export const langOf = (e: Entry) => e.id.split("/")[1] as Lang;
export const postUrl = (lang: Lang, slug: string) => url(lang, `/posts/${slug}/`);
export const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The content layer logs Markdown render errors (e.g. an invalid Mermaid diagram) and carries on
 * with an empty body. Turn that into a build failure.
 */
function assertRendered(entries: { id: string; rendered?: { html: string } | undefined }[], kind: string) {
  const empty = entries.filter((e) => !e.rendered?.html.trim()).map((e) => `${kind}/${e.id}`);
  if (empty.length) throw new Error(`Markdown failed to render (see the error above): ${empty.join(", ")}`);
}

/** Fail the build when an article exists in only one language. */
function assertPaired(entries: Entry[], kind: string) {
  const seen = new Map<string, Set<Lang>>();
  for (const e of entries) {
    const s = seen.get(slugOf(e)) ?? new Set<Lang>();
    s.add(langOf(e));
    seen.set(slugOf(e), s);
  }
  const missing = [...seen].filter(([, s]) => s.size !== LANGS.length).map(([slug, s]) => `${kind}/${slug} (${[...s]})`);
  if (missing.length) throw new Error(`Missing translation for: ${missing.join(", ")}`);
}

export async function getPosts(lang: Lang): Promise<Post[]> {
  const all = await getCollection("posts", (e) => import.meta.env.DEV || !e.data.draft);
  assertPaired(all, "posts");
  assertRendered(all, "posts");
  return all
    .filter((e) => langOf(e) === lang)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || slugOf(a).localeCompare(slugOf(b)));
}

export async function getProjects(lang: Lang): Promise<Project[]> {
  const all = await getCollection("projects");
  assertPaired(all, "projects");
  assertRendered(all, "projects");
  return all
    .filter((e) => langOf(e) === lang)
    .sort((a, b) => (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0));
}

/** "Main title——subtitle" / "Main title: subtitle" → two lines on the article page. */
export function splitTitle(title: string): { main: string; sub?: string | undefined } {
  const m = /^(.+?)(——|：|？|: | — )(.+)$/.exec(title);
  if (!m) return { main: title };
  const keep = m[2] === "？" ? "？" : "";
  return { main: m[1] + keep, sub: m[3] };
}

/** Readable length: CJK characters + Latin words for zh, words for en. Code blocks excluded. */
export function readingStats(body: string, lang: Lang) {
  const prose = body.replace(/```[\s\S]*?```/g, "").replace(/<[^>]+>/g, "");
  const han = (prose.match(/[㐀-鿿豈-﫿]/g) ?? []).length;
  const words = (prose.replace(/[㐀-鿿豈-﫿]/g, " ").match(/[A-Za-z0-9][\w'’.-]*/g) ?? []).length;
  if (lang === "zh") {
    const count = han + words;
    return { count: Math.round(count / 100) * 100, minutes: Math.max(1, Math.round(han / 400 + words / 200)) };
  }
  return { count: Math.round(words / 100) * 100, minutes: Math.max(1, Math.round(words / 230)) };
}

/** Same rule as Hugo's urlize so taxonomy URLs stay put. */
export const termSlug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-_.+#]/gu, "");

export type Term = { name: string; slug: string; posts: Post[] };

export function terms(posts: Post[], key: "tags" | "categories" | "series"): Term[] {
  const map = new Map<string, Term>();
  for (const p of posts) {
    const values = key === "series" ? (p.data.series ? [p.data.series] : []) : p.data[key];
    for (const name of values) {
      const slug = termSlug(name);
      const t = map.get(slug) ?? { name, slug, posts: [] };
      t.posts.push(p);
      map.set(slug, t);
    }
  }
  const list = [...map.values()];
  if (key === "series") for (const t of list) t.posts.sort((a, b) => (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0));
  return list.sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name));
}

/** Minimal inline Markdown (bold, italic, code) for short front-matter fields such as `lead`. */
export function inlineMd(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}
export const plainMd = (s: string) => s.replace(/\*\*|\*|`/g, "");

// Every image that sits next to a post, keyed "<slug>/<file>".
const postImages = Object.fromEntries(
  Object.entries(
    import.meta.glob<ImageMetadata>("/src/content/posts/*/*.{png,jpg,jpeg,webp,gif,svg}", {
      eager: true,
      import: "default",
    }),
  ).map(([path, img]) => [path.split("/").slice(-2).join("/"), img]),
);

export function postImage(slug: string, file: string): ImageMetadata | undefined {
  return postImages[`${slug}/${file.replace(/^\.\//, "")}`];
}

/** Absolute URL of an optimized copy, for Markdown exports, feeds and social cards. */
export async function imageUrl(img: ImageMetadata, width: number, site: URL) {
  // Reading a property of the imported image marks the 4K original as "used" and ships it
  // to dist/. `clone` is the one accessor Astro exempts, so read dimensions from a copy.
  const { width: original } = (img as ImageMetadata & { clone: ImageMetadata }).clone;
  const out = await getImage({ src: img, width: Math.min(width, original), format: "webp" });
  return new URL(out.src, site).href;
}

/** First local image referenced by a post (used as its social card). */
export function firstImage(post: Post): ImageMetadata | undefined {
  const m = /!\[[^\]]*\]\((\.\/[^\s)]+)/.exec(post.body ?? "");
  return m ? postImage(slugOf(post), m[1]!) : undefined;
}

/**
 * Large copies of a post's images and diagrams for the click-to-zoom viewer, keyed by file stem
 * (the stem survives in Astro's hashed output names, so the page script can match them).
 */
export async function zoomSources(post: Post, site: URL): Promise<Record<string, { src: string; srcset?: string }>> {
  const out: Record<string, { src: string; srcset?: string }> = {};
  const path = async (img: ImageMetadata, width: number) => new URL(await imageUrl(img, width, site)).pathname;
  for (const m of (post.body ?? "").matchAll(/!\[[^\]]*\]\(\.\/([^\s)]+)/g)) {
    const img = postImage(slugOf(post), m[1]!);
    if (!img) continue;
    const src = await path(img, 1600);
    // Zoomed in (or on a high-DPI screen) the viewer needs more pixels: the originals are 4K, so
    // offer a 3200w copy too and let the browser pick by the size the image is shown at.
    const large = Math.min(3200, (img as ImageMetadata & { clone: ImageMetadata }).clone.width);
    out[m[1]!.replace(/\.[^.]+$/, "")] = large > 1600 ? { src, srcset: `${src} 1600w, ${await path(img, large)} ${large}w` } : { src };
  }
  // hand-drawn diagrams are vector, so the viewer shows the same file larger
  for (const m of (post.body ?? "").matchAll(/^```mermaid[^\n]*\n([\s\S]*?)^```/gm)) {
    const id = diagramId(m[1]!);
    if (existsSync(join(process.cwd(), "public/diagrams", `${id}.svg`))) out[id] = { src: `/diagrams/${id}.svg` };
  }
  return out;
}

/** Title for lists and cards. */
export const shortTitle = (p: Post) => p.data.short ?? splitTitle(p.data.title).main;
