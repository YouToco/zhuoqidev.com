// What to read next: the hand-picked articles (src/data/featured.ts) and the data for the "popular lately" cards that the page fills in from /hot.json (functions/hot.json.ts).
import { FEATURED } from "../data/featured";
import type { Lang } from "../i18n";
import { type Post, postUrl, shortTitle, slugOf } from "./content";

export type Card = { slug: string; title: string; url: string; description: string };

export const cardOf = (lang: Lang, p: Post): Card => ({
  slug: slugOf(p),
  title: shortTitle(p),
  url: postUrl(lang, slugOf(p)),
  description: p.data.description,
});

/** The featured articles in their set order; the build fails when one of them is missing. */
export function featuredPosts(posts: Post[]): Post[] {
  return FEATURED.map((slug) => {
    const p = posts.find((x) => slugOf(x) === slug);
    if (!p) throw new Error(`src/data/featured.ts names a post that does not exist: ${slug}`);
    return p;
  });
}

/**
 * Title, address and description of every article in the page's language, keyed by slug, for the
 * script that turns a slug from /hot.json into a card. Descriptions are cut: a card shows one line.
 */
export function hotCards(lang: Lang, posts: Post[]): Record<string, { t: string; u: string; d: string }> {
  return Object.fromEntries(
    posts.map((p) => {
      const c = cardOf(lang, p);
      const d = c.description.length > 90 ? `${c.description.slice(0, 89)}…` : c.description;
      return [c.slug, { t: c.title, u: c.url, d }];
    }),
  );
}

/** `hot`: the card the page swaps for a popular article (see HotScript.astro). */
export type NextCard = Card & { kind: "featured"; hot?: true };

/**
 * The "read next" row at the end of an article: two featured articles and a third that the page
 * swaps for the first popular article not already on the page once /hot.json answers (until then,
 * or when it cannot, the third featured one stays). The articles before and after this one in its
 * series are left out, because the series navigation right below already links them. `shown` lists
 * the slugs the swap must skip: the current article, its series neighbours and the cards.
 */
export function readNext(lang: Lang, post: Post, posts: Post[]): { cards: NextCard[]; shown: string[] } {
  const shown = [slugOf(post)];
  if (post.data.series) {
    const series = posts
      .filter((p) => p.data.series === post.data.series)
      .sort((a, b) => (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0));
    const i = series.findIndex((p) => p.id === post.id);
    for (const p of [series[i - 1], series[i + 1]]) if (p) shown.push(slugOf(p));
  }
  const [first, second, third] = featuredPosts(posts).filter((p) => !shown.includes(slugOf(p)));
  const cards: NextCard[] = [];
  for (const p of [first, second]) {
    if (!p) continue;
    cards.push({ ...cardOf(lang, p), kind: "featured" });
    shown.push(slugOf(p));
  }
  if (third) cards.push({ ...cardOf(lang, third), kind: "featured", hot: true });
  return { cards, shown };
}
