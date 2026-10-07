// Shared HTTP helpers for the Pages Functions.

// The blog's own pages: both mainland and overseas lines, pages.dev (and its preview aliases), local dev.
const SITE_ORIGIN = /^(https:\/\/(www\.)?zhuoqidev\.com|https:\/\/([a-z0-9-]+\.)?zhuoqidev\.pages\.dev|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

/** The request's Origin when it is one of the blog's pages, else null. */
export function siteOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  return origin && SITE_ORIGIN.test(origin) ? origin : null;
}

/** Let the blog's pages (served from another host on the mainland line) read the response. */
export function withCors(request: Request, response: Response): Response {
  const origin = siteOrigin(request);
  if (!origin) return response;
  const res = new Response(response.body, response);
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.append("Vary", "Origin");
  return res;
}

export function preflight(request: Request): Response {
  return withCors(
    request,
    new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    }),
  );
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

export const sha256 = async (text: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
export const hex = (buf: ArrayBuffer | Uint8Array) =>
  [...(buf instanceof Uint8Array ? buf : new Uint8Array(buf))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Constant-time check of `Authorization: Bearer <ADMIN_TOKEN>`. */
export async function isAdmin(request: Request, env: Env): Promise<boolean> {
  const token = env.ADMIN_TOKEN ?? "";
  if (token.length < 32) return false;
  const given = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const [a, b] = await Promise.all([sha256(given), sha256(token)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

/** Read a small JSON body; null when it is missing, too large or not JSON. */
export async function readJson(request: Request, maxBytes = 8192): Promise<unknown> {
  const text = await request.text();
  if (!text || text.length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
