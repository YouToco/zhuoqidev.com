// What a guestbook note may contain. Pure, so Node can test it (server/guestbook.test.ts).

export const COLORS = ["yellow", "pink", "blue", "green"] as const;
export type Color = (typeof COLORS)[number];
export const MAX_NAME = 24;
export const MAX_BODY = 200;
/** A person needs a few seconds to write something; form-filling scripts post at once. */
export const MIN_MS_ON_PAGE = 3000;

export type Note = { name: string; body: string; color: Color; lang: "zh" | "en" };
export type Checked = { ok: true; note: Note } | { ok: false; error: "bad-request" | "empty" | "too-long" | "too-fast" | "spam" };

// Control characters (other than newline) and invisible formatting characters that could
// hide or reorder text; plain line breaks stay.
const INVISIBLE = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g;

const clean = (s: string) => s.normalize("NFC").replace(/\r\n?/g, "\n").replace(INVISIBLE, "");
const length = (s: string) => [...s].length;

export function checkNote(input: unknown): Checked {
  if (!input || typeof input !== "object") return { ok: false, error: "bad-request" };
  const o = input as Record<string, unknown>;
  // The form has a field people never see; anything typed into it came from a bot.
  if (typeof o.website === "string" && o.website !== "") return { ok: false, error: "spam" };
  if (typeof o.ms !== "number" || o.ms < MIN_MS_ON_PAGE) return { ok: false, error: "too-fast" };
  if (typeof o.body !== "string" || (o.name !== undefined && typeof o.name !== "string")) return { ok: false, error: "bad-request" };
  const body = clean(o.body).replace(/\n{3,}/g, "\n\n").trim();
  const name = clean(typeof o.name === "string" ? o.name : "").replace(/\s+/g, " ").trim();
  if (!body) return { ok: false, error: "empty" };
  if (length(body) > MAX_BODY || length(name) > MAX_NAME) return { ok: false, error: "too-long" };
  const color = COLORS.includes(o.color as Color) ? (o.color as Color) : "yellow";
  const lang = o.lang === "en" ? "en" : "zh";
  return { ok: true, note: { name, body, color, lang } };
}
