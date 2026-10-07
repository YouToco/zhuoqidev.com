/**
 * Hugo URLs that have no page of their own in the Astro site. Each one becomes a
 * static meta-refresh page so no published link breaks. Taxonomy pagination stubs
 * (`/tags/x/page/1/`) are generated next to the taxonomy pages instead, because
 * they depend on the content.
 */
const both = (from: string, to: string): Record<string, string> => ({
  [from]: to,
  [`/en${from}`]: `/en${to}`,
});

export const legacyRedirects: Record<string, string> = {
  "/zh/": "/",
  ...both("/page/1/", "/"),
  ...both("/page/2/", "/posts/"),
  ...both("/posts/page/1/", "/posts/"),
  ...both("/posts/page/2/", "/posts/"),
  ...both("/projects/page/1/", "/projects/"),
};
