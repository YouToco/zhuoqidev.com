import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { GLYPH_NAMES } from "./data/glyphs";

// Every entry is a folder holding both editions: <slug>/zh.md and <slug>/en.md.
// The id keeps that shape ("<slug>/<lang>") so pairing needs no lookup table.
const bilingual = (base: string) =>
  glob({ pattern: "*/{zh,en}.md", base, generateId: ({ entry }) => entry.replace(/\.md$/, "") });

const posts = defineCollection({
  loader: bilingual("./src/content/posts"),
  schema: z.object({
    title: z.string(),
    /** Short title for lists and cards when the full title is too long. */
    short: z.string().optional(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    lead: z.string().optional(),
    tags: z.array(z.string()).default([]),
    categories: z.array(z.string()).default([]),
    series: z.string().optional(),
    seriesOrder: z.number().int().optional(),
    aliases: z.array(z.string()).optional(),
    /** The object drawn beside the post in lists and on its header (src/data/glyphs.ts). */
    glyph: z.enum(GLYPH_NAMES).optional(),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: bilingual("./src/content/projects"),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date().optional(),
    /** An interactive scene shown above the write-up (src/components/ArgusStory.astro). */
    scene: z.enum(["argus"]).optional(),
    /** The object drawn beside the project in the list and on its page (src/data/glyphs.ts). */
    glyph: z.enum(GLYPH_NAMES).optional(),
  }),
});

const pages = defineCollection({
  loader: bilingual("./src/content/pages"),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date().optional(),
  }),
});

// The design library (/design/): one runnable demo per entry in public/design/demos/<slug>/.
// Both editions carry the same structural fields; src/lib/design.ts fails the build if they drift.
const design = defineCollection({
  loader: bilingual("./src/content/design"),
  schema: z.object({
    title: z.string(),
    /** One sentence for the card: what it is and what is worth stealing. */
    summary: z.string().max(140),
    category: z.enum(["button", "navigation", "card", "layout", "style", "motion", "visual"]),
    /** original = designed here; recreated = rebuilt from someone else's effect (credit in inspiredBy). */
    origin: z.enum(["original", "recreated"]).default("original"),
    inspiredBy: z.object({ name: z.string(), url: z.url() }).optional(),
    stack: z.array(z.string()).min(1),
    tags: z.array(z.string()).min(1),
    order: z.number().int(),
    /** Files under public/design/demos/<slug>/ shown as source; the first one is the demo page. */
    files: z.array(z.string()).min(1),
    /** Height of the demo frame on the entry page, in CSS pixels. */
    demoHeight: z.number().int().default(520),
    added: z.coerce.date(),
  }),
});

export const collections = { posts, projects, pages, design };
