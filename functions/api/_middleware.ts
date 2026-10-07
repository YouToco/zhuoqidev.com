// CORS for the API: on the mainland line the pages come from Aliyun CDN (zhuoqidev.com), while the
// API lives on Cloudflare (api.zhuoqidev.com), so the browser asks first.
import { json, preflight, withCors } from "../../server/http.ts";

export const onRequest: PagesFunction<Env> = async ({ request, next }) => {
  if (request.method === "OPTIONS") return preflight(request);
  try {
    return withCors(request, await next());
  } catch (e) {
    console.error("api error", e);
    return withCors(request, json({ error: "server" }, 500));
  }
};
