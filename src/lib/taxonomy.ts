import { type Lang, t } from "../i18n";
import { getPosts, type Term, terms } from "./content";

export const TAXES = ["tags", "categories", "series"] as const;
export type Tax = (typeof TAXES)[number];

export const taxLabel = (lang: Lang, tax: Tax) => t[lang][tax];
export const termTitle = (lang: Lang, tax: Tax, name: string) =>
  tax === "tags" ? t[lang].tagged(name) : tax === "categories" ? t[lang].inCategory(name) : t[lang].inSeries(name);

export async function termsOf(lang: Lang, tax: Tax): Promise<Term[]> {
  return terms(await getPosts(lang), tax);
}

/**
 * Hugo filed both languages' terms under the root (/tags/x/), ten posts per page.
 * Returns every root URL that existed, with where it should now point.
 */
export async function legacyRootTerms(tax: Tax) {
  const zh = await termsOf("zh", tax);
  const en = await termsOf("en", tax);
  const all = new Map<string, { zh?: Term; en?: Term }>();
  for (const term of zh) all.set(term.slug, { zh: term });
  for (const term of en) all.set(term.slug, { ...all.get(term.slug), en: term });
  return [...all].map(([slug, { zh: z, en: e }]) => ({
    slug,
    target: z ? `/${tax}/${slug}/` : `/en/${tax}/${slug}/`,
    pages: Math.ceil(((z?.posts.length ?? 0) + (e?.posts.length ?? 0)) / 10),
    zhExists: Boolean(z),
  }));
}
