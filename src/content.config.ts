import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

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

export const collections = { posts, projects, pages };
