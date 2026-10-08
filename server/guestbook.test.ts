import assert from "node:assert/strict";
import { test } from "node:test";
import { checkNote } from "./guestbook.ts";

const ok = { body: "你好，文章写得很清楚！", name: "路过的读者", color: "pink", lang: "zh", ms: 12000, website: "" };

test("accepts a normal note and tidies it", () => {
  assert.deepEqual(checkNote(ok), { ok: true, note: { name: "路过的读者", body: "你好，文章写得很清楚！", color: "pink", lang: "zh" } });
  const messy = checkNote({ ...ok, body: "  第一行\r\n\r\n\r\n\r\n第二行‮  ", name: " a \n b ", color: "red", lang: "fr" });
  assert.deepEqual(messy, { ok: true, note: { name: "a b", body: "第一行\n\n第二行", color: "yellow", lang: "zh" } });
});

test("name is optional", () => {
  const { name: _, ...anon } = ok;
  assert.equal(checkNote(anon).ok, true);
});

test("rejects empty, too long, too fast, honeypot and junk", () => {
  assert.deepEqual(checkNote({ ...ok, body: " \n​ " }), { ok: false, error: "empty" });
  assert.deepEqual(checkNote({ ...ok, body: "字".repeat(201) }), { ok: false, error: "too-long" });
  assert.equal(checkNote({ ...ok, body: "字".repeat(200) }).ok, true);
  assert.equal(checkNote({ ...ok, body: "😀".repeat(200) }).ok, true, "emoji count as one character each");
  assert.deepEqual(checkNote({ ...ok, name: "n".repeat(25) }), { ok: false, error: "too-long" });
  assert.deepEqual(checkNote({ ...ok, ms: 800 }), { ok: false, error: "too-fast" });
  assert.deepEqual(checkNote({ ...ok, ms: undefined }), { ok: false, error: "too-fast" });
  assert.deepEqual(checkNote({ ...ok, website: "http://spam" }), { ok: false, error: "spam" });
  assert.deepEqual(checkNote({ ...ok, body: 42 }), { ok: false, error: "bad-request" });
  assert.deepEqual(checkNote(null), { ok: false, error: "bad-request" });
  assert.deepEqual(checkNote("hi"), { ok: false, error: "bad-request" });
});
