// The owner's dashboard: visit counts and guestbook review. The page itself is public and holds no
// data; everything it shows comes from /api/admin/* with the token typed into it.
import page from "../../server/admin.html";

export const onRequestGet: PagesFunction<Env> = () =>
  new Response(page, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      // Notes are visitor-written text; the page renders them with textContent only, and this keeps
      // anything that slipped through from loading or sending data elsewhere.
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
