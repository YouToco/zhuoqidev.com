import type { APIRoute } from "astro";
// The <Font> component inlines @font-face rules into every page. For CJK families that is
// ~300 unicode-range slices (~280 KB per page), so the same rules are published once here
// as a cacheable stylesheet instead. This is the module <Font> itself reads.
// @ts-expect-error virtual module without public types
import { componentDataByCssVariable } from "virtual:astro:assets/fonts/internal";

type FontComponentData = { css: string };

export const GET: APIRoute = () =>
  new Response(
    [...(componentDataByCssVariable as Map<string, FontComponentData>).values()].map((d) => d.css).join("\n"),
    { headers: { "Content-Type": "text/css; charset=utf-8" } },
  );
