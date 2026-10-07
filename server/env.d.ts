// Bindings and secrets of the Pages project (wrangler.jsonc; secrets via `wrangler pages secret put`,
// or .dev.vars for `wrangler pages dev`).
interface Env {
  DB: D1Database;
  /** Bearer token for /api/admin/* and the /admin/ page. Unset or shorter than 32 characters locks them. */
  ADMIN_TOKEN?: string;
}

// Wrangler bundles .html imports as text.
declare module "*.html" {
  const html: string;
  export default html;
}
